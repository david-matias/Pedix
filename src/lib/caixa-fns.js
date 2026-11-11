// Pedix Gestão · Caixa: movimento do dia. Não é nota fiscal e não recalcula pedido.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { all, nowIso, resolveLojista, trairiDayStartIso } from "@/lib/pedix-server";
import { gestaoEnabled, openSession } from "@/lib/gestao-server";

async function caixaScope(context) {
  const db = context.getBase44().asServiceRole;
  const establishment = await resolveLojista(db, context.user);
  if (!establishment) return { db, establishment: null, moduleOn: false };
  return { db, establishment, moduleOn: await gestaoEnabled(db, establishment) };
}

async function summarize(db, session) {
  const movements = session
    ? await all(db.entities.CashMovement.filter({ session_id: session.id }))
    : [];

  const sales = movements.filter((movement) => movement.type === "SALE");
  const byPayment = new Map();
  for (const sale of sales) {
    const code = sale.payment_code || "CASH";
    const entry = byPayment.get(code) ?? { code, total_cents: 0, count: 0 };
    entry.total_cents += Number(sale.amount_cents ?? 0);
    entry.count += 1;
    byPayment.set(code, entry);
  }

  const cashSales = byPayment.get("CASH")?.total_cents ?? 0;
  const supplies = movements
    .filter((movement) => movement.type === "SUPPLY")
    .reduce((sum, movement) => sum + Number(movement.amount_cents ?? 0), 0);
  const withdrawals = movements
    .filter((movement) => movement.type === "WITHDRAWAL")
    .reduce((sum, movement) => sum + Number(movement.amount_cents ?? 0), 0);
  const openingFloat = Number(session?.opening_float_cents ?? 0);

  return {
    opening_float_cents: openingFloat,
    sales_total_cents: sales.reduce((sum, sale) => sum + Number(sale.amount_cents ?? 0), 0),
    sales_count: sales.length,
    by_payment: [...byPayment.values()].sort((a, b) => b.total_cents - a.total_cents),
    supplies_cents: supplies,
    withdrawals_cents: withdrawals,
    expected_cash_cents: openingFloat + cashSales + supplies - withdrawals,
  };
}

export const getCash = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, moduleOn } = await caixaScope(context);
    if (!establishment) return { status: "unlinked" };
    if (!moduleOn) return { status: "ok", module_enabled: false };

    const sessions = await all(db.entities.CashSession.filter({ establishment_id: establishment.id }));
    const open = sessions.find((session) => session.status === "OPEN") ?? null;
    const closed = sessions
      .filter((session) => session.status === "CLOSED")
      .sort((a, b) => new Date(b.closed_at ?? 0) - new Date(a.closed_at ?? 0));

    const [summary, lastSummary, movements, todayOrders, saleMovements] = await Promise.all([
      summarize(db, open),
      closed[0] ? summarize(db, closed[0]) : Promise.resolve(null),
      open ? all(db.entities.CashMovement.filter({ session_id: open.id }, { sort: "-created_date", limit: 60 })) : Promise.resolve([]),
      all(
        db.entities.Order.filter({
          establishment_id: establishment.id,
          status: "COMPLETED",
          created_date: { $gte: trairiDayStartIso() },
        })
      ),
      all(db.entities.CashMovement.filter({ establishment_id: establishment.id, type: "SALE" })),
    ]);

    const charged = new Set(saleMovements.map((movement) => movement.order_id).filter(Boolean));
    const orphans = todayOrders.filter((order) => order.payment_code && !charged.has(order.id));

    return {
      status: "ok",
      module_enabled: true,
      session: open
        ? {
            id: open.id,
            opened_at: open.opened_at,
            opening_float_cents: open.opening_float_cents ?? 0,
            note: open.note ?? "",
          }
        : null,
      summary,
      movements: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount_cents: movement.amount_cents ?? 0,
        payment_code: movement.payment_code ?? "",
        order_id: movement.order_id ?? "",
        note: movement.note ?? "",
        created_at: movement.created_at,
      })),
      last_closed: closed[0]
        ? {
            id: closed[0].id,
            opened_at: closed[0].opened_at,
            closed_at: closed[0].closed_at,
            counted_cents: closed[0].counted_cents ?? 0,
            note: closed[0].note ?? "",
            summary: lastSummary,
            difference_cents: Number(closed[0].counted_cents ?? 0) - Number(lastSummary?.expected_cash_cents ?? 0),
          }
        : null,
      orphan_sales: {
        count: orphans.length,
        total_cents: orphans.reduce((sum, order) => sum + Number(order.total_cents ?? 0), 0),
      },
      server_time: nowIso(),
    };
  });

export const openCash = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ opening_float_cents: z.number().int().min(0).max(10000000) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await caixaScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const current = await openSession(db, establishment.id);
    if (current) return { status: "invalid", message: "O caixa já está aberto." };

    const session = await db.entities.CashSession.create({
      establishment_id: establishment.id,
      opened_at: nowIso(),
      opening_float_cents: data.opening_float_cents,
      status: "OPEN",
      note: "",
    });

    return { status: "ok", session };
  });

export const addCashMovement = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      type: z.enum(["SUPPLY", "WITHDRAWAL"]),
      amount_cents: z.number().int().min(1).max(10000000),
      note: z.string().trim().min(3).max(200),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await caixaScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const session = await openSession(db, establishment.id);
    if (!session) return { status: "invalid", message: "Abra o caixa antes de lançar movimento." };

    if (data.type === "WITHDRAWAL") {
      const summary = await summarize(db, session);
      if (data.amount_cents > summary.expected_cash_cents) {
        return { status: "invalid", message: "A sangria deixaria o caixa negativo. Confira o valor." };
      }
    }

    const movement = await db.entities.CashMovement.create({
      establishment_id: establishment.id,
      session_id: session.id,
      type: data.type,
      amount_cents: data.amount_cents,
      payment_code: "",
      order_id: "",
      note: data.note,
      created_at: nowIso(),
    });

    return { status: "ok", movement };
  });

export const closeCash = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      counted_cents: z.number().int().min(0).max(10000000),
      note: z.string().trim().max(200).default(""),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await caixaScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const session = await openSession(db, establishment.id);
    if (!session) return { status: "invalid", message: "Não há caixa aberto." };

    const summary = await summarize(db, session);
    const closed = await db.entities.CashSession.update(session.id, {
      status: "CLOSED",
      closed_at: nowIso(),
      counted_cents: data.counted_cents,
      note: data.note,
    });

    return {
      status: "ok",
      session: closed,
      expected_cents: summary.expected_cash_cents,
      counted_cents: data.counted_cents,
      difference_cents: data.counted_cents - summary.expected_cash_cents,
    };
  });