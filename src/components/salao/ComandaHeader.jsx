import { brl, STATUS_LABELS } from "@/lib/pedix";
import { AREA_LABELS, minutesAgo } from "@/components/salao/minutes";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  ABERTA: "bg-secondary text-foreground",
  CONTA: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-secondary text-muted-foreground",
};

export default function ComandaHeader({ order, table }) {
  const isTable = order.order_channel === "TABLE";
  const title = isTable
    ? table?.name?.trim() || `Mesa ${table?.number ?? ""}`.trim()
    : order.customer_name && order.customer_name !== "Balcão"
      ? order.customer_name
      : "Balcão";

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {isTable ? "Comanda de mesa" : "Pedido de balcão"} · #{order.number}
          </p>
          <h1 className="mt-1 truncate text-[20px] font-semibold leading-tight text-foreground">{title}</h1>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {isTable
              ? `${table?.seats ?? 4} lugares · ${AREA_LABELS[table?.area] ?? "Salão"}`
              : "Sem mesa"}{" "}
            · aberta {minutesAgo(order.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
            STATUS_STYLES[order.status] ?? "bg-secondary text-muted-foreground"
          )}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <p className="mt-3 border-t border-border pt-2.5 text-[13px] text-muted-foreground">
        Total parcial <span className="font-semibold text-foreground">{brl(order.total_cents ?? 0)}</span>
      </p>
    </div>
  );
}