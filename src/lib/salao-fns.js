// Pedix Mesas: comandas de mesa e de balcão. Mesmo catálogo, mesmo Order, mesmo OrderItem.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  all,
  dateKey,
  loadStoreState,
  nowIso,
  promotionPrices,
  rebuildCart,
  resolveLojista,
} from "@/lib/pedix-server";
import { kitchenEnabled, kitchenSnapshot } from "@/lib/cozinha-server";
import { registerSale, releaseStock, returnStockForItem, returnStockForOrder } from "@/lib/gestao-server";
import {
  checkCoupon,
  consumeCoupon,
  earnPoints,
  findCoupon,
  growthEnabled,
  reverseLoyaltyForOrder,
} from "@/lib/growth-server";

const OPEN_STATUSES = ["ABERTA", "CONTA"];
const PAYMENT_CODES = ["CASH", "PIX", "CARD_ON_DELIVERY"];
const SALAO_PROBLEM_MESSAGES = {
  item_indisponivel: "Este item saiu do cardápio agora.",
  opcao_indisponivel: "Uma das opções escolhidas saiu do cardápio.",
  opcao_obrigatoria: "Escolha a opção obrigatória deste item.",
  opcao_minima: "Escolha o mínimo de opções deste item.",
  opcao_maxima: "Escolha menos opções deste item.",
};

/** Loja logada + se o Pedix Mesas está contratado. */
async function salaoScope(context) {
  const db = context.getBase44().asServiceRole;
  const establishment = await resolveLojista(db, context.user);
  if (!establishment) return { db, establishment: null, moduleOn: false };
  const state = await loadStoreState(db, establishment);
  return { db, establishment, moduleOn: state.enabledModules.includes("MESAS") };
}

async function nextNumber(db, establishment) {
  const orders = await all(db.entities.Order.filter({ establishment_id: establishment.id }));
  const start = Number(establishment.order_number_start ?? 1) - 1;
  return Math.max(start, ...orders.map((order) => Number(order.number) || 0)) + 1;
}

async function loadCatalog(db, establishment) {
  const [categories, products, optionGroups, options, combos, comboItems, payments, promos] = await Promise.all([
    all(db.entities.Category.filter({ establishment_id: establishment.id })),
    all(db.entities.Product.filter({ establishment_id: establishment.id })),
    all(db.entities.OptionGroup.filter({ establishment_id: establishment.id })),
    all(db.entities.Option.filter({ establishment_id: establishment.id })),
    all(db.entities.Combo.filter({ establishment_id: establishment.id })),
    all(db.entities.ComboItem.filter({ establishment_id: establishment.id })),
    all(db.entities.PaymentMethod.filter({ establishment_id: establishment.id })),
    promotionPrices(db, establishment),
  ]);

  return {
    categories: categories
      .filter((category) => category.active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    products: products
      .filter((product) => product.active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((product) => {
        const promo = promos.get(product.id);
        return {
          ...product,
          promo_price_cents: promo != null && promo < (product.price_cents ?? 0) ? promo : null,
        };
      }),
    option_groups: optionGroups.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    options: options
      .filter((option) => option.active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    combos: combos.filter((combo) => combo.active !== false),
    combo_items: comboItems,
    payments: payments.filter((payment) => payment.active !== false),
  };
}

async function openComandas(db, establishment) {
  const orders = await all(
    db.entities.Order.filter({
      establishment_id: establishment.id,
      order_channel: { $in: ["TABLE", "COUNTER"] },
      status: { $in: OPEN_STATUSES },
    })
  );
  return orders;
}

/** Soma só o que não foi removido: o total é sempre recalculado no servidor. */
async function recalc(db, orderId) {
  const items = await all(db.entities.OrderItem.filter({ order_id: orderId }));
  const subtotal = items
    .filter((item) => item.removed !== true)
    .reduce((sum, item) => sum + Number(item.line_total_cents ?? 0), 0);
  return db.entities.Order.update(orderId, {
    subtotal_cents: subtotal,
    delivery_fee_cents: 0,
    total_cents: subtotal,
    updated_at: nowIso(),
  });
}

async function ownOrder(db, establishment, orderId) {
  const order = await db.entities.Order.get(orderId).catch(() => null);
  if (!order) return null;
  if (order.establishment_id !== establishment.id) return null;
  if (order.order_channel !== "TABLE" && order.order_channel !== "COUNTER") return null;
  return order;
}

function isOpen(order) {
  return OPEN_STATUSES.includes(order?.status);
}

/** Mapa do salão: mesas com a comanda aberta, balcão em aberto e o catálogo para lançar. */
export const getSalao = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "unlinked" };

    const [tables, comandas, catalog] = await Promise.all([
      all(db.entities.Table.filter({ establishment_id: establishment.id })),
      openComandas(db, establishment),
      moduleOn ? loadCatalog(db, establishment) : Promise.resolve(null),
    ]);

    const byTable = new Map();
    for (const order of comandas) {
      if (order.table_id) byTable.set(order.table_id, order);
    }

    const mapped = tables
      .filter((table) => moduleOn ? true : table.active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.number ?? 0) - (b.number ?? 0))
      .map((table) => {
        const order = byTable.get(table.id);
        return {
          ...table,
          comanda: order
            ? {
                id: order.id,
                number: order.number,
                status: order.status,
                total_cents: order.total_cents ?? 0,
                opened_at: order.created_at,
              }
            : null,
        };
      });

    return {
      status: "ok",
      module_enabled: moduleOn,
      establishment: { id: establishment.id, name: establishment.name },
      tables: mapped,
      counters: comandas
        .filter((order) => order.order_channel === "COUNTER")
        .map((order) => ({
          id: order.id,
          number: order.number,
          status: order.status,
          customer_name: order.customer_name ?? "Balcão",
          total_cents: order.total_cents ?? 0,
          opened_at: order.created_at,
        })),
      catalog: catalog ?? { categories: [], products: [], option_groups: [], options: [], combos: [], combo_items: [], payments: [] },
      payments: catalog?.payments ?? [],
      server_time: nowIso(),
    };
  });

