import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ProductModal from "@/components/store/ProductModal";
import { resolveLine } from "@/components/store/cart-utils";
import { brl } from "@/lib/pedix";

/** Mesmo modal do cardápio: variação, adicional, máximo e observação. */
export default function ProductPickerSheet({ open, onOpenChange, catalog, onAdd }) {
  const [selection, setSelection] = useState(null);

  const categories = catalog.categories ?? [];
  const products = catalog.products ?? [];
  const combos = catalog.combos ?? [];

  function pick(item, isCombo) {
    setSelection({ item, isCombo });
  }

  function confirm(payload) {
    const line = resolveLine(catalog, {
      kind: payload.kind,
      ref_id: payload.ref_id,
      option_ids: payload.option_ids,
    });
    setSelection(null);
    onAdd(payload, line.unit);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-[20px] border-t-0 p-0 sm:mx-auto sm:max-w-[430px]"
        >
          <div className="mx-auto w-full max-w-[430px] px-4 pb-10 pt-4">
            <SheetTitle className="text-[17px] font-semibold text-foreground">Lançar item</SheetTitle>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              O preço é copiado do cardápio no momento do lançamento.
            </p>

            {combos.length > 0 && (
              <section className="mt-4">
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Combos</h3>
                <div className="mt-1.5 space-y-1.5">
                  {combos.map((combo) => (
                    <button
                      key={combo.id}
                      type="button"
                      onClick={() => pick(combo, true)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-btn border border-border bg-card px-3.5 text-left"
                    >
                      <span className="min-w-0 truncate text-[13.5px] text-foreground">{combo.name}</span>
                      <span className="shrink-0 text-[12.5px] font-semibold text-muted-foreground">
                        {brl(combo.price_cents)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {categories.map((category) => {
              const list = products.filter((product) => product.category_id === category.id);
              if (list.length === 0) return null;
              return (
                <section key={category.id} className="mt-4">
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {category.name}
                  </h3>
                  <div className="mt-1.5 space-y-1.5">
                    {list.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => pick(product, false)}
                        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-btn border border-border bg-card px-3.5 text-left"
                      >
                        <span className="min-w-0 truncate text-[13.5px] text-foreground">{product.name}</span>
                        <span className="shrink-0 text-[12.5px] font-semibold text-muted-foreground">
                          {brl(product.promo_price_cents ?? product.price_cents)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <ProductModal
        open={Boolean(selection)}
        onOpenChange={(next) => {
          if (!next) setSelection(null);
        }}
        selection={selection}
        catalog={catalog}
        onAdd={confirm}
      />
    </>
  );
}