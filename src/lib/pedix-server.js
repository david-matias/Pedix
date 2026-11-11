// Ajudantes de servidor do Pedix. Nunca importado por telas do cliente.
import { digits, isWithinOpeningHours, STATUS_FLOW } from "@/lib/pedix";

/** O SDK devolve array (sem opções) ou página (com opções). Normaliza os dois. */
export async function all(result) {
  const res = await result;
  if (Array.isArray(res)) return res;
  return res?.items ?? [];
}

export function nowIso() {
  return new Date().toISOString();
}

const OFFSET = -3 * 60 * 60 * 1000;

export function trairiClock(date = new Date()) {
  const local = new Date(date.getTime() + OFFSET);
  return { weekday: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function trairiDayStartIso() {
  const local = new Date(Date.now() + OFFSET);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - OFFSET).toISOString();
}

/** Módulo contratado e ligado para esta loja. */
export async function moduleEnabled(db, establishment, code) {
  const rows = await all(db.entities.Entitlement.filter({ establishment_id: establishment.id, module: code }));
  return rows.some((row) => row.enabled === true);
}

/** Data de Trairi em AAAA-MM-DD: é assim que cupons e promoções guardam prazo. */
export function dateKey(iso) {
  const day = new Date((iso ? new Date(iso).getTime() : Date.now()) + OFFSET);
  const year = day.getUTCFullYear();
  const month = String(day.getUTCMonth() + 1).padStart(2, "0");
  const date = String(day.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

/** Dentro do prazo (datas em AAAA-MM-DD comparam direto). */
export function inDateWindow(row, key) {
  if (row?.starts_at && key < String(row.starts_at)) return false;
  if (row?.ends_at && key > String(row.ends_at)) return false;
  return true;
}

/** Preço promocional por produto: só com o Growth ligado e dentro do prazo. */
export async function promotionPrices(db, establishment, key = dateKey()) {
  if (!(await moduleEnabled(db, establishment, "GROWTH"))) return new Map();
  const rows = await all(db.entities.Promotion.filter({ establishment_id: establishment.id }));
  const map = new Map();
  for (const row of rows) {
    if (row.active === false) continue;
    if (!inDateWindow(row, key)) continue;
    const price = Number(row.promo_price_cents ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    map.set(row.product_id, price);
  }
  return map;
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function publicEstablishment(est) {
  if (!est) return null;
  const {
    owner_email,
    order_number_start,
    whatsapp_fail_simulated,
    ...rest
  } = est;
  return rest;
}

export async function loadStoreState(db, establishment) {
  const [hours, subscriptions, entitlements] = await Promise.all([
    all(db.entities.OpeningHour.filter({ establishment_id: establishment.id })),
    all(db.entities.Subscription.filter({ establishment_id: establishment.id })),
    all(db.entities.Entitlement.filter({ establishment_id: establishment.id })),
  ]);
  const subscription = subscriptions[0] ?? null;
  const enabledModules = entitlements.filter((e) => e.enabled).map((e) => e.module);
  return { hours, subscription, entitlements, enabledModules };
}

/**
 * O que o público vê e pode fazer agora.
 * menu_visible=false → cardápio escondido; can_order=false → cardápio visível, sem pedidos.
 */
export function storefrontState({ establishment, hours, subscription, enabledModules }) {
  const modules = new Set(enabledModules ?? []);
  if (!modules.has("BASE") || !modules.has("DELIVERY")) {
    return {
      menu_visible: false,
      can_order: false,
      code: "OFFLINE",
      message: "Esta loja não está recebendo pedidos online",
    };
  }
  if (subscription?.status === "SUSPENDED") {
    return {
      menu_visible: true,
      can_order: false,
      code: "SUSPENDED",
      message: "Cardápio temporariamente indisponível.",
    };
  }
  if (!establishment.is_open) {
    return {
      menu_visible: true,
      can_order: false,
      code: "PAUSED",
      message: "Não estamos recebendo pedidos agora.",
    };
  }
  if (!isWithinOpeningHours(hours)) {
    return {
      menu_visible: true,
      can_order: false,
      code: "CLOSED",
      message: "Não estamos recebendo pedidos agora.",
    };
  }
  return { menu_visible: true, can_order: true, code: "OPEN", message: "" };
}

/** A loja do lojista logado (vínculo pelo id do usuário ou pelo e-mail do dono). */
export async function resolveLojista(db, user) {
  if (!user) return null;
  if (user.establishment_id) {
    const found = await all(db.entities.Establishment.filter({ id: user.establishment_id }));
    if (found[0]) return found[0];
  }
  const byOwner = await all(db.entities.Establishment.filter({ owner_email: user.email }));
  if (byOwner[0]) {
    // Só o servidor grava esse vínculo, e apenas quando o e-mail confere.
    await db.entities.User.update(user.id, { establishment_id: byOwner[0].id });
    return byOwner[0];
  }
  return null;
}

/** Recalcula a sacola a partir do catálogo atual (nunca confia nos preços enviados). */
export async function rebuildCart(db, establishment, items) {
  const [products, groups, options, combos, promos] = await Promise.all([
    all(db.entities.Product.filter({ establishment_id: establishment.id })),
    all(db.entities.OptionGroup.filter({ establishment_id: establishment.id })),
    all(db.entities.Option.filter({ establishment_id: establishment.id })),
    all(db.entities.Combo.filter({ establishment_id: establishment.id })),
    promotionPrices(db, establishment),
  ]);

  const problems = [];
  const lines = [];

  items.forEach((item, index) => {
    if (item.kind === "combo") {
      const combo = combos.find((c) => c.id === item.ref_id);
      if (!combo || combo.active === false) {
        problems.push("item_indisponivel");
        return;
      }
      lines.push({
        key: `${item.ref_id}-${index}`,
        kind: "combo",
        ref_id: combo.id,
        name: combo.name,
        description: combo.description ?? "",
        image_url: combo.image_url ?? "",
        quantity: item.quantity,
        option_ids: [],
        options: [],
        notes: item.notes ?? "",
        unit_price_cents: combo.price_cents,
        line_total_cents: combo.price_cents * item.quantity,
      });
      return;
    }

    const product = products.find((p) => p.id === item.ref_id);
    if (!product || product.active === false) {
      problems.push("item_indisponivel");
      return;
    }

    const productGroups = groups
      .filter((g) => g.product_id === product.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const knownOptionIds = new Set();
    const chosen = [];
    const sentOptionIds = item.option_ids ?? [];

    for (const group of productGroups) {
      const groupOptions = options
        .filter((o) => o.group_id === group.id && o.active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      groupOptions.forEach((o) => knownOptionIds.add(o.id));

      const chosenIds = sentOptionIds.filter((id) => groupOptions.some((o) => o.id === id));
      const single = group.selection === "SINGLE";
      const min = single ? 0 : Math.max(0, Number(group.min_select ?? 0));
      const max = single ? 1 : Math.max(min, Number(group.max_select ?? 99));

      if (group.required && chosenIds.length === 0) problems.push("opcao_obrigatoria");
      if (chosenIds.length < min) problems.push("opcao_minima");
      if (chosenIds.length > max) problems.push("opcao_maxima");

      for (const id of chosenIds) {
        const option = groupOptions.find((o) => o.id === id);
        chosen.push({
          id: option.id,
          group_name: group.name,
          option_name: option.name,
          price_delta_cents: option.price_delta_cents ?? 0,
        });
      }
    }

    if (sentOptionIds.some((id) => !knownOptionIds.has(id))) problems.push("opcao_indisponivel");

    // Preço promocional vale só dentro do prazo; fora dele, volta o preço base.
    const promo = promos.get(product.id);
    const base = promo != null && promo < (product.price_cents ?? 0) ? promo : product.price_cents ?? 0;
    const unit = base + chosen.reduce((sum, c) => sum + c.price_delta_cents, 0);
    lines.push({
      key: `${item.ref_id}-${index}`,
      kind: "product",
      ref_id: product.id,
      name: product.name,
      description: product.description ?? "",
      image_url: product.image_url ?? "",
      quantity: item.quantity,
      option_ids: chosen.map((c) => c.id),
      options: chosen,
      notes: item.notes ?? "",
      unit_price_cents: unit,
      line_total_cents: unit * item.quantity,
    });
  });

  const subtotal = lines.reduce((sum, line) => sum + line.line_total_cents, 0);
  return { lines, subtotal, problems };
}

export function nextStatusFor(order) {
  const flow = STATUS_FLOW[order?.fulfillment_type] ?? STATUS_FLOW.DELIVERY;
  const index = flow.indexOf(order?.status);
  if (index < 0 || index === flow.length - 1) return null;
  return flow[index + 1];
}

export function digitsOf(value) {
  return digits(value);
}