/** Uma comanda: itens copiados, opções, mesa e o catálogo para lançar mais. */
export const getComanda = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "unlinked" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };

    const [items, options, table, catalog] = await Promise.all([
      all(db.entities.OrderItem.filter({ order_id: order.id })),
      all(db.entities.OrderItemOption.filter({ establishment_id: establishment.id })),
      order.table_id ? db.entities.Table.get(order.table_id).catch(() => null) : Promise.resolve(null),
      moduleOn ? loadCatalog(db, establishment) : Promise.resolve(null),
    ]);

    const orderItems = items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const kitchen = await kitchenSnapshot(db, establishment, order, orderItems);

    return {
      status: "ok",
      module_enabled: moduleOn,
      kitchen,
      // O cupom só aparece no fechamento de balcão e só com o Growth ligado.
      growth: order.order_channel === "COUNTER" ? await growthEnabled(db, establishment) : false,
      order,
      items: orderItems,
      options: options.filter((option) => orderItems.some((item) => item.id === option.order_item_id)),
      table,
      catalog: catalog ?? { categories: [], products: [], option_groups: [], options: [], combos: [], combo_items: [], payments: [] },
      payments: catalog?.payments ?? [],
      read_only: !moduleOn || !isOpen(order),
      server_time: nowIso(),
    };
  });

/** Abre a comanda da mesa — ou devolve a que já está aberta. Nunca duas na mesma mesa. */
export const openTableComanda = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ table_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const table = await db.entities.Table.get(data.table_id).catch(() => null);
    if (!table || table.establishment_id !== establishment.id) return { status: "not_found" };
    if (table.active === false) {
      return { status: "invalid", message: "Esta mesa está desativada." };
    }

    const open = await openComandas(db, establishment);
    const existing = open.find((order) => order.table_id === table.id);
    if (existing) return { status: "ok", order: existing, existing: true };

    const timestamp = nowIso();
    const order = await db.entities.Order.create({
      establishment_id: establishment.id,
      number: await nextNumber(db, establishment),
      order_channel: "TABLE",
      fulfillment_type: "DINE_IN",
      status: "ABERTA",
      table_id: table.id,
      customer_name: table.name?.trim() || `Mesa ${table.number}`,
      subtotal_cents: 0,
      delivery_fee_cents: 0,
      total_cents: 0,
      created_at: timestamp,
      updated_at: timestamp,
      status_history: [{ status: "ABERTA", at: timestamp }],
    });

    return { status: "ok", order, existing: false };
  });

