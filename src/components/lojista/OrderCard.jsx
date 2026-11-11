import { brl, STATUS_LABELS } from "@/lib/pedix";
import { cn } from "@/lib/utils";

function minutesAgo(iso) {
  const created = new Date(iso).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60000));
  if (minutes < 1) return "agora";
  if (minutes === 1) return "há 1 min";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "há 1 h" : `há ${hours} h`;
}

function channelBadge(order) {
  if (order.order_channel === "TABLE") return order.table_number ? `Mesa ${order.table_number}` : "Mesa";
  if (order.order_channel === "COUNTER") return "Balcão";
  // Em Encerrados o selo é do canal; nos pedidos ao vivo, a forma de consumo.
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return "Delivery";
  return order.fulfillment_type === "DELIVERY" ? "Entrega" : "Retirada";
}

export default function OrderCard({ order, highlighted, onOpen }) {
  const items = order.items ?? [];
  const first = items[0];
  const extra = items.length > 1 ? ` · +${items.length - 1}` : "";

  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className={cn(
        "w-full rounded-card border bg-card p-3.5 text-left transition-colors",
        order.status === "RECEIVED" ? "border-brand" : "border-border",
        highlighted && "ring-2 ring-brand/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">
            #{order.number}
            <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">{minutesAgo(order.created_at)}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] text-foreground">{order.customer_name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[14.5px] font-semibold text-foreground">{brl(order.total_cents)}</p>
          <p className="text-[11px] text-muted-foreground">{STATUS_LABELS[order.status]}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
            order.order_channel === "TABLE"
              ? "bg-brand/10 text-brand"
              : order.order_channel === "COUNTER"
                ? "bg-warning/10 text-warning"
                : order.fulfillment_type === "DELIVERY"
                  ? "bg-brand/10 text-brand"
                  : "bg-secondary text-foreground"
          )}
        >
          {channelBadge(order)}
        </span>
        {first && (
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            {first.quantity}x {first.product_name}
            {extra}
          </span>
        )}
      </div>
    </button>
  );
}