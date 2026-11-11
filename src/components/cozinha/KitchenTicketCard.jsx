import { Check, ChefHat, Clock } from "lucide-react";
import { timeBR } from "@/lib/pedix";
import { cn } from "@/lib/utils";

function minutesSince(iso) {
  const from = new Date(iso ?? Date.now()).getTime();
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.round((Date.now() - from) / 60000));
}

/** Uma ficha: quantidade, item, opções, observação, de onde veio e há quanto tempo. */
export default function KitchenTicketCard({ ticket, onAdvance, busy }) {
  const done = ticket.status === "DONE";

  return (
    <article
      className={cn(
        "rounded-card border bg-card p-3.5",
        ticket.status === "QUEUED" ? "border-border" : "border-brand/30"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-btn bg-secondary text-[13px] font-bold text-foreground">
          {ticket.quantity}x
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-snug text-foreground">{ticket.item_name}</p>
          {ticket.options_text && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{ticket.options_text}</p>
          )}
          {ticket.notes && <p className="mt-0.5 text-[12px] italic text-foreground">“{ticket.notes}”</p>}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <ChefHat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{ticket.origin_label}</span>
        </span>
        {done ? (
          <span className="flex shrink-0 items-center gap-1 text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {timeBR(ticket.done_at)}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            há {minutesSince(ticket.created_at)} min
          </span>
        )}
      </div>

      {!done && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAdvance(ticket)}
          className={cn(
            "mt-3 flex min-h-[44px] w-full items-center justify-center rounded-btn px-4 text-[13.5px] font-semibold disabled:opacity-50",
            ticket.status === "QUEUED" ? "bg-brand text-white" : "border border-border bg-card text-foreground"
          )}
        >
          {ticket.status === "QUEUED" ? "Iniciar preparo" : "Marcar pronto"}
        </button>
      )}
    </article>
  );
}