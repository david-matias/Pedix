// Pedix Cozinha: fichas de produção por estação. Nunca importado por telas.
import { all, nowIso } from "@/lib/pedix-server";

export async function kitchenEnabled(db, establishment) {
  const rows = await all(db.entities.Entitlement.filter({ establishment_id: establishment.id, module: "COZINHA" }));
  return rows.some((row) => row.enabled === true);
}

export async function stationsOf(db, establishment) {
  const rows = await all(db.entities.Station.filter({ establishment_id: establishment.id }));
  return rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** De onde veio a ficha: "Mesa 2", "Pedido 1048 · Entrega", "Pedido 1050 · Balcão". */
export function originLabel(order, tableNumber) {
  if (!order) return "";
  if (order.order_channel === "TABLE") return tableNumber ? `Mesa ${tableNumber}` : "Mesa";
  if (order.order_channel === "COUNTER") return `Pedido ${order.number} · Balcão`;
  return `Pedido ${order.number} · ${order.fulfillment_type === "DELIVERY" ? "Entrega" : "Retirada"}`;
}

/**
 * Uma ficha por item que tenha estação ativa e ainda não tenha ficha.
 * A ficha copia nome, quantidade e opções: mudar o cardápio depois não a altera.
 */
export async function ensureTickets(db, establishment, order) {
  if (!(await kitchenEnabled(db, establishment))) return { module: false, created: 0, without_station: 0 };

  const [items, products, stations, tickets] = await Promise.all([
    all(db.entities.OrderItem.filter({ order_id: order.id })),
    all(db.entities.Product.filter({ establishment_id: establishment.id })),
    stationsOf(db, establishment),
    all(db.entities.KitchenTicket.filter({ order_id: order.id })),
  ]);

  const live = items.filter((item) => item.removed !== true);
  if (live.length === 0) return { module: true, created: 0, without_station: 0 };

  const options = await all(
    db.entities.OrderItemOption.filter({ order_item_id: { $in: live.map((item) => item.id) } })
  );

  const stationByProduct = new Map(products.map((product) => [product.id, product.station_id]));
  const activeStations = new Set(stations.filter((station) => station.active !== false).map((station) => station.id));
  const sent = new Set(tickets.map((ticket) => ticket.order_item_id));

  let created = 0;
  let withoutStation = 0;

  for (const item of live) {
    if (sent.has(item.id)) continue;
    const stationId = stationByProduct.get(item.product_id);
    if (!stationId || !activeStations.has(stationId)) {
      withoutStation += 1;
      continue;
    }

    const optionsText = options
      .filter((option) => option.order_item_id === item.id)
      .map((option) => (option.group_name ? `${option.group_name}: ${option.option_name}` : option.option_name))
      .join(" · ");

    await db.entities.KitchenTicket.create({
      establishment_id: establishment.id,
      order_id: order.id,
      order_item_id: item.id,
      station_id: stationId,
      status: "QUEUED",
      item_name: item.product_name,
      quantity: item.quantity,
      options_text: optionsText,
      notes: item.notes ?? "",
      order_number: order.number,
      created_at: nowIso(),
    });
    sent.add(item.id);
    created += 1;
  }

  return { module: true, created, without_station: withoutStation };
}

/** O que a comanda mostra: módulo ligado, itens que ainda podem ir e quantos já foram. */
export async function kitchenSnapshot(db, establishment, order, items) {
  if (!(await kitchenEnabled(db, establishment))) return { enabled: false, pending: 0, sent: 0 };

  const [products, stations, tickets] = await Promise.all([
    all(db.entities.Product.filter({ establishment_id: establishment.id })),
    stationsOf(db, establishment),
    all(db.entities.KitchenTicket.filter({ order_id: order.id })),
  ]);

  const stationByProduct = new Map(products.map((product) => [product.id, product.station_id]));
  const activeStations = new Set(stations.filter((station) => station.active !== false).map((station) => station.id));
  const sent = new Set(tickets.map((ticket) => ticket.order_item_id));

  let pending = 0;
  let sentCount = 0;
  for (const item of items) {
    if (item.removed === true) continue;
    if (sent.has(item.id)) {
      sentCount += 1;
      continue;
    }
    const stationId = stationByProduct.get(item.product_id);
    if (stationId && activeStations.has(stationId)) pending += 1;
  }

  return { enabled: true, pending, sent: sentCount };
}