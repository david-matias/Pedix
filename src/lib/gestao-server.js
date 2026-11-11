// Pedix Gestão: caixa e estoque disparados pelos pedidos que já existem.
import { all, nowIso } from "@/lib/pedix-server";

export async function gestaoEnabled(db, establishment) {
  const rows = await all(db.entities.Entitlement.filter({ establishment_id: establishment.id, module: "GESTAO" }));
  return rows.some((row) => row.enabled === true);
}

/** Só uma sessão aberta por loja: a mais recente manda. */
export async function openSession(db, establishmentId) {
  const rows = await all(db.entities.CashSession.filter({ establishment_id: establishmentId, status: "OPEN" }));
  return rows.sort((a, b) => new Date(b.opened_at ?? 0) - new Date(a.opened_at ?? 0))[0] ?? null;
}

/** Pedido concluído com pagamento entra sozinho na sessão aberta. Sem sessão, o pedido conclui igual. */
export async function registerSale(db, establishment, order) {
  if (!(await gestaoEnabled(db, establishment))) return { recorded: false, reason: "module_off" };
  if (!order?.payment_code) return { recorded: false, reason: "no_payment" };

  const session = await openSession(db, establishment.id);
  if (!session) return { recorded: false, reason: "no_session" };

  const existing = await all(db.entities.CashMovement.filter({ order_id: order.id, type: "SALE" }));
  if (existing.length > 0) return { recorded: true, duplicate: true };

  await db.entities.CashMovement.create({
    establishment_id: establishment.id,
    session_id: session.id,
    type: "SALE",
    amount_cents: Number(order.total_cents ?? 0),
    payment_code: order.payment_code,
    order_id: order.id,
    note: `Pedido #${order.number}`,
    created_at: nowIso(),
  });

  return { recorded: true };
}

/** Baixa de estoque dos itens que controlam saldo. Saldo insuficiente não bloqueia: fica negativo. */
export async function releaseStock(db, establishment, order, items) {
  if (!(await gestaoEnabled(db, establishment))) return;

  const products = await all(db.entities.Product.filter({ establishment_id: establishment.id }));
  const tracked = new Map(products.filter((product) => product.track_stock === true).map((product) => [product.id, product]));
  const existing = await all(db.entities.StockMovement.filter({ order_id: order.id, type: "OUT" }));
  const done = new Set(existing.map((movement) => movement.order_item_id));

  for (const item of items) {
    if (item.removed === true) continue;
    if (done.has(item.id)) continue;
    const product = tracked.get(item.product_id);
    if (!product) continue;
    const quantity = Number(item.quantity ?? 0);
    if (quantity <= 0) continue;

    await db.entities.StockMovement.create({
      establishment_id: establishment.id,
      product_id: product.id,
      type: "OUT",
      quantity,
      order_id: order.id,
      order_item_id: item.id,
      note: `Pedido #${order.number}`,
      created_at: nowIso(),
    });
    await db.entities.Product.update(product.id, {
      stock_qty: Number(product.stock_qty ?? 0) - quantity,
    });
  }
}

/** Removeu o item da comanda: devolve a quantidade que tinha baixado. */
export async function returnStockForItem(db, establishment, order, item) {
  if (!(await gestaoEnabled(db, establishment))) return;

  const outs = await all(
    db.entities.StockMovement.filter({ order_item_id: item.id, type: "OUT", order_id: order.id })
  );
  if (outs.length === 0) return;

  for (const out of outs) {
    const product = await db.entities.Product.get(out.product_id).catch(() => null);
    if (!product) continue;
    await db.entities.StockMovement.create({
      establishment_id: establishment.id,
      product_id: out.product_id,
      type: "IN",
      quantity: Number(out.quantity ?? 0),
      order_id: order.id,
      order_item_id: item.id,
      note: `Item removido do pedido #${order.number}`,
      created_at: nowIso(),
    });
    await db.entities.Product.update(product.id, {
      stock_qty: Number(product.stock_qty ?? 0) + Number(out.quantity ?? 0),
    });
  }
}

/** Cancelou o pedido: devolve tudo que tinha baixado. */
export async function returnStockForOrder(db, establishment, order) {
  if (!(await gestaoEnabled(db, establishment))) return;

  const movements = await all(db.entities.StockMovement.filter({ order_id: order.id }));
  const outs = movements.filter((movement) => movement.type === "OUT");
  if (outs.length === 0) return;

  const returned = new Set(movements.filter((movement) => movement.type === "IN").map((movement) => movement.order_item_id));
  const byProduct = new Map();

  for (const out of outs) {
    if (out.order_item_id && returned.has(out.order_item_id)) continue;
    const current = byProduct.get(out.product_id) ?? { quantity: 0, items: [] };
    current.quantity += Number(out.quantity ?? 0);
    current.items.push(out.order_item_id);
    byProduct.set(out.product_id, current);
  }

  for (const [productId, entry] of byProduct) {
    if (entry.quantity <= 0) continue;
    const product = await db.entities.Product.get(productId).catch(() => null);
    if (!product) continue;
    await db.entities.StockMovement.create({
      establishment_id: establishment.id,
      product_id: productId,
      type: "IN",
      quantity: entry.quantity,
      order_id: order.id,
      order_item_id: entry.items[0] ?? "",
      note: `Pedido #${order.number} cancelado`,
      created_at: nowIso(),
    });
    await db.entities.Product.update(productId, {
      stock_qty: Number(product.stock_qty ?? 0) + entry.quantity,
    });
  }
}