import { brl } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export function FulfillmentChoice({ establishment, value, onChange }) {
  const options = [
    { code: "DELIVERY", label: "Entrega", hint: `${establishment.eta_delivery_min ?? 40}–${(establishment.eta_delivery_min ?? 40) + 20} min`, enabled: establishment.delivery_enabled },
    { code: "PICKUP", label: "Retirada", hint: `${establishment.eta_pickup_min ?? 20} min`, enabled: establishment.pickup_enabled },
  ].filter((option) => option.enabled);

  return (
    <div className={cn("grid gap-3", options.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => onChange(option.code)}
          className={cn(
            "flex min-h-[84px] flex-col items-start justify-center rounded-card border-2 px-4 py-3 text-left transition-colors",
            value === option.code ? "border-brand bg-brand/[0.04]" : "border-border bg-card"
          )}
        >
          <span className="text-[15px] font-semibold text-foreground">{option.label}</span>
          <span className="mt-0.5 text-[12px] text-muted-foreground">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function DeliveryFields({ zones, neighborhood, onNeighborhood, street, onStreet, reference, onReference }) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="street" className="text-[13px] font-semibold text-foreground">
          Rua e número
        </label>
        <input
          id="street"
          value={street}
          onChange={(event) => onStreet(event.target.value)}
          placeholder="Rua Beira Mar, 120"
          className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </div>
      <div>
        <label htmlFor="neighborhood" className="text-[13px] font-semibold text-foreground">
          Bairro
        </label>
        <select
          id="neighborhood"
          value={neighborhood}
          onChange={(event) => onNeighborhood(event.target.value)}
          className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input bg-card px-3 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Escolha o bairro</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.neighborhood}>
              {zone.neighborhood} · {brl(zone.fee_cents)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="reference" className="text-[13px] font-semibold text-foreground">
          Ponto de referência
        </label>
        <input
          id="reference"
          value={reference}
          onChange={(event) => onReference(event.target.value)}
          placeholder="Perto da praça, portão azul"
          className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </div>
    </div>
  );
}

export function PaymentFields({ payments, value, onChange, changeFor, onChangeFor }) {
  const cashSelected = value === "CASH";
  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <button
          key={payment.id}
          type="button"
          onClick={() => onChange(payment.code)}
          className={cn(
            "flex min-h-[52px] w-full items-center gap-3 rounded-btn border px-3.5 text-left",
            value === payment.code ? "border-brand bg-brand/[0.04]" : "border-border bg-card"
          )}
        >
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
              value === payment.code ? "border-brand bg-brand" : "border-border"
            )}
          >
            {value === payment.code && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <span className="text-[14px] font-medium text-foreground">{payment.label}</span>
        </button>
      ))}

      {cashSelected && (
        <div className="rounded-btn border border-border bg-secondary/40 p-3">
          <label htmlFor="change-for" className="text-[13px] font-semibold text-foreground">
            Troco para quanto?
          </label>
          <input
            id="change-for"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={changeFor}
            onChange={(event) => onChangeFor(event.target.value)}
            placeholder="Deixe vazio se não precisar de troco"
            className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
      )}
    </div>
  );
}