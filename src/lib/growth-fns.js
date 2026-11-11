// Pedix Growth no painel do lojista: cupons, fidelidade, promoções e clientes.
// Todas as funções são da própria loja logada e exigem o módulo ligado.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { all, dateKey, nowIso, resolveLojista } from "@/lib/pedix-server";
import {
  customerBadge,
  findCoupon,
  growthEnabled,
  loadRule,
  normalizeCode,
  winbackMessage,
  CRM_TEMPLATES,
} from "@/lib/growth-server";

async function growthScope(context) {
  const db = context.getBase44().asServiceRole;
  const establishment = await resolveLojista(db, context.user);
  if (!establishment) return { db, establishment: null, enabled: false };
  return { db, establishment, enabled: await growthEnabled(db, establishment) };
}

/* ------------------------------- cupons ------------------------------- */

export const getCoupons = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const coupons = await all(
      db.entities.Coupon.filter({ establishment_id: establishment.id }, { sort: "-created_date", limit: 200 })
    );
    return { status: "ok", coupons, today: dateKey() };
  });

const couponSchema = z.object({
  code: z.string().trim().min(2).max(24),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().min(1).max(100000000),
  min_subtotal_cents: z.number().int().min(0).max(100000000).default(0),
  starts_at: z.string().max(10).default(""),
  ends_at: z.string().max(10).default(""),
  max_uses: z.number().int().min(0).max(100000).default(0),
});

export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(couponSchema)
  .handler(async ({ data, context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const code = normalizeCode(data.code);
    if (code.length < 2) return { status: "invalid", message: "Escreva um código com pelo menos 2 letras." };
    if (data.type === "PERCENT" && data.value > 100) {
      return { status: "invalid", message: "O percentual vai de 1 a 100." };
    }
    if (data.starts_at && data.ends_at && data.ends_at < data.starts_at) {
      return { status: "invalid", message: "A validade termina antes de começar." };
    }
    if (await findCoupon(db, establishment, code)) {
      return { status: "invalid", message: "Já existe um cupom com esse código nesta loja." };
    }

    const coupon = await db.entities.Coupon.create({
      establishment_id: establishment.id,
      code,
      type: data.type,
      value: data.value,
      min_subtotal_cents: data.min_subtotal_cents,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      max_uses: data.max_uses,
      used_count: 0,
      active: true,
    });

    return { status: "ok", coupon };
  });

export const setCouponActive = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(80), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const coupon = await db.entities.Coupon.get(data.id).catch(() => null);
    if (!coupon || coupon.establishment_id !== establishment.id) return { status: "not_found" };

    // Desativar não altera pedido antigo: o desconto já está no total gravado.
    const updated = await db.entities.Coupon.update(coupon.id, { active: data.active });
    return { status: "ok", coupon: updated };
  });

/* ----------------------------- fidelidade ----------------------------- */

export const getLoyalty = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const [rule, accounts] = await Promise.all([
      loadRule(db, establishment),
      all(db.entities.LoyaltyAccount.filter({ establishment_id: establishment.id })),
    ]);

    return {
      status: "ok",
      rule,
      accounts: accounts.length,
      with_points: accounts.filter((account) => Number(account.points ?? 0) > 0).length,
      points_total: accounts.reduce((sum, account) => sum + Number(account.points ?? 0), 0),
    };
  });

export const saveLoyaltyRule = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      points_per_real: z.number().int().min(0).max(1000),
      reward_points: z.number().int().min(0).max(100000),
      reward_discount_cents: z.number().int().min(0).max(10000000),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };
    if (data.reward_points <= 0) {
      return { status: "invalid", message: "O prêmio precisa de pelo menos 1 ponto." };
    }

    const rule = await loadRule(db, establishment);
    const payload = {
      points_per_real: data.points_per_real,
      reward_points: data.reward_points,
      reward_discount_cents: data.reward_discount_cents,
    };

    const saved = rule.id
      ? await db.entities.LoyaltyRule.update(rule.id, payload)
      : await db.entities.LoyaltyRule.create({ establishment_id: establishment.id, ...payload });

    return { status: "ok", rule: saved };
  });

/* ----------------------------- promoções ----------------------------- */

export const getPromotions = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const [promotions, products] = await Promise.all([
      all(db.entities.Promotion.filter({ establishment_id: establishment.id })),
      all(db.entities.Product.filter({ establishment_id: establishment.id })),
    ]);

    return {
      status: "ok",
      today: dateKey(),
      promotions: promotions.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date))),
      products: products
        .filter((product) => product.active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((product) => ({ id: product.id, name: product.name, price_cents: product.price_cents ?? 0 })),
    };
  });

