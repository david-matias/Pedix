// Pedix Gestão · Estoque: opcional por produto, sem ficha técnica nem fornecedor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { all, nowIso, resolveLojista } from "@/lib/pedix-server";
import { gestaoEnabled } from "@/lib/gestao-server";

async function estoqueScope(context) {
  const db = context.getBase44().asServiceRole;
  const establishment = await resolveLojista(db, context.user);
  if (!establishment) return { db, establishment: null, moduleOn: false };
  return { db, establishment, moduleOn: await gestaoEnabled(db, establishment) };
}

export const getStock = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { db, establishment, moduleOn } = await estoqueScope(context);
    if (!establishment) return { status: "unlinked" };
    if (!moduleOn) return { status: "ok", module_enabled: false, products: [] };

    const products = await all(db.entities.Product.filter({ establishment_id: establishment.id }));

    return {
      status: "ok",
      module_enabled: true,
      products: products
        .filter((product) => product.track_stock === true)
        .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
        .map((product) => ({
          id: product.id,
          name: product.name,
          stock_qty: Number(product.stock_qty ?? 0),
          stock_min: Number(product.stock_min ?? 0),
          low: Number(product.stock_qty ?? 0) <= Number(product.stock_min ?? 0),
        })),
      server_time: nowIso(),
    };
  });

export const getStockProduct = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ product_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await estoqueScope(context);
    if (!establishment) return { status: "unlinked" };
    if (!moduleOn) return { status: "module_off" };

    const product = await db.entities.Product.get(data.product_id).catch(() => null);
    if (!product || product.establishment_id !== establishment.id) return { status: "not_found" };

    const movements = await all(
      db.entities.StockMovement.filter({ product_id: product.id }, { sort: "-created_date", limit: 80 })
    );

    return {
      status: "ok",
      product: {
        id: product.id,
        name: product.name,
        stock_qty: Number(product.stock_qty ?? 0),
        stock_min: Number(product.stock_min ?? 0),
        track_stock: product.track_stock === true,
      },
      movements: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        quantity: Number(movement.quantity ?? 0),
        order_id: movement.order_id ?? "",
        note: movement.note ?? "",
        created_at: movement.created_at,
      })),
    };
  });

/** Ajuste manual: quantidade positiva ou negativa, com motivo, sem mexer em pedido antigo. */
export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      product_id: z.string().min(1).max(80),
      quantity: z.number().int().min(-99999).max(99999),
      note: z.string().trim().min(3).max(200),
    })
  )
  .handler(async ({ data, context }) => {
    const { db, establishment, moduleOn } = await estoqueScope(context);
    if (!establishment) return { status: "forbidden" };
    if (!moduleOn) return { status: "module_off" };
    if (data.quantity === 0) return { status: "invalid", message: "Informe uma quantidade diferente de zero." };

    const product = await db.entities.Product.get(data.product_id).catch(() => null);
    if (!product || product.establishment_id !== establishment.id) return { status: "not_found" };
    if (product.track_stock !== true) {
      return { status: "invalid", message: "Este produto não controla estoque." };
    }

    const balance = Number(product.stock_qty ?? 0) + data.quantity;
    await db.entities.StockMovement.create({
      establishment_id: establishment.id,
      product_id: product.id,
      type: "ADJUST",
      quantity: data.quantity,
      order_id: "",
      note: data.note,
      created_at: nowIso(),
    });
    await db.entities.Product.update(product.id, { stock_qty: balance });

    return { status: "ok", stock_qty: balance };
  });