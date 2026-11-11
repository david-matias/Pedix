import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formatPhone, isValidWhatsapp, digits } from "@/lib/pedix";
import {
  all,
  dateKey,
  nowIso,
  normalizeText,
  promotionPrices,
  publicEstablishment,
  rebuildCart,
  loadStoreState,
  storefrontState,
} from "@/lib/pedix-server";
import {
  checkCoupon,
  consumeCoupon,
  findCoupon,
  growthEnabled,
  loadRule,
  loyaltyAccount,
  redeemPoints,
} from "@/lib/growth-server";

/** Cardápio público: tudo o que a página /loja/{slug} precisa, em uma chamada. */
export const getStorefront = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const found = await all(db.entities.Establishment.filter({ slug: data.slug }));
    const establishment = found[0];
    if (!establishment) return { status: "not_found" };

    const state = await loadStoreState(db, establishment);
    const storefront = storefrontState({ establishment, ...state });

    const [categories, products, optionGroups, options, combos, comboItems, zones, payments, promos, growth] =
      await Promise.all([
        all(db.entities.Category.filter({ establishment_id: establishment.id })),
        all(db.entities.Product.filter({ establishment_id: establishment.id })),
        all(db.entities.OptionGroup.filter({ establishment_id: establishment.id })),
        all(db.entities.Option.filter({ establishment_id: establishment.id })),
        all(db.entities.Combo.filter({ establishment_id: establishment.id })),
        all(db.entities.ComboItem.filter({ establishment_id: establishment.id })),
        all(db.entities.DeliveryZone.filter({ establishment_id: establishment.id })),
        all(db.entities.PaymentMethod.filter({ establishment_id: establishment.id })),
        promotionPrices(db, establishment),
        growthEnabled(db, establishment),
      ]);

    const loyaltyRule = growth ? await loadRule(db, establishment) : null;

    return {
      status: "ok",
      establishment: publicEstablishment(establishment),
      storefront,
      hours: state.hours,
      subscription: state.subscription ? { status: state.subscription.status } : null,
      enabled_modules: state.enabledModules,
      // Growth desligado esconde cupom, pontos e promoção — o que já foi gravado fica.
      growth,
      loyalty_rule: loyaltyRule
        ? {
            points_per_real: loyaltyRule.points_per_real,
            reward_points: loyaltyRule.reward_points,
            reward_discount_cents: loyaltyRule.reward_discount_cents,
          }
        : null,
      categories: categories
        .filter((c) => c.active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      products: products
        .filter((p) => p.active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((product) => {
          const promo = promos.get(product.id);
          return {
            ...product,
            promo_price_cents: promo != null && promo < (product.price_cents ?? 0) ? promo : null,
          };
        }),
      option_groups: optionGroups.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      options: options.filter((o) => o.active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      combos: combos.filter((c) => c.active !== false),
      combo_items: comboItems,
      zones: zones.filter((z) => z.active !== false),
      payments: payments.filter((p) => p.active !== false),
    };
  });

/**
 * O que o checkout mostra antes de enviar: o cupom digitado e os pontos do WhatsApp
 * naquela loja. Só lê — quem grava é o placeOrder.
 */
export const getCheckoutPerks = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1).max(120),
      whatsapp: z.string().max(30).default(""),
      coupon_code: z.string().max(40).default(""),
      subtotal_cents: z.number().int().min(0).max(100000000),
    })
  )
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const found = await all(db.entities.Establishment.filter({ slug: data.slug }));
    const establishment = found[0];
    if (!establishment) return { status: "not_found" };
    if (!(await growthEnabled(db, establishment))) {
      return { status: "ok", growth: false, coupon: null, loyalty: null };
    }

    let coupon = null;
    if (data.coupon_code.trim()) {
      const row = await findCoupon(db, establishment, data.coupon_code);
      const checked = checkCoupon(row, data.subtotal_cents, dateKey());
      coupon = checked.ok
        ? { status: "ok", code: row.code, discount_cents: checked.discount_cents, message: "" }
        : {
            status: "invalid",
            code: data.coupon_code.trim().toUpperCase(),
            discount_cents: 0,
            message: checked.message,
          };
    }

    const rule = await loadRule(db, establishment);
    const wa = digits(data.whatsapp);
    let points = 0;
    if (wa.length >= 10) {
      const customers = await all(db.entities.Customer.filter({ establishment_id: establishment.id }));
      const customer = customers.find((entry) => digits(entry.whatsapp) === wa);
      const account = customer ? await loyaltyAccount(db, establishment, customer.id) : null;
      points = Number(account?.points ?? 0);
    }

    return {
      status: "ok",
      growth: true,
      coupon,
      loyalty: {
        points,
        reward_points: rule.reward_points,
        reward_discount_cents: rule.reward_discount_cents,
        can_redeem: rule.reward_points > 0 && points >= rule.reward_points,
      },
    };
  });

