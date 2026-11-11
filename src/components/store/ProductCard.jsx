import { Plus } from "lucide-react";
import { Image } from "@/components/ui/image";
import { brl } from "@/lib/pedix";

export default function ProductCard({ item, isCombo, onSelect }) {
  const onPromo = !isCombo && item.promo_price_cents != null && item.promo_price_cents < item.price_cents;
  const price = onPromo ? item.promo_price_cents : item.price_cents;

  return (
    <button
      type="button"
      onClick={() => onSelect(item, isCombo)}
      className="flex min-h-[88px] w-full items-stretch gap-3 rounded-card border border-border/70 bg-card p-3 text-left transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">{item.name}</span>
          {isCombo && (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              Combo
            </span>
          )}
          {onPromo && (
            <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
              Promoção
            </span>
          )}
        </span>
        {item.description && (
          <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted-foreground">{item.description}</span>
        )}
        <span className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[14px] font-semibold text-foreground">{brl(price)}</span>
          {onPromo && (
            <span className="text-[12px] text-muted-foreground line-through">{brl(item.price_cents)}</span>
          )}
        </span>
      </span>

      <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-secondary">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fittingType="fill"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-[11px] text-muted-foreground">sem foto</span>
        )}
        <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-brand text-white shadow-md">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}