/** Balcão: pedido sem mesa, com nome opcional. */
export const openCounterOrder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ name: z.string().trim().max(60).default("") }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const timestamp = nowIso();
    const order = await db.entities.Order.create({
      establishment_id: establishment.id,
      number: await nextNumber(db, establishment),
      order_channel: "COUNTER",
      fulfillment_type: "PICKUP",
      status: "ABERTA",
      customer_name: data.name || "Balcão",
      subtotal_cents: 0,
      delivery_fee_cents: 0,
      total_cents: 0,
      created_at: timestamp,
      updated_at: timestamp,
      status_history: [{ status: "ABERTA", at: timestamp }],
    });

    return { status: "ok", order };
  });

/**
 * Lança um item recalculando pelo catálogo da loja. Se o preço mudou ou o item saiu,
 * não grava nada e devolve o valor novo para a tela avisar.
 */
export const addComandaItem = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1).max(80),
      kind: z.enum(["product", "combo"]),
      ref_id: z.string().min(1).max(80),
      quantity: z.number().int().min(1).max(50),
      option_ids: z.array(z.string().max(80)).max(30).default([]),
      notes: z.string().max(140).default(""),
      expected_unit_price_cents: z.number().int().min(0),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };
    if (order.status === "CONTA") {
      return { status: "invalid", message: "A conta já foi pedida. Toque em “Voltar a lançar”." };
    }
    if (order.status !== "ABERTA") {
      return { status: "invalid", message: "Esta comanda já está encerrada." };
    }

    const rebuilt = await rebuildCart(db, establishment, [
      {
        kind: data.kind,
        ref_id: data.ref_id,
        quantity: data.quantity,
        option_ids: data.option_ids,
        notes: data.notes,
      },
    ]);

    if (rebuilt.problems.length > 0) {
      return {
        status: "invalid",
        message: SALAO_PROBLEM_MESSAGES[rebuilt.problems[0]] ?? "Não foi possível lançar este item.",
      };
    }

    const line = rebuilt.lines[0];
    if (line.unit_price_cents !== data.expected_unit_price_cents) {
      return {
        status: "price_changed",
        product_name: line.name,
        unit_price_cents: line.unit_price_cents,
      };
    }

    const existing = await all(db.entities.OrderItem.filter({ order_id: order.id }));
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
      sort_order: existing.length,
      removed: false,
    });

    for (const option of line.options) {
      await db.entities.OrderItemOption.create({
        establishment_id: establishment.id,
        order_item_id: saved.id,
        group_name: option.group_name,
        option_name: option.option_name,
        price_delta_cents: option.price_delta_cents,
      });
    }

    // Com o Cozinha desligado, o estoque baixa no lançamento; com ele, baixa ao enviar para a cozinha.
    if (!(await kitchenEnabled(db, establishment))) {
      await releaseStock(db, establishment, order, [saved]);
    }

    const updated = await recalc(db, order.id);
    return { status: "ok", item: saved, order: updated };
  });

export const changeItemQuantity = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ item_id: z.string().min(1).max(80), quantity: z.number().int().min(1).max(50) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const item = await db.entities.OrderItem.get(data.item_id).catch(() => null);
    if (!item || item.establishment_id !== establishment.id) return { status: "not_found" };
    const order = await ownOrder(db, establishment, item.order_id);
    if (!order) return { status: "not_found" };
    if (order.status !== "ABERTA") {
      return { status: "invalid", message: "Só dá para alterar uma comanda aberta." };
    }

    await db.entities.OrderItem.update(item.id, {
      quantity: data.quantity,
      line_total_cents: Number(item.unit_price_cents ?? 0) * data.quantity,
    });
    const updated = await recalc(db, order.id);
    return { status: "ok", order: updated };
  });

/** Remover não apaga: marca quem removeu e quando, e sai do total. */
export const removeComandaItem = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ item_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const item = await db.entities.OrderItem.get(data.item_id).catch(() => null);
    if (!item || item.establishment_id !== establishment.id) return { status: "not_found" };
    const order = await ownOrder(db, establishment, item.order_id);
    if (!order) return { status: "not_found" };
    if (order.status !== "ABERTA") {
      return { status: "invalid", message: "Só dá para alterar uma comanda aberta." };
    }

    await db.entities.OrderItem.update(item.id, {
      removed: true,
      removed_by: context.user.full_name || context.user.email || "Lojista",
      removed_at: nowIso(),
    });
    await returnStockForItem(db, establishment, order, item);
    const updated = await recalc(db, order.id);
    return { status: "ok", order: updated };
  });

export const requestBill = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };
    if (order.status !== "ABERTA") {
      return { status: "invalid", message: "Esta comanda não está aberta." };
    }

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: "CONTA",
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: "CONTA", at: timestamp }],
    });
    return { status: "ok", order: updated };
  });

