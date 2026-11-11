import { Clock, MapPin, ShoppingBag } from "lucide-react";
import { Image } from "@/components/ui/image";
import { brl, isWithinOpeningHours } from "@/lib/pedix";
import { cn } from "@/lib/utils";

function estimate(establishment) {
  const delivery = establishment.eta_delivery_min ?? 40;
  const pickup = establishment.eta_pickup_min ?? 20;
  const parts = [];
  if (establishment.delivery_enabled) parts.push(`Entrega ${delivery}–${delivery + 20} min`);
  if (establishment.pickup_enabled) parts.push(`Retirada ${pickup} min`);
  return parts.join(" · ");
}

export default function StoreHeader({ establishment, storefront, hours }) {
  const open = storefront.can_order;
  const eta = estimate(establishment);
  const initials = (establishment.name ?? "P")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <header>
      <div className="relative h-40 w-full overflow-hidden bg-secondary sm:h-48">
        {establishment.cover_url ? (
          <Image
            src={establishment.cover_url}
            alt={`Capa de ${establishment.name}`}
            fittingType="fill"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[#EDE6DD]" />
        )}
      </div>

      <div className="px-5">
        <div className="-mt-9 flex items-end gap-3">
          <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full border-4 border-card bg-brand text-lg font-semibold text-white">
            {establishment.logo_url ? (
              <Image
                src={establishment.logo_url}
                alt={`Logo de ${establishment.name}`}
                fittingType="fill"
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
        </div>

        <h1 className="mt-3 text-[22px] font-semibold leading-tight text-foreground">{establishment.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {establishment.neighborhood ? `${establishment.neighborhood} · ` : ""}
          {establishment.city} · {establishment.state}
        </p>
        {establishment.description && (
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{establishment.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 pb-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold",
              open ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", open ? "bg-success" : "bg-warning")} />
            {open ? "Aberto agora" : "Fechado"}
          </span>
          {eta && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {eta}
            </span>
          )}
          {establishment.min_order_cents > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground">
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              Mínimo {brl(establishment.min_order_cents)}
            </span>
          )}
        </div>

        {!open && (
          <div className="mb-4 rounded-btn border border-warning/30 bg-warning/[0.07] px-4 py-3 text-[13px] font-medium text-warning">
            {storefront.message}
          </div>
        )}
        {!open && hours?.length > 0 && storefront.code !== "SUSPENDED" && (
          <p className="mb-4 text-[12px] text-muted-foreground">
            {isWithinOpeningHours(hours) ? "A loja pausou os pedidos." : "Confira os horários abaixo."}
          </p>
        )}
      </div>
    </header>
  );
}