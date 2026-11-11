import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { brl } from "@/lib/pedix";
import { cartTotals, optionsSummary, resolveLine } from "@/components/store/cart-utils";

export default function CartSheet({
  open,
  onOpenChange,
  catalog,
  items,
  onQuantity,
  onRemove,
  notes,
  onNotes,
  onContinue,
  banner,
  canOrder,
}) {
  const totals = cartTotals(catalog, items);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[20px] border-t-0 p-0 sm:mx-auto sm:max-w-[430px]"
      >
        <div className="mx-auto w-full max-w-[430px] px-5 pb-8 pt-2">
          <SheetTitle className="mt-2 text-[20px] font-semibold text-foreground">Sua sacola</SheetTitle>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{catalog.establishment_name}</p>

          {banner && (
            <div className="mt-3 rounded-btn border border-warning/30 bg-warning/[0.08] px-3.5 py-2.5 text-[12.5px] font-medium text-warning">
              {banner}
            </div>
          )}

          {items.length === 0 ? (
            <div className="mt-8 rounded-card border border-dashed border-border px-4 py-10 text-center">
              <p className="text-[14px] font-medium text-foreground">Sua sacola está vazia.</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Toque em um item do cardápio para começar o pedido.
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-border">
                {items.map((item) => {
                  const line = resolveLine(catalog, item);
                  return (
                    <li key={item.key} className="py-3.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[14.5px] font-semibold text-foreground">
                            {item.quantity}x {line.name}
                          </p>
                          {line.options.length > 0 && (
                            <p className="mt-0.5 text-[12px] text-muted-foreground">{optionsSummary(line.options)}</p>
                          )}
                          {item.notes && (
                            <p className="mt-0.5 text-[12px] italic text-muted-foreground">“{item.notes}”</p>
                          )}
                          <p className="mt-1 text-[13.5px] font-semibold text-foreground">
                            {brl(line.unit * item.quantity)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <div className="inline-flex items-center rounded-btn border border-border">
                            <button
                              type="button"
                              aria-label="Diminuir"
                              onClick={() => onQuantity(item.key, item.quantity - 1)}
                              className="grid h-10 w-10 place-items-center text-foreground disabled:opacity-40"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span className="w-5 text-center text-[13px] font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Aumentar"
                              onClick={() => onQuantity(item.key, item.quantity + 1)}
                              className="grid h-10 w-10 place-items-center text-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remover ${line.name}`}
                            onClick={() => onRemove(item.key)}
                            className="grid h-10 w-9 place-items-center rounded-btn text-muted-foreground hover:text-brand"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4">
                <label htmlFor="order-notes" className="text-[13px] font-semibold text-foreground">
                  Observação do pedido
                </label>
                <textarea
                  id="order-notes"
                  value={notes}
                  maxLength={300}
                  onChange={(event) => onNotes(event.target.value)}
                  placeholder="Ex.: entregar na portaria, sem talheres..."
                  className="mt-2 min-h-[64px] w-full resize-none rounded-btn border border-input bg-card px-3 py-2.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[14px] text-muted-foreground">Subtotal</span>
                <span className="text-[16px] font-semibold text-foreground">{brl(totals.subtotal)}</span>
              </div>

              <button
                type="button"
                onClick={onContinue}
                disabled={!canOrder || items.length === 0}
                className="mt-4 min-h-[52px] w-full rounded-btn bg-brand px-5 text-[15px] font-semibold text-white disabled:opacity-50"
              >
                Continuar
              </button>
              {!canOrder && (
                <p className="mt-2 text-center text-[12px] font-medium text-warning">
                  A loja não está recebendo pedidos agora.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}