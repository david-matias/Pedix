import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { STATUS_FLOW } from "@/lib/pedix";
import { all, loadStoreState, nextStatusFor, nowIso, resolveLojista, trairiDayStartIso } from "@/lib/pedix-server";
import { ensureTickets } from "@/lib/cozinha-server";
import { registerSale, releaseStock, returnStockForOrder } from "@/lib/gestao-server";
import { earnPoints, reverseLoyaltyForOrder } from "@/lib/growth-server";

const STATUSES = ["RECEIVED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "COMPLETED"];

/** A loja do lojista logado, com assinatura e módulos. Toda tela do painel parte daqui. */
export const getLojistaContext = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = context.getBase44().asServiceRole;
    const user = context.user;
    const establishment = await resolveLojista(db, user);

    if (!establishment) {
      return {
        status: "unlinked",
        user: { full_name: user.full_name ?? "", email: user.email ?? "", role: user.role ?? "user" },
      };
    }

    const state = await loadStoreState(db, establishment);
    return {
      status: "ok",
      establishment,
      subscription: state.subscription,
      entitlements: state.entitlements,
      enabled_modules: state.enabledModules,
      user: { full_name: user.full_name ?? "", email: user.email ?? "", role: user.role ?? "user" },
      is_platform_admin: user.role === "admin",
    };
  });

/** Pedidos da própria loja + os dois números do dia. Usado no polling de 8s. */
export const getStoreOrders = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = context.getBase44().asServiceRole;
    const establishment = await resolveLojista(db, context.user);
    if (!establishment) return { status: "unlinked" };

    const [orders, todayOrders, items, tables] = await Promise.all([
      all(db.entities.Order.filter({ establishment_id: establishment.id }, { sort: "-created_date", limit: 100 })),
      all(
        db.entities.Order.filter({
          establishment_id: establishment.id,
          created_date: { $gte: trairiDayStartIso() },
        })
      ),
      all(db.entities.OrderItem.filter({ establishment_id: establishment.id })),
      all(db.entities.Table.filter({ establishment_id: establishment.id })),
    ]);

    const tableNumbers = new Map(tables.map((table) => [table.id, table.number]));
    const byOrder = new Map();
    for (const item of items) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(item);
      byOrder.set(item.order_id, list);
    }

    return {
      status: "ok",
      orders: orders.map((order) => {
        const list = (byOrder.get(order.id) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return { ...order, items: list, table_number: tableNumbers.get(order.table_id) ?? null };
      }),
      today: {
        count: todayOrders.length,
        total_cents: todayOrders
          .filter((order) => order.status !== "CANCELLED")
          .reduce((sum, order) => sum + (order.total_cents ?? 0), 0),
      },
      server_time: nowIso(),
    };
  });

/** Itens copiados do pedido (preços do momento da compra). */
export const getOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const establishment = await resolveLojista(db, context.user);
    if (!establishment) return { status: "unlinked" };

    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order) return { status: "not_found" };
    // Lojista só abre pedido da própria loja; admin da plataforma pode abrir qualquer um.
    if (order.establishment_id !== establishment.id && context.user.role !== "admin") {
      return { status: "not_found" };
    }

    const items = await all(db.entities.OrderItem.filter({ order_id: order.id }));
    const options = await all(db.entities.OrderItemOption.filter({ establishment_id: order.establishment_id }));
    const logs = await all(db.entities.NotificationLog.filter({ order_id: order.id }));

    return {
      status: "ok",
      order,
      items: items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      options: options.filter((option) => items.some((item) => item.id === option.order_item_id)),
      notifications: logs,
      next_status: nextStatusFor(order),
      store_name: establishment.name,
    };
  });

export const advanceOrder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1).max(80),
      status: z.enum(STATUSES),
    })
  )
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const establishment = await resolveLojista(db, context.user);
    if (!establishment) return { status: "forbidden" };

    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order) return { status: "not_found" };
    if (order.establishment_id !== establishment.id) return { status: "forbidden" };
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return { status: "invalid", message: "Este pedido já está encerrado." };
    }

    const flow = STATUS_FLOW[order.fulfillment_type] ?? STATUS_FLOW.DELIVERY;
    const current = flow.indexOf(order.status);
    const next = flow.indexOf(data.status);
    if (current < 0 || next !== current + 1) {
      return { status: "invalid", message: "Esse passo não segue a ordem do pedido." };
    }

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: data.status,
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: data.status, at: timestamp }],
    });

    // Entrou em preparo: nasce uma ficha por item com estação e baixa o estoque controlado.
    if (data.status === "PREPARING") {
      await ensureTickets(db, establishment, updated);
      const items = await all(db.entities.OrderItem.filter({ order_id: updated.id }));
      await releaseStock(db, establishment, updated, items);
    }
    // Concluído com pagamento: entra sozinho no caixa aberto, se houver.
    if (data.status === "COMPLETED") {
      await registerSale(db, establishment, updated);
      // Fidelidade: os pontos entram uma vez, sobre o total já gravado.
      await earnPoints(db, establishment, order);
    }

    return { status: "ok", order: updated };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1).max(80),
      reason: z.string().trim().min(3).max(200),
    })
  )
  .handler(async ({ data, context }) => {
    const db = context.getBase44().asServiceRole;
    const establishment = await resolveLojista(db, context.user);
    if (!establishment) return { status: "forbidden" };

    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order) return { status: "not_found" };
    if (order.establishment_id !== establishment.id) return { status: "forbidden" };
    if (order.status === "COMPLETED") {
      return { status: "invalid", message: "Pedido concluído não pode ser cancelado." };
    }
    if (order.status === "CANCELLED") {
      return { status: "invalid", message: "Este pedido já foi cancelado." };
    }

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: "CANCELLED",
      cancel_reason: data.reason,
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: "CANCELLED", at: timestamp }],
    });

    await returnStockForOrder(db, establishment, updated);
    // Cancelar devolve estoque e estorna os pontos deste pedido, sem deixar saldo negativo.
    await reverseLoyaltyForOrder(db, establishment, order);

    return { status: "ok", order: updated };
  });