export const savePromotion = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().max(80).default(""),
      product_id: z.string().min(1).max(80),
      promo_price_cents: z.number().int().min(0).max(100000000),
      starts_at: z.string().max(10).default(""),
      ends_at: z.string().max(10).default(""),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const product = await db.entities.Product.get(data.product_id).catch(() => null);
    if (!product || product.establishment_id !== establishment.id) return { status: "not_found" };
    if (data.promo_price_cents <= 0 || data.promo_price_cents >= Number(product.price_cents ?? 0)) {
      return { status: "invalid", message: "O preço promocional precisa ser menor que o preço do cardápio." };
    }
    if (data.starts_at && data.ends_at && data.ends_at < data.starts_at) {
      return { status: "invalid", message: "A validade termina antes de começar." };
    }

    const existing = await all(db.entities.Promotion.filter({ establishment_id: establishment.id }));
    const current = existing.find((row) => (data.id ? row.id === data.id : row.product_id === product.id));

    const payload = {
      product_id: product.id,
      promo_price_cents: data.promo_price_cents,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
    };

    const promotion = current
      ? await db.entities.Promotion.update(current.id, payload)
      : await db.entities.Promotion.create({ establishment_id: establishment.id, active: true, ...payload });

    return { status: "ok", promotion };
  });

export const setPromotionActive = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(80), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const promotion = await db.entities.Promotion.get(data.id).catch(() => null);
    if (!promotion || promotion.establishment_id !== establishment.id) return { status: "not_found" };

    const updated = await db.entities.Promotion.update(promotion.id, { active: data.active });
    return { status: "ok", promotion: updated };
  });

/* ------------------------------- clientes ------------------------------- */

export const getCustomers = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const [customers, orders, accounts] = await Promise.all([
      all(db.entities.Customer.filter({ establishment_id: establishment.id })),
      all(db.entities.Order.filter({ establishment_id: establishment.id, status: "COMPLETED" })),
      all(db.entities.LoyaltyAccount.filter({ establishment_id: establishment.id })),
    ]);

    const pointsByCustomer = new Map(accounts.map((account) => [account.customer_id, Number(account.points ?? 0)]));
    const byWhatsapp = new Map();

    for (const customer of customers) {
      const key = String(customer.whatsapp ?? customer.id);
      const entry = byWhatsapp.get(key) ?? {
        customer_id: customer.id,
        name: customer.name ?? "",
        whatsapp: customer.whatsapp ?? "",
        completed_orders: 0,
        last_order_at: null,
        points: 0,
        customer_ids: [],
      };
      entry.customer_ids.push(customer.id);
      entry.name = customer.name || entry.name;
      byWhatsapp.set(key, entry);
    }

    for (const order of orders) {
      const customer = customers.find((row) => row.id === order.customer_id);
      if (!customer) continue;
      const entry = byWhatsapp.get(String(customer.whatsapp ?? customer.id));
      if (!entry) continue;
      entry.completed_orders += 1;
      const at = order.closed_at || order.updated_at || order.created_at;
      if (at && (!entry.last_order_at || new Date(at) > new Date(entry.last_order_at))) entry.last_order_at = at;
    }

    for (const entry of byWhatsapp.values()) {
      entry.points = entry.customer_ids.reduce((sum, id) => sum + (pointsByCustomer.get(id) ?? 0), 0);
      entry.badge = customerBadge(entry.completed_orders, entry.last_order_at);
      delete entry.customer_ids;
    }

    const rows = [...byWhatsapp.values()].sort((a, b) => {
      if (a.last_order_at && b.last_order_at) return new Date(b.last_order_at) - new Date(a.last_order_at);
      if (a.last_order_at) return -1;
      if (b.last_order_at) return 1;
      return String(a.name).localeCompare(String(b.name));
    });

    return { status: "ok", customers: rows, store_name: establishment.name };
  });

/** Só registra que a mensagem de retorno foi aberta — não existe envio por API aqui. */
export const logCrmMessage = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ customer_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, enabled } = await growthScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!enabled) return { status: "module_off" };

    const customer = await db.entities.Customer.get(data.customer_id).catch(() => null);
    if (!customer || customer.establishment_id !== establishment.id) return { status: "not_found" };

    await db.entities.CrmLog.create({
      establishment_id: establishment.id,
      customer_id: customer.id,
      template: CRM_TEMPLATES.WINBACK,
      created_at: nowIso(),
    });

    return {
      status: "ok",
      whatsapp: customer.whatsapp ?? "",
      message: winbackMessage(customer.name, establishment.name),
    };
  });