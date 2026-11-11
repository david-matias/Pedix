import { MessageCircle } from "lucide-react";
import { brl, STATUS_LABELS } from "@/lib/pedix";
import { cn } from "@/lib/utils";

function minutesSince(iso) {
  const from = new Date(iso ?? Date.now()).getTime();
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.round((Date.now() - from) / 60000));
}

export default function DeliveryCard({ order, whatsappHref, busy, onAssign, onComplete }) {
  const dispatched = order.status === "OUT_FOR_DELIVERY";

  return (
    <article className="rounded-card border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">#{order.number}</p>
          <p className="text-[12.5px] text-foreground">{order.address_neighborhood || "Bairro não informado"}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {order.address_street}
            {order.address_reference ? ` · ${order.address_reference}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide",
            dispatched ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          )}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="font-semibold text-foreground">{brl(order.total_cents)}</span>
        <span className="text-muted-foreground">há {minutesSince(order.created_at)} min</span>
      </div>

      <p className="mt-2 text-[12px] text-foreground">
        {order.courier_name ? (
          <>
            Entregador: <span className="font-semibold">{order.courier_name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Sem entregador</span>
        )}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign(order)}
          className="min-h-[42px] rounded-btn bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {order.courier_name ? "Trocar entregador" : "Atribuir"}
        </button>
        {dispatched ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onComplete(order)}
            className="min-h-[42px] rounded-btn border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground disabled:opacity-50"
          >
            Concluir entrega
          </button>
        ) : (
          <span className="grid place-items-center rounded-btn border border-dashed border-border px-3 text-[11.5px] text-muted-foreground">
            Atribuir já despacha
          </span>
        )}
      </div>

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex min-h-[40px] items-center justify-center gap-1.5 rounded-btn border border-border bg-card text-[12px] font-medium text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Endereço no WhatsApp do entregador
        </a>
      )}
    </article>
  );
}