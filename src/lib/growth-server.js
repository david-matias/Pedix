// Pedix Growth: cupom, fidelidade e promoção da própria loja com o próprio cliente.
// Nada aqui envia mensagem por API nem cobra comissão: só lê e grava registros da loja.
import { brl } from "@/lib/pedix";
import { all, dateKey, inDateWindow, moduleEnabled, nowIso } from "@/lib/pedix-server";

export const GROWTH_MODULE = "GROWTH";
export const DEFAULT_RULE = { points_per_real: 1, reward_points: 50, reward_discount_cents: 500 };
export const CRM_TEMPLATES = { WINBACK: "WINBACK" };

/** Desligado, o módulo desaparece das telas e do checkout — e nada do que já foi gravado se apaga. */
export function growthEnabled(db, establishment) {
  return moduleEnabled(db, establishment, GROWTH_MODULE);
}

export async function loadRule(db, establishment) {
  const rows = await all(db.entities.LoyaltyRule.filter({ establishment_id: establishment.id }));
  const rule = rows[0];
  return {
    id: rule?.id ?? null,
    points_per_real: Number(rule?.points_per_real ?? DEFAULT_RULE.points_per_real),
    reward_points: Number(rule?.reward_points ?? DEFAULT_RULE.reward_points),
    reward_discount_cents: Number(rule?.reward_discount_cents ?? DEFAULT_RULE.reward_discount_cents),
  };
}

/* ------------------------------- cupom ------------------------------- */

