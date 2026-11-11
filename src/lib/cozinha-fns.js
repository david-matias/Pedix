// Pedix Cozinha: painel de produção da própria loja.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { all, nowIso, resolveLojista, trairiDayStartIso } from "@/lib/pedix-server";
import { ensureTickets, kitchenEnabled, originLabel, stationsOf } from "@/lib/cozinha-server";
import { releaseStock } from "@/lib/gestao-server";

const ACTIVE_STATUSES = ["QUEUED", "PREPARING"];

async function kitchenScope(context) {
  const db = context.getBase44().asServiceRole;
  const establishment = await resolveLojista(db, context.user);
  if (!establishment) return { db, establishment: null, moduleOn: false };
  return { db, establishment, moduleOn: await kitchenEnabled(db, establishment) };
}

/** Quadro da cozinha: fichas ativas por estação e o que ficou pronto hoje. */
export const getKitchenBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, moduleOn } = await kitchenScope(context);
    if (!establishment) return { status: "unlinked" };
    if (!moduleOn) {
      return { status: "ok", module_enabled: false, stations: [], tickets: [], done_today: [], server_time: nowIso() };
    }

    const [stations, active, done, orders, tables] = await Promise.all([
      stationsOf(db, establishment),
      all(db.entities.KitchenTicket.filter({ establishment_id: establishment.id, status: { $in: ACTIVE_STATUSES } })),
      all(
        db.entities.KitchenTicket.filter({
          establishment_id: establishment.id,
          status: "DONE",
          done_at: { $gte: trairiDayStartIso() },
        })
      ),
      all(db.entities.Order.filter({ establishment_id: establishment.id }, { sort: "-created_date", limit: 100 })),
      all(db.entities.Table.filter({ establishment_id: establishment.id })),
    ]);

    const stationName = new Map(stations.map((station) => [station.id, station.name]));
    const tableNumber = new Map(tables.map((table) => [table.id, table.number]));
    const ordersById = new Map(orders.map((order) => [order.id, order]));

    const shape = (ticket) => {
      const order = ordersById.get(ticket.order_id);
      return {
        ...ticket,
        station_name: stationName.get(ticket.station_id) ?? "Estação",
        origin_label: originLabel(order, tableNumber.get(order?.table_id)),
        order_status: order?.status ?? "",
      };
    };

    return {
      status: "ok",
      module_enabled: true,
      stations: stations.filter((station) => station.active !== false).map((station) => ({ id: station.id, name: station.name })),
      tickets: active
        .map(shape)
        .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0)),
      done_today: done
        .map(shape)
        .sort((a, b) => new Date(b.done_at ?? 0) - new Date(a.done_at ?? 0))
        .slice(0, 40),
      server_time: nowIso(),
    };
  });

/** Um passo por vez: na fila → preparando → pronto. */
export const advanceKitchenTicket = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ ticket_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await kitchenScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const ticket = await db.entities.KitchenTicket.get(data.ticket_id).catch(() => null);
    if (!ticket || ticket.establishment_id !== establishment.id) return { status: "not_found" };
    if (ticket.status === "DONE") return { status: "invalid", message: "Esta ficha já está pronta." };

    const timestamp = nowIso();
    const patch =
      ticket.status === "QUEUED"
        ? { status: "PREPARING", started_at: timestamp }
        : { status: "DONE", done_at: timestamp };

    const updated = await db.entities.KitchenTicket.update(ticket.id, patch);
    return { status: "ok", ticket: updated };
  });

/**
 * Comanda de mesa ou balcão: manda só os itens ainda não enviados.
 * A comanda continua aberta.
 */
export const sendComandaToKitchen = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await kitchenScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order || order.establishment_id !== establishment.id) return { status: "not_found" };
    if (order.order_channel !== "TABLE" && order.order_channel !== "COUNTER") {
      return { status: "invalid", message: "Só comanda de mesa ou balcão vai para a cozinha por aqui." };
    }
    if (order.status !== "ABERTA" && order.status !== "CONTA") {
      return { status: "invalid", message: "Esta comanda já está encerrada." };
    }

    const result = await ensureTickets(db, establishment, order);
    if (result.created > 0) {
      // Enviar para a cozinha é o que dispara a baixa de estoque da comanda.
      const items = await all(db.entities.OrderItem.filter({ order_id: order.id }));
      await releaseStock(db, establishment, order, items);
    }
    if (result.created === 0) {
      return {
        status: "invalid",
        message:
          result.without_station > 0
            ? "Estes itens não têm estação definida no cardápio."
            : "Todos os itens desta comanda já foram para a cozinha.",
      };
    }

    return { status: "ok", created: result.created, without_station: result.without_station };
  });