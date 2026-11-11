// Pedix Gestão · Entregas: despacho dos pedidos de delivery da própria loja.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { all, nowIso, resolveLojista } from "@/lib/pedix-server";
import { gestaoEnabled, registerSale } from "@/lib/gestao-server";

const DISPATCH_STATUSES = ["PREPARING", "OUT_FOR_DELIVERY"];

async function entregasScope(context) {
  const db = context.getBase44().asServiceRole;
  const establishment = await resolveLojista(db, context.user);
  if (!establishment) return { db, establishment: null, moduleOn: false };
  return { db, establishment, moduleOn: await gestaoEnabled(db, establishment) };
}

export const getDeliveries = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, moduleOn } = await entregasScope(context);
    if (!establishment) return { status: "unlinked" };
    if (!moduleOn) return { status: "ok", module_enabled: false, orders: [], couriers: [] };

    const [orders, couriers] = await Promise.all([
      all(
        db.entities.Order.filter({
          establishment_id: establishment.id,
          fulfillment_type: "DELIVERY",
          status: { $in: DISPATCH_STATUSES },
        })
      ),
      all(db.entities.Courier.filter({ establishment_id: establishment.id })),
    ]);

    const courierName = new Map(couriers.map((courier) => [courier.id, courier.name]));

    return {
      status: "ok",
      module_enabled: true,
      orders: orders
        .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0))
        .map((order) => ({
          id: order.id,
          number: order.number,
          status: order.status,
          customer_name: order.customer_name,
          address_street: order.address_street ?? "",
          address_neighborhood: order.address_neighborhood ?? "",
          address_reference: order.address_reference ?? "",
          total_cents: order.total_cents ?? 0,
          created_at: order.created_at,
          courier_id: order.courier_id ?? "",
          courier_name: courierName.get(order.courier_id) ?? "",
        })),
      couriers: couriers
        .filter((courier) => courier.active !== false)
        .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
        .map((courier) => ({ id: courier.id, name: courier.name, whatsapp: courier.whatsapp ?? "" })),
      server_time: nowIso(),
    };
  });

/** Atribuir entregador da própria loja. Em preparo também sai para entrega. */
export const assignCourier = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80), courier_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await entregasScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order || order.establishment_id !== establishment.id) return { status: "not_found" };
    if (order.fulfillment_type !== "DELIVERY") {
      return { status: "invalid", message: "Só pedido de entrega recebe entregador." };
    }
    if (!DISPATCH_STATUSES.includes(order.status)) {
      return { status: "invalid", message: "Este pedido não está em preparo nem na rua." };
    }

    const courier = await db.entities.Courier.get(data.courier_id).catch(() => null);
    if (!courier || courier.establishment_id !== establishment.id) {
      return { status: "invalid", message: "Escolha um entregador desta loja." };
    }
    if (courier.active === false) {
      return { status: "invalid", message: "Este entregador está inativo." };
    }

    const timestamp = nowIso();
    const patch = {
      courier_id: courier.id,
      dispatched_at: order.dispatched_at || timestamp,
      updated_at: timestamp,
    };

    if (order.status === "PREPARING") {
      patch.status = "OUT_FOR_DELIVERY";
      patch.status_history = [...(order.status_history ?? []), { status: "OUT_FOR_DELIVERY", at: timestamp }];
    }

    const updated = await db.entities.Order.update(order.id, patch);
    return { status: "ok", order: updated, courier_name: courier.name };
  });

/** Concluir entrega: mesma regra de status do painel (saiu para entrega → concluído). */
export const completeDelivery = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await entregasScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };

    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order || order.establishment_id !== establishment.id) return { status: "not_found" };
    if (order.fulfillment_type !== "DELIVERY") {
      return { status: "invalid", message: "Só pedido de entrega é concluído por aqui." };
    }
    if (order.status !== "OUT_FOR_DELIVERY") {
      return { status: "invalid", message: "O pedido precisa estar “Saiu para entrega”." };
    }

    const timestamp = nowIso();
    const updated = await db.entities.Order.update(order.id, {
      status: "COMPLETED",
      updated_at: timestamp,
      status_history: [...(order.status_history ?? []), { status: "COMPLETED", at: timestamp }],
    });

    await registerSale(db, establishment, updated);
    return { status: "ok", order: updated };
  });