const cartItemSchema = z.object({
  kind: z.enum(["product", "combo"]),
  ref_id: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(50),
  option_ids: z.array(z.string().max(80)).max(30).default([]),
  notes: z.string().max(140).default(""),
  expected_unit_price_cents: z.number().int().min(0),
});

/**
 * Grava o pedido. Público de propósito (o cliente final não tem login), mas o preço é
 * sempre recalculado aqui a partir do catálogo e da zona de entrega: o que veio do
 * navegador é apenas conferência. Divergiu? Não grava nada e devolve a sacola corrigida.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1).max(120),
      fulfillment_type: z.enum(["DELIVERY", "PICKUP"]),
      customer_name: z.string().trim().min(2).max(80),
      customer_whatsapp: z.string().trim().min(8).max(30),
      address_street: z.string().trim().max(160).default(""),
      address_neighborhood: z.string().trim().max(80).default(""),
      address_reference: z.string().trim().max(160).default(""),
      payment_code: z.enum(["CASH", "PIX", "CARD_ON_DELIVERY"]),
      change_for_cents: z.number().int().min(0).max(1000000).nullable().optional(),
      notes: z.string().max(300).default(""),
      coupon_code: z.string().max(40).default(""),
      use_reward: z.boolean().default(false),
      expected_subtotal_cents: z.number().int().min(0),
      expected_delivery_fee_cents: z.number().int().min(0),
      items: z.array(cartItemSchema).min(1).max(40),
    })
  )
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const found = await all(db.entities.Establishment.filter({ slug: data.slug }));
    const establishment = found[0];
    if (!establishment) return { status: "not_found" };

    const state = await loadStoreState(db, establishment);
    const storefront = storefrontState({ establishment, ...state });
    if (!storefront.can_order) {
      return { status: "closed", message: storefront.message };
    }

    if (!isValidWhatsapp(data.customer_whatsapp)) {
      return { status: "invalid", message: "Informe um WhatsApp válido com DDD." };
    }
    if (data.fulfillment_type === "DELIVERY" && !establishment.delivery_enabled) {
      return { status: "closed", message: "A entrega está desligada nesta loja." };
    }
    if (data.fulfillment_type === "PICKUP" && !establishment.pickup_enabled) {
      return { status: "closed", message: "A retirada está desligada nesta loja." };
    }

    const payments = await all(db.entities.PaymentMethod.filter({ establishment_id: establishment.id }));
    const payment = payments.find((p) => p.code === data.payment_code && p.active !== false);
    if (!payment) return { status: "invalid", message: "Forma de pagamento indisponível." };

    const rebuilt = await rebuildCart(db, establishment, data.items);

    let deliveryFee = 0;
    let zone = null;
    if (data.fulfillment_type === "DELIVERY") {
      const zones = await all(db.entities.DeliveryZone.filter({ establishment_id: establishment.id }));
      zone = zones.find(
        (z) => z.active !== false && normalizeText(z.neighborhood) === normalizeText(data.address_neighborhood)
      );
      if (!zone) rebuilt.problems.push("zona_invalida");
      else deliveryFee = zone.fee_cents ?? 0;
    }

    const pricesDiffer = rebuilt.lines.some((line, index) => {
      const sent = data.items[index];
      return !sent || sent.expected_unit_price_cents !== line.unit_price_cents;
    });

    if (rebuilt.problems.length > 0 || pricesDiffer || rebuilt.subtotal !== data.expected_subtotal_cents || deliveryFee !== data.expected_delivery_fee_cents) {
      return {
        status: "mismatch",
        message: "Alguns itens foram atualizados. Confira antes de enviar.",
        cart: rebuilt.lines,
        subtotal_cents: rebuilt.subtotal,
        delivery_fee_cents: deliveryFee,
        total_cents: rebuilt.subtotal + deliveryFee,
      };
    }

    const minOrder = establishment.min_order_cents ?? 0;
    if (rebuilt.subtotal < minOrder) {
      return {
        status: "min_order",
        message: "O pedido não atingiu o mínimo da loja.",
        missing_cents: minOrder - rebuilt.subtotal,
        min_order_cents: minOrder,
        subtotal_cents: rebuilt.subtotal,
      };
    }

    // Cliente reaproveitado apenas dentro da mesma loja.
    const wa = digits(data.customer_whatsapp);
    const customers = await all(db.entities.Customer.filter({ establishment_id: establishment.id }));
    let customer = customers.find((c) => digits(c.whatsapp) === wa);
    if (customer) {
      await db.entities.Customer.update(customer.id, { name: data.customer_name });
    } else {
      customer = await db.entities.Customer.create({
        establishment_id: establishment.id,
        name: data.customer_name,
        whatsapp: formatPhone(data.customer_whatsapp),
      });
    }

    // Growth: cupom e prêmio entram no recálculo daqui, antes de gravar o pedido.
    const growth = await growthEnabled(db, establishment);
    let coupon = null;
    let couponDiscount = 0;
    let rewardPoints = 0;
    let rewardDiscount = 0;

    if (growth && data.coupon_code.trim()) {
      coupon = await findCoupon(db, establishment, data.coupon_code);
      const checked = checkCoupon(coupon, rebuilt.subtotal, dateKey());
      if (!checked.ok) return { status: "coupon_invalid", message: checked.message };
      couponDiscount = checked.discount_cents;
    }
    if (growth && data.use_reward) {
      const rule = await loadRule(db, establishment);
      const account = await loyaltyAccount(db, establishment, customer.id);
      if (!account || Number(account.points ?? 0) < rule.reward_points) {
        return { status: "reward_invalid", message: "Este WhatsApp não tem pontos suficientes para o prêmio." };
      }
      rewardPoints = rule.reward_points;
      rewardDiscount = Math.min(rule.reward_discount_cents, Math.max(0, rebuilt.subtotal - couponDiscount));
    }

    const discount = Math.min(couponDiscount + rewardDiscount, rebuilt.subtotal);

    const existingOrders = await all(db.entities.Order.filter({ establishment_id: establishment.id }));
    const start = Number(establishment.order_number_start ?? 1) - 1;
    const number = Math.max(start, ...existingOrders.map((o) => Number(o.number) || 0)) + 1;

    const timestamp = nowIso();
    const total = Math.max(0, rebuilt.subtotal + deliveryFee - discount);

    const order = await db.entities.Order.create({
      establishment_id: establishment.id,
      customer_id: customer.id,
      number,
      order_channel: "ONLINE",
      fulfillment_type: data.fulfillment_type,
      status: "RECEIVED",
      customer_name: data.customer_name,
      customer_whatsapp: formatPhone(data.customer_whatsapp),
      address_street: data.fulfillment_type === "DELIVERY" ? data.address_street : establishment.street ?? "",
      address_neighborhood: data.fulfillment_type === "DELIVERY" ? zone?.neighborhood ?? "" : establishment.neighborhood ?? "",
      address_reference: data.fulfillment_type === "DELIVERY" ? data.address_reference : "",
      payment_code: data.payment_code,
      change_for_cents:
        data.payment_code === "CASH" && data.change_for_cents != null ? data.change_for_cents : undefined,
      subtotal_cents: rebuilt.subtotal,
      delivery_fee_cents: deliveryFee,
      discount_cents: discount,
      coupon_code: coupon?.code ?? "",
      total_cents: total,
      notes: data.notes,
      cancel_reason: "",
      status_history: [{ status: "RECEIVED", at: timestamp }],
      created_at: timestamp,
      updated_at: timestamp,
    });

    // O desconto já está no total gravado: mudar o cupom depois não mexe neste pedido.
    if (coupon) await consumeCoupon(db, coupon);
    if (rewardPoints > 0) await redeemPoints(db, establishment, customer.id, rewardPoints, order.id);

    const savedItems = [];
    for (let index = 0; index < rebuilt.lines.length; index += 1) {
      const line = rebuilt.lines[index];
      const saved = await db.entities.OrderItem.create({
        establishment_id: establishment.id,
        order_id: order.id,
        product_id: line.kind === "product" ? line.ref_id : "",
        product_name: line.name,
        quantity: line.quantity,
        unit_price_cents: line.unit_price_cents,
        line_total_cents: line.line_total_cents,
        notes: line.notes,
        is_combo: line.kind === "combo",
        sort_order: index,
      });
      savedItems.push(saved);
      for (const option of line.options) {
        await db.entities.OrderItemOption.create({
          establishment_id: establishment.id,
          order_item_id: saved.id,
          group_name: option.group_name,
          option_name: option.option_name,
          price_delta_cents: option.price_delta_cents,
        });
      }
    }

    // O pedido já está gravado. O aviso é um clique no WhatsApp da loja, não uma API.
    const failed = establishment.whatsapp_fail_simulated === true;
    const notification = await db.entities.NotificationLog.create({
      establishment_id: establishment.id,
      order_id: order.id,
      channel: "WHATSAPP",
      template: "ORDER_RECEIVED",
      status: failed ? "FAILED" : "SENT",
      error_message: failed ? "Falha simulada no aviso por WhatsApp" : "",
      created_at: timestamp,
    });

    return {
      status: "ok",
      order,
      items: savedItems,
      lines: rebuilt.lines,
      notification: { status: notification.status },
      establishment: publicEstablishment(establishment),
      zone: zone ? { neighborhood: zone.neighborhood, fee_cents: zone.fee_cents } : null,
    };
  });