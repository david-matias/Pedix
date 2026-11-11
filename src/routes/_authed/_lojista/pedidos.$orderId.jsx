import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { advanceOrder, cancelOrder, getOrderDetail } from "@/lib/lojista-fns";
import { brl, dateTimeBR, formatPhone, NEXT_ACTION_LABELS, STATUS_LABELS, timeBR, waLink } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/pedidos/$orderId")({ component: OrderDetailPage });

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["lojista", "order", orderId],
    queryFn: () => getOrderDetail({ data: { order_id: orderId } }),
  });

  async function advance() {
    if (!data?.next_status) return;
    setBusy(true);
    setError("");
    const result = await advanceOrder({ data: { order_id: orderId, status: data.next_status } });
    if (result.status === "ok") {
      await queryClient.invalidateQueries({ queryKey: ["lojista"] });
    } else {
      setError(result.message ?? "Não foi possível avançar o pedido.");
    }
    setBusy(false);
  }

  async function confirmCancel() {
    if (reason.trim().length < 3) {
      setError("Escreva o motivo do cancelamento.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await cancelOrder({ data: { order_id: orderId, reason: reason.trim() } });
    if (result.status === "ok") {
      setCancelling(false);
      await queryClient.invalidateQueries({ queryKey: ["lojista"] });
    } else {
      setError(result.message ?? "Não foi possível cancelar.");
    }
    setBusy(false);
  }

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (data?.status !== "ok") {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[14px] font-medium text-foreground">Pedido não encontrado nesta loja.</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/pedidos" })}
          className="mt-4 text-[13px] font-semibold text-brand"
        >
          Voltar para os pedidos
        </button>
      </div>
    );
  }

  const { order, items, options, notifications, next_status: nextStatus } = data;
  const closed = order.status === "COMPLETED" || order.status === "CANCELLED";
  const notification = notifications[0];

  return (
    <div className="pb-32">
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/pedidos" })}
          aria-label="Voltar"
          className="grid h-11 w-11 place-items-center rounded-btn hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-foreground">Pedido #{order.number}</p>
          <p className="text-[11.5px] text-muted-foreground">{dateTimeBR(order.created_at)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            order.status === "CANCELLED"
              ? "bg-secondary text-muted-foreground"
              : order.status === "COMPLETED"
                ? "bg-success/10 text-success"
                : "bg-brand/10 text-brand"
          )}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="space-y-3 px-4 pt-3">
        {notification?.status === "FAILED" && (
          <p className="rounded-btn border border-warning/30 bg-warning/[0.08] px-3.5 py-2.5 text-[12px] font-medium text-warning">
            O aviso no WhatsApp não saiu. O pedido está salvo no painel.
          </p>
        )}

        <section className="rounded-card border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">{order.customer_name}</p>
              <p className="text-[12.5px] text-muted-foreground">{formatPhone(order.customer_whatsapp)}</p>
            </div>
            <a
              href={waLink(order.customer_whatsapp, `Olá, ${order.customer_name}! Sobre o seu pedido #${order.number} na ${data.store_name}:`)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[40px] items-center gap-1.5 rounded-btn bg-[#25D366] px-3 text-[12px] font-semibold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp
            </a>
          </div>
          <p className="mt-2 text-[12px] font-medium text-foreground">
            {order.fulfillment_type === "DELIVERY" ? "Entrega" : "Retirada"}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {order.fulfillment_type === "DELIVERY"
              ? `${order.address_street}, ${order.address_neighborhood}`
              : "Cliente retira na loja"}
            {order.address_reference ? ` · ${order.address_reference}` : ""}
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Pagamento: {order.payment_code === "CASH" ? "Dinheiro" : order.payment_code === "PIX" ? "Pix" : "Cartão na entrega"}
            {order.change_for_cents ? ` · troco para ${brl(order.change_for_cents)}` : ""}
          </p>
          {order.notes && (
            <p className="mt-2 rounded-btn bg-secondary/60 px-3 py-2 text-[12px] italic text-foreground">
              “{order.notes}”
            </p>
          )}
        </section>

        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Itens</h2>
          <ul className="mt-2 divide-y divide-border">
            {items.map((item) => {
              const itemOptions = options.filter((option) => option.order_item_id === item.id);
              return (
                <li key={item.id} className="py-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13.5px] font-medium text-foreground">
                      {item.quantity}x {item.product_name}
                      {item.is_combo && (
                        <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-brand">
                          combo
                        </span>
                      )}
                    </p>
                    <span className="shrink-0 text-[13px] font-medium text-foreground">
                      {brl(item.unit_price_cents * item.quantity)}
                    </span>
                  </div>
                  {itemOptions.length > 0 && (
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {itemOptions.map((option) => `${option.group_name}: ${option.option_name}`).join(" · ")}
                    </p>
                  )}
                  {item.notes && <p className="text-[11.5px] italic text-muted-foreground">“{item.notes}”</p>}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 space-y-1 border-t border-border pt-2 text-[12.5px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="text-foreground">{brl(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de entrega</span>
              <span className="text-foreground">{brl(order.delivery_fee_cents)}</span>
            </div>
            {Number(order.discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-success">
                <span>{order.coupon_code ? `Cupom ${order.coupon_code}` : "Desconto"}</span>
                <span>−{brl(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-[14.5px] font-semibold text-foreground">
              <span>Total</span>
              <span>{brl(order.total_cents)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Histórico</h2>
          <ol className="mt-2 space-y-1.5">
            {(order.status_history ?? []).map((entry, index) => (
              <li key={`${entry.status}-${index}`} className="flex items-center justify-between text-[12.5px]">
                <span className="text-foreground">{STATUS_LABELS[entry.status] ?? entry.status}</span>
                <span className="text-muted-foreground">{timeBR(entry.at)}</span>
              </li>
            ))}
          </ol>
          {order.cancel_reason && (
            <p className="mt-2 text-[12px] text-muted-foreground">Motivo: {order.cancel_reason}</p>
          )}
        </section>

        {error && (
          <p className="rounded-btn border border-brand/30 bg-brand/[0.06] px-3.5 py-2.5 text-[12.5px] font-medium text-brand">
            {error}
          </p>
        )}

        {cancelling && (
          <section className="rounded-card border border-brand/30 bg-card p-4">
            <label htmlFor="cancel-reason" className="text-[12.5px] font-semibold text-foreground">
              Motivo do cancelamento
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              className="mt-1.5 min-h-[64px] w-full resize-none rounded-btn border border-input px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={confirmCancel}
                disabled={busy}
                className="min-h-[44px] flex-1 rounded-btn bg-brand text-[13px] font-semibold text-white disabled:opacity-50"
              >
                Confirmar cancelamento
              </button>
              <button
                type="button"
                onClick={() => setCancelling(false)}
                className="min-h-[44px] flex-1 rounded-btn border border-border text-[13px] font-medium text-foreground"
              >
                Voltar
              </button>
            </div>
          </section>
        )}
      </div>

      {!closed && !cancelling && (
        <div className="fixed inset-x-0 bottom-[70px] z-20 mx-auto w-full max-w-[520px] border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={advance}
              disabled={busy || !nextStatus}
              className="min-h-[48px] flex-1 rounded-btn bg-brand px-4 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Salvando..." : NEXT_ACTION_LABELS[nextStatus] ?? "Avançar"}
            </button>
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className="min-h-[48px] rounded-btn border border-border px-4 text-[13px] font-medium text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}