/** "Voltar a lançar": a conta pedida volta para aberta. */
export const resumeComanda = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };
    if (order.status !== "CONTA") {
      return { status: "invalid", message: "Esta comanda não está com a conta pedida." };
    }

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: "ABERTA",
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: "ABERTA", at: timestamp }],
    });
    return { status: "ok", order: updated };
  });

export const transferComanda = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80), table_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };
    if (order.order_channel !== "TABLE") {
      return { status: "invalid", message: "Só comanda de mesa pode ser transferida." };
    }
    if (!isOpen(order)) return { status: "invalid", message: "Esta comanda já está encerrada." };

    const table = await db.entities.Table.get(data.table_id).catch(() => null);
    if (!table || table.establishment_id !== establishment.id) return { status: "not_found" };
    if (table.active === false) return { status: "invalid", message: "Esta mesa está desativada." };
    if (table.id === order.table_id) {
      return { status: "invalid", message: "A comanda já está nesta mesa." };
    }

    const open = await openComandas(db, establishment);
    if (open.some((entry) => entry.table_id === table.id && entry.id !== order.id)) {
      return { status: "invalid", message: `A mesa ${table.number} já está ocupada.` };
    }

    const updated = await db.entities.Order.update(order.id, {
      table_id: table.id,
      customer_name: table.name?.trim() || `Mesa ${table.number}`,
      updated_at: nowIso(),
    });
    return { status: "ok", order: updated };
  });

/** Fechar: grava a forma de pagamento e o total do momento; o pedido fica concluído. */
export const closeComanda = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1).max(80),
      payment_code: z.enum(PAYMENT_CODES),
      change_for_cents: z.number().int().min(0).max(1000000).nullable().optional(),
      coupon_code: z.string().max(40).default(""),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };
    if (!isOpen(order)) return { status: "invalid", message: "Esta comanda já está encerrada." };

    const payments = await all(db.entities.PaymentMethod.filter({ establishment_id: establishment.id }));
    const payment = payments.find((entry) => entry.code === data.payment_code && entry.active !== false);
    if (!payment) return { status: "invalid", message: "Forma de pagamento indisponível nesta loja." };

    const items = await all(db.entities.OrderItem.filter({ order_id: order.id }));
    const total = items
      .filter((item) => item.removed !== true)
      .reduce((sum, item) => sum + Number(item.line_total_cents ?? 0), 0);
    if (total <= 0) {
      return { status: "invalid", message: "Lance ao menos um item antes de fechar." };
    }

    // Cupom de balcão: validado e aplicado no servidor, antes de gravar o total.
    let coupon = null;
    let discount = 0;
    if (order.order_channel === "COUNTER" && data.coupon_code.trim() && (await growthEnabled(db, establishment))) {
      coupon = await findCoupon(db, establishment, data.coupon_code);
      const checked = checkCoupon(coupon, total, dateKey());
      if (!checked.ok) return { status: "invalid", message: checked.message };
      discount = checked.discount_cents;
    }

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: "COMPLETED",
      payment_code: data.payment_code,
      change_for_cents: data.payment_code === "CASH" ? data.change_for_cents ?? null : null,
      subtotal_cents: total,
      delivery_fee_cents: 0,
      discount_cents: discount,
      coupon_code: coupon?.code ?? "",
      total_cents: Math.max(0, total - discount),
      closed_at: timestamp,
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: "COMPLETED", at: timestamp }],
    });

    if (coupon) await consumeCoupon(db, coupon);
    await registerSale(db, establishment, updated);
    // Comanda fechada também rende pontos, quando o pedido tem cliente.
    await earnPoints(db, establishment, updated);

    return { status: "ok", order: updated, total_cents: updated.total_cents, discount_cents: discount };
  });

export const cancelComanda = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80), reason: z.string().trim().min(3).max(200) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await salaoScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await ownOrder(db, establishment, data.order_id);
    if (!order) return { status: "not_found" };
    if (!isOpen(order)) return { status: "invalid", message: "Esta comanda já está encerrada." };

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: "CANCELLED",
      cancel_reason: data.reason,
      closed_at: timestamp,
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: "CANCELLED", at: timestamp }],
    });
    await returnStockForOrder(db, establishment, updated);
    await reverseLoyaltyForOrder(db, establishment, order);
    return { status: "ok", order: updated };
  });