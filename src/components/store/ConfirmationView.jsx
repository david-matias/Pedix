import { Check, MessageCircle } from "lucide-react";
import { brl, formatPhone, STATUS_FLOW, STATUS_LABELS, timeBR, waLink } from "@/lib/pedix";
import { buildOrderMessage } from "@/components/store/cart-utils";

export default function ConfirmationView({ result, onNewOrder }) {
  const { order, items, establishment, notification, lines } = result;
  const failed = notification?.status === "FAILED";

  const message = buildOrderMessage({
    order,
    establishment,
    lines: (lines ?? []).map((line) => ({
      product_name: line.name,
      quantity: line.quantity,
      unit_price_cents: line.unit_price_cents,
      options: (line.options ?? []).map((option) => ({ name: option.option_name })),
    })),
  });

  const flow = STATUS_FLOW[order.fulfillment_type] ?? STATUS_FLOW.DELIVERY;
  const history = new Map((order.status_history ?? []).map((entry) => [entry.status, entry.at]));
  const paymentLabel =
    order.payment_code === "CASH" ? "Dinheiro" : order.payment_code === "PIX" ? "Pix" : "Cartão na entrega";

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="border-b border-border bg-card px-5 pb-6 pt-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
          <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
        </div>
        <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Pedido confirmado
        </p>
        <p className="mt-1 text-[34px] font-semibold leading-none text-foreground">Pedido {order.number}</p>
        <p className="mt-2 text-[13.5px] text-muted-foreground">{establishment.name}</p>
      </div>

      {failed && (
        <div className="mx-5 mt-4 rounded-card border border-warning/30 bg-warning/[0.08] px-4 py-3 text-[13px] leading-relaxed text-warning">
          Pedido confirmado. O aviso no WhatsApp não saiu, mas a loja já recebeu o pedido no painel.
        </div>
      )}

      <div className="space-y-4 px-5 pt-4">
        <section className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-muted-foreground">
              {order.fulfillment_type === "DELIVERY" ? "Entrega" : "Retirada"}
            </span>
            <span className="font-medium text-foreground">{paymentLabel}</span>
          </div>
          <p className="mt-2 text-[13.5px] text-foreground">
            {order.fulfillment_type === "DELIVERY"
              ? `${order.address_street}, ${order.address_neighborhood}`
              : `${establishment.street}${establishment.neighborhood ? ` — ${establishment.neighborhood}` : ""}`}
          </p>
          {order.address_reference && (
            <p className="text-[12.5px] text-muted-foreground">{order.address_reference}</p>
          )}
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Cliente: {order.customer_name} · {formatPhone(order.customer_whatsapp)}
          </p>
        </section>

        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Itens</h2>
          <ul className="mt-2 divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-foreground">
                    {item.quantity}x {item.product_name}
                  </p>
                  {item.notes && <p className="text-[11.5px] italic text-muted-foreground">“{item.notes}”</p>}
                </div>
                <span className="shrink-0 text-[13px] font-medium text-foreground">
                  {brl(item.unit_price_cents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-border pt-2 text-[13px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="text-foreground">{brl(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de entrega</span>
              <span className="text-foreground">{order.delivery_fee_cents ? brl(order.delivery_fee_cents) : "Grátis"}</span>
            </div>
            {Number(order.discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-success">
                <span>{order.coupon_code ? `Cupom ${order.coupon_code}` : "Desconto"}</span>
                <span>−{brl(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-[15px] font-semibold text-foreground">
              <span>Total</span>
              <span>{brl(order.total_cents)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Acompanhe o pedido
          </h2>
          <ol className="mt-3 space-y-3">
            {flow.map((status) => {
              const at = history.get(status);
              return (
                <li key={status} className="flex items-center gap-3">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      at ? "border-success bg-success text-white" : "border-border"
                    }`}
                  >
                    {at && <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden="true" />}
                  </span>
                  <span className={`flex-1 text-[13.5px] ${at ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {at && <span className="text-[11.5px] text-muted-foreground">{timeBR(at)}</span>}
                </li>
              );
            })}
          </ol>
          {order.status === "CANCELLED" && (
            <p className="mt-3 rounded-btn bg-secondary px-3 py-2 text-[12.5px] font-medium text-foreground">
              Pedido cancelado{order.cancel_reason ? `: ${order.cancel_reason}` : "."}
            </p>
          )}
        </section>

        <a
          href={waLink(establishment.whatsapp, message)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-btn bg-[#25D366] px-5 text-[15px] font-semibold text-white"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" /> Avisar no WhatsApp
        </a>

        <button
          type="button"
          onClick={onNewOrder}
          className="min-h-[48px] w-full rounded-btn border border-border bg-card px-5 text-[14px] font-medium text-foreground"
        >
          Voltar ao cardápio
        </button>
      </div>
    </div>
  );
}