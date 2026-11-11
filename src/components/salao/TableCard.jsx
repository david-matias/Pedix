import { brl, TABLE_STATUS_LABELS } from "@/lib/pedix";
import { cn } from "@/lib/utils";
import { AREA_LABELS, minutesAgo, tableStatus } from "@/components/salao/minutes";

const STATUS_STYLES = {
  LIVRE: "border-border bg-secondary text-muted-foreground",
  OCUPADA: "border-brand/25 bg-brand/10 text-brand",
  CONTA: "border-warning/30 bg-warning/10 text-warning",
};

export default function TableCard({ table, busy, onOpen }) {
  const status = tableStatus(table);
  const occupied = status !== "LIVRE";

  return (
    <button
      type="button"
      onClick={() => onOpen(table)}
      disabled={busy}
      className={cn(
        "flex w-full flex-col rounded-card border bg-card p-3.5 text-left transition-colors",
        status === "CONTA" ? "border-warning/40" : status === "OCUPADA" ? "border-brand/30" : "border-border",
        busy && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold leading-none text-foreground">
            {table.name?.trim() || `Mesa ${table.number}`}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {table.seats ?? 4} lugares · {AREA_LABELS[table.area] ?? "Salão"}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLES[status])}>
          {TABLE_STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-2.5">
        {occupied ? (
          <>
            <p className="text-[15px] font-semibold text-foreground">{brl(table.comanda.total_cents)}</p>
            <p className="text-[11px] text-muted-foreground">{minutesAgo(table.comanda.opened_at)}</p>
          </>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">Toque para abrir a comanda</p>
        )}
      </div>
    </button>
  );
}