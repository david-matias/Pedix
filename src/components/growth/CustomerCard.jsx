import { Loader2, MessageCircle } from "lucide-react";
import { dateBR, formatPhone } from "@/lib/pedix";
import { cn } from "@/lib/utils";

const BADGE_STYLES = {
  NOVO: "bg-secondary text-foreground",
  RECORRENTE: "bg-success/10 text-success",
  INATIVO: "bg-warning/10 text-warning",
};

/** Ficha do cliente agrupada pelo WhatsApp, só desta loja. */
export default function CustomerCard({ customer, onMessage, busy }) {
  const inactive = customer.badge?.code === "INATIVO";

  return (
    <div className="rounded-card border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">{customer.name || "Cliente"}</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">{formatPhone(customer.whatsapp)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            BADGE_STYLES[customer.badge?.code] ?? "bg-secondary text-muted-foreground"
          )}
        >
          {customer.badge?.label ?? "Sem pedido"}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-btn bg-secondary/50 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pedidos</p>
          <p className="text-[14px] font-semibold text-foreground">{customer.completed_orders}</p>
        </div>
        <div className="rounded-btn bg-secondary/50 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Último</p>
          <p className="text-[12px] font-semibold text-foreground">
            {customer.last_order_at ? dateBR(customer.last_order_at) : "—"}
          </p>
        </div>
        <div className="rounded-btn bg-secondary/50 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pontos</p>
          <p className="text-[14px] font-semibold text-foreground">{customer.points}</p>
        </div>
      </div>

      {inactive && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onMessage(customer)}
          className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-btn border border-border bg-card text-[12.5px] font-semibold text-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Abrir mensagem
        </button>
      )}
    </div>
  );
}