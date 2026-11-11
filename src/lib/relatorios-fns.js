// Pedix Gestão · Relatórios: números calculados dos pedidos reais desta loja.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { all, resolveLojista } from "@/lib/pedix-server";
import { gestaoEnabled } from "@/lib/gestao-server";

const OFFSET = -3 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Dia local de Trairi (YYYY-MM-DD) de um instante. */
function localDay(epochMs) {
  const d = new Date(epochMs + OFFSET);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Instante do começo do dia local. */
function startOfDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - OFFSET;
}

function shiftDay(day, days) {
  return localDay(startOfDay(day) + days * DAY);
}

function modalityOf(order) {
  if (order.order_channel === "TABLE") return { key: "mesa", label: "Mesa" };
  if (order.order_channel === "COUNTER") return { key: "balcao", label: "Balcão" };
  return order.fulfillment_type === "PICKUP"
    ? { key: "retirada", label: "Retirada" }
    : { key: "entrega", label: "Entrega" };
}

export const getReports = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(
    z.object({
      range: z.enum(["today", "7d", "30d", "custom"]).default("7d"),
      from: z.string().max(10).optional(),
      to: z.string().max(10).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const establishment = await resolveLojista(db, context.user);
    if (!establishment) return { status: "unlinked" };
    if (!(await gestaoEnabled(db, establishment))) return { status: "ok", module_enabled: false };

    const today = localDay(Date.now());
    let startDay = shiftDay(today, -6);
    let endDayExclusive = null;

    if (data.range === "today") {
      startDay = today;
    } else if (data.range === "30d") {
      startDay = shiftDay(today, -29);
    } else if (data.range === "custom" && DATE_RE.test(data.from ?? "") && DATE_RE.test(data.to ?? "")) {
      const from = data.from;
      const to = data.to;
      startDay = from <= to ? from : to;
      endDayExclusive = shiftDay(from <= to ? to : from, 1);
    }

    const lastDay = endDayExclusive ? shiftDay(endDayExclusive, -1) : today;
    const query = endDayExclusive
      ? { establishment_id: establishment.id, created_at: { $gte: new Date(startOfDay(startDay)).toISOString(), $lt: new Date(startOfDay(endDayExclusive)).toISOString() } }
      : { establishment_id: establishment.id, created_at: { $gte: new Date(startOfDay(startDay)).toISOString() } };

    const orders = await all(db.entities.Order.filter(query));
    const valid = orders.filter((order) => order.status !== "CANCELLED");
    const cancelled = orders.filter((order) => order.status === "CANCELLED");

    const items =
      valid.length > 0
        ? await all(db.entities.OrderItem.filter({ order_id: { $in: valid.map((order) => order.id) } }))
        : [];
    const liveItems = items.filter((item) => item.removed !== true);

    const revenue = valid.reduce((sum, order) => sum + Number(order.total_cents ?? 0), 0);

    // Um item por dia do intervalo (até 92 dias); acima disso, só os dias com pedido.
    const dayKeys = [];
    let cursor = startDay;
    let guard = 0;
    while (cursor <= lastDay && guard < 92) {
      dayKeys.push(cursor);
      cursor = shiftDay(cursor, 1);
      guard += 1;
    }

    const buckets = new Map();
    for (const order of valid) {
      const key = localDay(new Date(order.created_at ?? Date.now()).getTime());
      const bucket = buckets.get(key) ?? { date: key, count: 0, total_cents: 0 };
      bucket.count += 1;
      bucket.total_cents += Number(order.total_cents ?? 0);
      buckets.set(key, bucket);
    }

    const days =
      dayKeys.length > 0
        ? dayKeys.map((key) => buckets.get(key) ?? { date: key, count: 0, total_cents: 0 })
        : [...buckets.keys()].sort().map((key) => buckets.get(key));

    const modalityMap = new Map();
    for (const order of valid) {
      const modality = modalityOf(order);
      const entry = modalityMap.get(modality.key) ?? { key: modality.key, label: modality.label, count: 0, total_cents: 0 };
      entry.count += 1;
      entry.total_cents += Number(order.total_cents ?? 0);
      modalityMap.set(modality.key, entry);
    }

    const productMap = new Map();
    for (const item of liveItems) {
      const name = item.product_name ?? "Item";
      const entry = productMap.get(name) ?? { name, quantity: 0, total_cents: 0 };
      entry.quantity += Number(item.quantity ?? 0);
      entry.total_cents += Number(item.line_total_cents ?? 0);
      productMap.set(name, entry);
    }

    return {
      status: "ok",
      module_enabled: true,
      range: data.range,
      start_day: startDay,
      end_day: lastDay,
      metrics: {
        orders: valid.length,
        revenue_cents: revenue,
        average_ticket_cents: valid.length > 0 ? Math.round(revenue / valid.length) : 0,
        cancelled: cancelled.length,
      },
      days,
      modalities: ["entrega", "retirada", "mesa", "balcao"].map(
        (key) => modalityMap.get(key) ?? { key, label: modalityLabel(key), count: 0, total_cents: 0 }
      ),
      top_products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      has_orders: valid.length > 0,
    };
  });

function modalityLabel(key) {
  return { entrega: "Entrega", retirada: "Retirada", mesa: "Mesa", balcao: "Balcão" }[key] ?? key;
}