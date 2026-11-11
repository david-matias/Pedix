import { brl, formatPhone, STATUS_LABELS } from "@/lib/pedix";

/** Resolve um item da sacola contra o catálogo atual. */
export function resolveLine(catalog, item) {
  if (item.kind === "combo") {
    const combo = catalog.combos.find((c) => c.id === item.ref_id);
    if (!combo) return { name: "Combo indisponível", unit: 0, options: [], missing: true, is_combo: true };
    return {
      name: combo.name,
      unit: combo.price_cents ?? 0,
      options: [],
      image_url: combo.image_url ?? "",
      missing: false,
      is_combo: true,
    };
  }

  const product = catalog.products.find((p) => p.id === item.ref_id);
  if (!product) return { name: "Item indisponível", unit: 0, options: [], missing: true };

  const options = (item.option_ids ?? [])
    .map((id) => {
      const option = catalog.options.find((o) => o.id === id);
      if (!option) return null;
      const group = catalog.option_groups.find((g) => g.id === option.group_id);
      return {
        id,
        name: option.name,
        group: group?.name ?? "",
        delta: option.price_delta_cents ?? 0,
      };
    })
    .filter(Boolean);

  // Preço promocional vale só dentro do prazo (o servidor decide e manda o valor).
  const base = product.promo_price_cents ?? product.price_cents ?? 0;
  const unit = base + options.reduce((sum, option) => sum + option.delta, 0);
  return {
    name: product.name,
    unit,
    options,
    image_url: product.image_url ?? "",
    missing: false,
    is_combo: false,
  };
}

export function cartTotals(catalog, items) {
  let count = 0;
  let subtotal = 0;
  for (const item of items) {
    const line = resolveLine(catalog, item);
    count += item.quantity;
    subtotal += line.unit * item.quantity;
  }
  return { count, subtotal };
}

export function optionsSummary(options) {
  if (!options?.length) return "";
  return options.map((option) => option.name).join(", ");
}

export function buildOrderMessage({ order, establishment, lines }) {
  const itemLines = lines.map((line) => {
    const extras = line.options?.length ? ` (${optionsSummary(line.options)})` : "";
    return `${line.quantity}x ${line.product_name}${extras} — ${brl(line.unit_price_cents * line.quantity)}`;
  });
  const place =
    order.fulfillment_type === "DELIVERY"
      ? `Entrega: ${order.address_street}, ${order.address_neighborhood}${order.address_reference ? ` (${order.address_reference})` : ""}`
      : "Retirada na loja";

  return [
    `*Pedido ${order.number} — ${establishment.name}*`,
    "",
    ...itemLines,
    "",
    place,
    `Pagamento: ${order.payment_code === "CASH" ? "Dinheiro" : order.payment_code === "PIX" ? "Pix" : "Cartão na entrega"}`,
    `Total: ${brl(order.total_cents)}`,
    "",
    `Cliente: ${order.customer_name} · ${formatPhone(order.customer_whatsapp)}`,
  ].join("\n");
}

export function statusTimeline(order) {
  return (order.status_history ?? []).map((entry) => ({
    status: entry.status,
    label: STATUS_LABELS[entry.status] ?? entry.status,
    at: entry.at,
  }));
}