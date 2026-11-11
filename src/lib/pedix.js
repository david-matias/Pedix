// Regras e formatadores compartilhados pelo Pedix (cliente + servidor).
// Nada aqui pode depender de APIs do navegador nem do servidor.

export const RESERVED_SLUGS = ["admin", "api", "app", "www", "pedix", "painel"];
export const RESERVED_SLUG_MESSAGE = "Esse endereço é reservado pelo Pedix";

export const CITY = "Trairi";
export const STATE = "CE";

export const CURRENCY_LABEL = "Real";

/** Formata centavos como R$ 28,00 — determinístico no servidor e no navegador. */
export function brl(cents) {
  const value = Math.round(Number(cents) || 0);
  const negative = value < 0;
  const abs = Math.abs(value);
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centavos = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}R$ ${reais},${centavos}`;
}

export function digits(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

/** (85) 98801-1010 */
export function formatPhone(raw) {
  const d = digits(raw);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(raw ?? "");
}

export function isValidWhatsapp(raw) {
  const d = digits(raw);
  return d.length === 10 || d.length === 11;
}

export function waNumber(raw) {
  const d = digits(raw);
  return d.startsWith("55") ? d : `55${d}`;
}

export function waLink(raw, message) {
  return `https://wa.me/${waNumber(raw)}?text=${encodeURIComponent(message ?? "")}`;
}

// Trairi não tem horário de verão: UTC-3 o ano inteiro.
const TRAIRI_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Data/hora local de Trairi a partir de um ISO, sem depender de ICU. */
export function trairiDate(iso) {
  const base = iso ? new Date(iso) : new Date();
  return new Date(base.getTime() + TRAIRI_OFFSET_MS);
}

export function timeBR(iso) {
  const d = trairiDate(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function timeWithSecondsBR(iso) {
  const d = trairiDate(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(
    d.getUTCSeconds()
  ).padStart(2, "0")}`;
}

export function dateBR(iso) {
  const d = trairiDate(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function dateTimeBR(iso) {
  return `${dateBR(iso)} às ${timeBR(iso)}`;
}

/** "2026-11-10" → "10/11/2026": datas de validade, sem fuso. */
export function dayBR(value) {
  const [year, month, day] = String(value ?? "").split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export function weekdayLabel(value) {
  return WEEKDAYS.find((d) => d.value === Number(value))?.label ?? "";
}

export const STATUS_LABELS = {
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  ABERTA: "Aberta",
  CONTA: "Conta pedida",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

/** Origem do pedido, como o lojista lê no painel. */
export const CHANNEL_LABELS = {
  ONLINE: "Delivery",
  TABLE: "Mesa",
  COUNTER: "Balcão",
};

export const TABLE_STATUS_LABELS = {
  LIVRE: "Livre",
  OCUPADA: "Ocupada",
  CONTA: "Conta",
};

/** Mesas e balcão: só mesa e balcão em aberto, não é fila de entrega. */
export const SALAO_OPEN_STATUSES = ["ABERTA", "CONTA"];

export function isSalaoOrder(order) {
  return order?.order_channel === "TABLE" || order?.order_channel === "COUNTER";
}

export const STATUS_FLOW = {
  DELIVERY: ["RECEIVED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED"],
  PICKUP: ["RECEIVED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"],
};

export const NEXT_ACTION_LABELS = {
  CONFIRMED: "Confirmar pedido",
  PREPARING: "Iniciar preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  COMPLETED: "Concluir pedido",
};

export function nextStatus(order) {
  const flow = STATUS_FLOW[order?.fulfillment_type] ?? STATUS_FLOW.DELIVERY;
  const index = flow.indexOf(order?.status);
  if (index < 0 || index === flow.length - 1) return null;
  return flow[index + 1];
}

export const ORDER_TABS = [
  { key: "new", label: "Novos", statuses: ["RECEIVED"] },
  { key: "preparing", label: "Em preparo", statuses: ["CONFIRMED", "PREPARING"] },
  { key: "onway", label: "A caminho ou prontos", statuses: ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP"] },
  { key: "done", label: "Encerrados", statuses: ["COMPLETED", "CANCELLED"] },
];

export const SUBSCRIPTION_LABELS = {
  TRIAL: "Demonstração",
  ACTIVE: "Ativa",
  PAST_DUE: "Em atraso",
  SUSPENDED: "Suspensa",
};

export const PAYMENT_LABELS = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CARD_ON_DELIVERY: "Cartão na entrega",
};

export const MODULES = [
  {
    code: "BASE",
    name: "Pedix Base",
    description: "Cardápio, sacola e painel de pedidos.",
    available: true,
  },
  {
    code: "DELIVERY",
    name: "Pedix Delivery",
    description: "Pedidos online com entrega por bairro.",
    available: true,
  },
  {
    code: "MESAS",
    name: "Pedix Mesas",
    description: "Comandas de mesa e balcão, com o mesmo cardápio e o mesmo pedido.",
    available: true,
  },
  {
    code: "COZINHA",
    name: "Pedix Cozinha",
    description: "Painel de produção por estação, com fichas por item.",
    available: true,
  },
  {
    code: "GESTAO",
    name: "Pedix Gestão",
    description: "Entregas, caixa, estoque e relatórios da própria loja.",
    available: true,
  },
  {
    code: "GROWTH",
    name: "Pedix Growth",
    description: "Cupom, fidelidade, promoção e a carteira de clientes da loja.",
    available: true,
  },
];

export const DEMO_PRICING = {
  monthly_fee_cents: 14900,
  implementation_fee_cents: 49000,
};

export function storeUrl(slug) {
  return `/loja/${slug}`;
}

/** Soma das opções + preço base, em centavos. */
export function comboOrProductLineTotal({ baseCents = 0, deltas = [], quantity = 1 }) {
  const unit = baseCents + deltas.reduce((sum, d) => sum + d, 0);
  return { unit, total: unit * quantity };
}

/** Normaliza listas do SDK: array direto ou página com items. */
export function asList(result) {
  if (Array.isArray(result)) return result;
  return result?.items ?? [];
}

/** Converte "28,50" ou "28.50" em 2850 centavos. */
export function parseMoneyToCents(value) {
  const text = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

/** Centavos em texto editável: 2850 → "28,50". */
export function centsToInput(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2).replace(".", ",");
}

/** Verifica se a loja está dentro do horário de funcionamento agora. */
export function isWithinOpeningHours(hours, now = new Date()) {
  if (!hours || hours.length === 0) return true;
  const local = trairiDate(now.toISOString());
  const weekday = local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const today = hours.filter((h) => Number(h.weekday) === weekday);
  return today.some((h) => {
    if (h.closed) return false;
    const [oh, om] = String(h.opens_at || "00:00").split(":").map(Number);
    const [ch, cm] = String(h.closes_at || "23:59").split(":").map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    if (close === open) return false;
    if (close > open) return minutes >= open && minutes <= close;
    return minutes >= open || minutes <= close; // atravessa a meia-noite
  });
}