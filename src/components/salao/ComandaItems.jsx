import { Minus, Plus, Trash2 } from "lucide-react";
import { brl, timeBR } from "@/lib/pedix";
import { cn } from "@/lib/utils";

function optionsFor(options, itemId) {
  return options.filter((option) => option.order_item_id === itemId);
}

export default function ComandaItems({ items, options, editable, busy, onQuantity, onRemove }) {
  const active = items.filter((item) => item.removed !== true);
  const removed = items.filter((item) => item.removed === true);

  return (
    <div className="mt-3">
      {active.length === 0 ? (
        <div className="rounded-card border border-dashed border-border px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-foreground">Nenhum item lançado ainda.</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">Use “Lançar item” para começar a comanda.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {active.map((item) => {
            const chosen = optionsFor(options, item.id);
            return (
              <li key={item.id} className="flex items-start gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold leading-snug text-foreground">{item.product_name}</p>
                  {chosen.length > 0 && (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {chosen.map((option) => option.option_name).join(", ")}
                    </p>
                  )}
                  {item.notes && <p className="mt-0.5 text-[11.5px] italic text-muted-foreground">{item.notes}</p>}
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {item.quantity} × {brl(item.unit_price_cents)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[13.5px] font-semibold text-foreground">{brl(item.line_total_cents)}</p>
                  {editable && (
                    <div className="mt-1.5 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Diminuir ${item.product_name}`}
                        disabled={busy || item.quantity <= 1}
                        onClick={() => onQuantity(item, item.quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-btn border border-border text-foreground disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Aumentar ${item.product_name}`}
                        disabled={busy}
                        onClick={() => onQuantity(item, item.quantity + 1)}
                        className="grid h-8 w-8 place-items-center rounded-btn border border-border text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover ${item.product_name}`}
                        disabled={busy}
                        onClick={() => onRemove(item)}
                        className="grid h-8 w-8 place-items-center rounded-btn border border-border text-brand"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {removed.length > 0 && (
        <div className="mt-3 rounded-card border border-dashed border-border px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Removidos</p>
          <ul className="mt-1.5 space-y-1">
            {removed.map((item) => (
              <li key={item.id} className={cn("text-[11.5px] leading-relaxed text-muted-foreground line-through")}>
                {item.quantity} × {item.product_name} — {brl(item.line_total_cents)}
                <span className="ml-1 no-underline">
                  · {item.removed_by ?? "loja"}
                  {item.removed_at ? ` às ${timeBR(item.removed_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}