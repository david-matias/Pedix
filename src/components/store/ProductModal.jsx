import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { brl } from "@/lib/pedix";
import { cn } from "@/lib/utils";

const MAX_NOTE = 140;

function Stepper({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-btn border border-border p-1">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-11 w-11 place-items-center rounded-[9px] text-foreground hover:bg-secondary disabled:opacity-40"
        disabled={value <= 1}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={() => onChange(value + 1)}
        className="grid h-11 w-11 place-items-center rounded-[9px] text-foreground hover:bg-secondary"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ProductModal({ open, onOpenChange, selection, catalog, onAdd }) {
  const { item, isCombo } = selection ?? {};
  const [quantity, setQuantity] = useState(1);
  const [chosen, setChosen] = useState([]);
  const [notes, setNotes] = useState("");

  const groups = useMemo(() => {
    if (!item || isCombo) return [];
    return catalog.option_groups
      .filter((group) => group.product_id === item.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((group) => ({
        ...group,
        options: catalog.options
          .filter((option) => option.group_id === group.id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));
  }, [catalog, item, isCombo]);

  const comboProducts = useMemo(() => {
    if (!item || !isCombo) return [];
    return catalog.combo_items
      .filter((entry) => entry.combo_id === item.id)
      .map((entry) => ({
        quantity: entry.quantity,
        name: catalog.products.find((product) => product.id === entry.product_id)?.name ?? entry.product_name,
      }));
  }, [catalog, item, isCombo]);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setNotes("");
    setChosen(() => {
      const initial = [];
      for (const group of groups) {
        if (group.required && group.options[0] && group.selection === "SINGLE") initial.push(group.options[0].id);
      }
      return initial;
    });
  }, [open, item?.id]);

  const deltas = chosen.reduce((sum, id) => {
    const option = catalog.options.find((o) => o.id === id);
    return sum + (option?.price_delta_cents ?? 0);
  }, 0);

  const basePrice = isCombo ? item?.price_cents ?? 0 : item?.promo_price_cents ?? item?.price_cents ?? 0;
  const unit = basePrice + deltas;
  const lineTotal = unit * quantity;

  const missingRequired = groups.some(
    (group) => group.required && !chosen.some((id) => group.options.some((option) => option.id === id))
  );

  function toggle(group, option) {
    setChosen((prev) => {
      if (group.selection === "SINGLE") {
        const withoutGroup = prev.filter((id) => !group.options.some((o) => o.id === id));
        return [...withoutGroup, option.id];
      }
      if (prev.includes(option.id)) return prev.filter((id) => id !== option.id);
      const inGroup = prev.filter((id) => group.options.some((o) => o.id === id));
      const max = Math.max(1, group.max_select ?? 99);
      if (inGroup.length >= max) return prev;
      return [...prev, option.id];
    });
  }

  function submit() {
    if (missingRequired) return;
    onAdd({
      kind: isCombo ? "combo" : "product",
      ref_id: item.id,
      quantity,
      option_ids: chosen,
      notes: notes.slice(0, MAX_NOTE),
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[20px] border-t-0 p-0 sm:mx-auto sm:max-w-[430px]"
      >
        {item && (
          <div className="mx-auto w-full max-w-[430px] pb-28">
            <div className="relative h-44 w-full overflow-hidden bg-secondary">
              {item.image_url ? (
                <Image src={item.image_url} alt={item.name} fittingType="fill" className="h-full w-full object-cover" />
              ) : null}
            </div>

            <div className="px-5 pt-4">
              <SheetTitle className="text-[20px] font-semibold leading-tight text-foreground">{item.name}</SheetTitle>
              {item.description && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{item.description}</p>
              )}
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-[16px] font-semibold text-foreground">{brl(basePrice)}</span>
                {!isCombo && item.promo_price_cents != null && item.promo_price_cents < item.price_cents && (
                  <span className="text-[13px] text-muted-foreground line-through">{brl(item.price_cents)}</span>
                )}
              </p>

              {isCombo && comboProducts.length > 0 && (
                <div className="mt-4 rounded-card border border-border bg-secondary/50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    O combo inclui
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {comboProducts.map((entry) => (
                      <li key={entry.name} className="text-[13px] text-foreground">
                        {entry.quantity}x {entry.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">Preço fechado do combo.</p>
                </div>
              )}

              {groups.map((group) => {
                const inGroup = chosen.filter((id) => group.options.some((option) => option.id === id));
                const max = Math.max(1, group.max_select ?? 99);
                return (
                  <fieldset key={group.id} className="mt-5">
                    <legend className="flex w-full items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold text-foreground">{group.name}</span>
                      <span
                        className={cn(
                          "text-[11.5px] font-medium",
                          group.required && inGroup.length === 0 ? "text-brand" : "text-muted-foreground"
                        )}
                      >
                        {group.required ? "obrigatório" : group.selection === "MULTIPLE" ? `escolha até ${max}` : "opcional"}
                      </span>
                    </legend>
                    <div className="mt-2 space-y-2">
                      {group.options.map((option) => {
                        const active = chosen.includes(option.id);
                        const blocked = !active && group.selection === "MULTIPLE" && inGroup.length >= max;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggle(group, option)}
                            disabled={blocked}
                            className={cn(
                              "flex min-h-[52px] w-full items-center gap-3 rounded-btn border px-3 py-2.5 text-left transition-colors",
                              active ? "border-brand bg-brand/[0.04]" : "border-border bg-card",
                              blocked && "opacity-40"
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-5 w-5 shrink-0 place-items-center border-2",
                                group.selection === "SINGLE" ? "rounded-full" : "rounded-[5px]",
                                active ? "border-brand bg-brand" : "border-border"
                              )}
                            >
                              {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{option.name}</span>
                            <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
                              {option.price_delta_cents > 0 ? `+ ${brl(option.price_delta_cents)}` : "grátis"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              <div className="mt-5">
                <label htmlFor="product-notes" className="text-[14px] font-semibold text-foreground">
                  Observação
                </label>
                <textarea
                  id="product-notes"
                  value={notes}
                  maxLength={MAX_NOTE}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: sem cebola, ponto da carne..."
                  className="mt-2 min-h-[64px] w-full resize-none rounded-btn border border-input bg-card px-3 py-2.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {notes.length}/{MAX_NOTE}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Stepper value={quantity} onChange={setQuantity} />
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-5 py-3 backdrop-blur sm:relative sm:mt-5 sm:border-0 sm:bg-transparent sm:px-5 sm:pb-5 sm:backdrop-blur-none">
              <button
                type="button"
                onClick={submit}
                disabled={missingRequired}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-btn bg-brand px-5 text-[15px] font-semibold text-white transition-opacity disabled:opacity-50"
              >
                <span>Adicionar</span>
                <span>{brl(lineTotal)}</span>
              </button>
              {missingRequired && (
                <p className="mt-2 text-center text-[12px] font-medium text-brand">
                  Escolha uma opção obrigatória para continuar.
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}