export function normalizeCode(raw) {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function findCoupon(db, establishment, code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const rows = await all(db.entities.Coupon.filter({ establishment_id: establishment.id, code: normalized }));
  return rows[0] ?? null;
}

export function couponDiscountCents(coupon, subtotal) {
  if (!coupon) return 0;
  const value = Number(coupon.value ?? 0);
  const raw = coupon.type === "PERCENT" ? Math.floor((subtotal * value) / 100) : Math.round(value);
  return Math.max(0, Math.min(raw, subtotal));
}

/** Vale só se for desta loja, estiver ativo, no prazo, com uso livre e o mínimo alcançado. */
export function checkCoupon(coupon, subtotal, key = dateKey()) {
  if (!coupon) return { ok: false, message: "Cupom não encontrado nesta loja." };
  if (coupon.active === false) return { ok: false, message: "Este cupom está desativado." };
  if (!inDateWindow(coupon, key)) return { ok: false, message: "Este cupom está fora do prazo." };
  const max = Number(coupon.max_uses ?? 0);
  if (max > 0 && Number(coupon.used_count ?? 0) >= max) {
    return { ok: false, message: "Este cupom já atingiu o limite de usos." };
  }
  const min = Number(coupon.min_subtotal_cents ?? 0);
  if (subtotal < min) {
    return { ok: false, message: `Este cupom vale a partir de ${brl(min)} em produtos.` };
  }
  const discount = couponDiscountCents(coupon, subtotal);
  if (discount <= 0) return { ok: false, message: "Este cupom não gera desconto neste pedido." };
  return { ok: true, discount_cents: discount };
}

export async function consumeCoupon(db, coupon) {
  if (!coupon) return;
  await db.entities.Coupon.update(coupon.id, { used_count: Number(coupon.used_count ?? 0) + 1 });
}

/* ----------------------------- fidelidade ----------------------------- */

export async function loyaltyAccount(db, establishment, customerId) {
  if (!customerId) return null;
  const rows = await all(
    db.entities.LoyaltyAccount.filter({ establishment_id: establishment.id, customer_id: customerId })
  );
  return rows[0] ?? null;
}

export async function ensureAccount(db, establishment, customerId) {
  const existing = await loyaltyAccount(db, establishment, customerId);
  if (existing) return existing;
  return db.entities.LoyaltyAccount.create({
    establishment_id: establishment.id,
    customer_id: customerId,
    points: 0,
  });
}

/** Pontos sobre o total gravado, sem contar a taxa de entrega. */
export function pointsForOrder(rule, order) {
  const base = Math.max(0, Number(order?.total_cents ?? 0) - Number(order?.delivery_fee_cents ?? 0));
  const reais = Math.floor(base / 100);
  return Math.max(0, Math.floor(reais * Number(rule?.points_per_real ?? 0)));
}

/** Pontos entram uma única vez, quando o pedido fica concluído (ou a comanda fecha). */
export async function earnPoints(db, establishment, order) {
  if (!order?.customer_id) return { earned: 0 };
  if (!(await growthEnabled(db, establishment))) return { earned: 0 };

  const events = await all(
    db.entities.LoyaltyEvent.filter({ establishment_id: establishment.id, order_id: order.id, type: "EARN" })
  );
  if (events.some((event) => Number(event.points) > 0)) return { earned: 0 };

  const rule = await loadRule(db, establishment);
  const points = pointsForOrder(rule, order);
  if (points <= 0) return { earned: 0 };

  const account = await ensureAccount(db, establishment, order.customer_id);
  await db.entities.LoyaltyAccount.update(account.id, { points: Number(account.points ?? 0) + points });
  await db.entities.LoyaltyEvent.create({
    establishment_id: establishment.id,
    account_id: account.id,
    order_id: order.id,
    type: "EARN",
    points,
    created_at: nowIso(),
  });

  return { earned: points };
}

/** Resgate do prêmio no checkout: debita os pontos e registra o REDEEM do pedido. */
export async function redeemPoints(db, establishment, customerId, points, orderId) {
  const account = await ensureAccount(db, establishment, customerId);
  await db.entities.LoyaltyAccount.update(account.id, {
    points: Math.max(0, Number(account.points ?? 0) - points),
  });
  await db.entities.LoyaltyEvent.create({
    establishment_id: establishment.id,
    account_id: account.id,
    order_id: orderId,
    type: "REDEEM",
    points: -points,
    created_at: nowIso(),
  });
}

/**
 * Cancelar estorna os pontos daquele pedido sem deixar saldo negativo:
 * o que houver de saldo é devolvido (estorno parcial quando falta), e o
 * resgate feito naquele pedido volta para a conta.
 */
export async function reverseLoyaltyForOrder(db, establishment, order) {
  if (!order?.customer_id) return { removed: 0, restored: 0 };
  if (!(await growthEnabled(db, establishment))) return { removed: 0, restored: 0 };

  const events = await all(
    db.entities.LoyaltyEvent.filter({ establishment_id: establishment.id, order_id: order.id })
  );
  if (events.length === 0) return { removed: 0, restored: 0 };

  const accountId = events.find((event) => event.account_id)?.account_id;
  if (!accountId) return { removed: 0, restored: 0 };
  const account = await db.entities.LoyaltyAccount.get(accountId).catch(() => null);
  if (!account) return { removed: 0, restored: 0 };

  let balance = Math.max(0, Number(account.points ?? 0));
  const timestamp = nowIso();

  const earned = events
    .filter((event) => event.type === "EARN" && Number(event.points) > 0)
    .reduce((sum, event) => sum + Number(event.points), 0);
  const removed = Math.min(earned, balance);
  if (removed > 0) {
    balance -= removed;
    await db.entities.LoyaltyEvent.create({
      establishment_id: establishment.id,
      account_id: accountId,
      order_id: order.id,
      type: "REDEEM",
      points: -removed,
      created_at: timestamp,
    });
  }

  const spent = events
    .filter((event) => event.type === "REDEEM" && Number(event.points) < 0)
    .reduce((sum, event) => sum + Math.abs(Number(event.points)), 0);
  const restored = spent;
  if (restored > 0) {
    balance += restored;
    await db.entities.LoyaltyEvent.create({
      establishment_id: establishment.id,
      account_id: accountId,
      order_id: order.id,
      type: "EARN",
      points: restored,
      created_at: timestamp,
    });
  }

  await db.entities.LoyaltyAccount.update(accountId, { points: Math.max(0, balance) });
  return { removed, restored };
}

/* ------------------------------- CRM ------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Novo: 1 pedido. Recorrente: 2+ com o último há até 15 dias. Inativo: último há mais de 15 dias. */
export function customerBadge(completed, lastOrderAt, now = Date.now()) {
  if (completed <= 0) return { code: null, label: "Sem pedido concluído" };
  const days = lastOrderAt ? Math.floor((now - new Date(lastOrderAt).getTime()) / DAY_MS) : null;
  if (days == null) return { code: "NOVO", label: "Novo" };
  if (days > 15) return { code: "INATIVO", label: "Inativo" };
  if (completed >= 2) return { code: "RECORRENTE", label: "Recorrente" };
  return { code: "NOVO", label: "Novo" };
}

export function winbackMessage(name, storeName) {
  return `Olá, ${String(name ?? "").trim()}. O ${storeName} sentiu sua falta. Quer fazer um pedido?`;
}