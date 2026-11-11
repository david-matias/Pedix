import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import OrderCard from "@/components/lojista/OrderCard";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { base44 } from "@/api/base44Client";
import { getStoreOrders } from "@/lib/lojista-fns";
import { brl, isSalaoOrder, ORDER_TABS, timeWithSecondsBR } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/pedidos/")({ component: OrdersPage });

// Comanda não entra em Novos / Em preparo / A caminho: só em aberto e encerradas.
const SALAO_TABS = [
  { key: "open", label: "Em aberto", statuses: ["ABERTA", "CONTA"] },
  { key: "done", label: "Encerrados", statuses: ["COMPLETED", "CANCELLED"] },
];

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors",
        checked ? "bg-success" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[23px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: context, refetch: refetchContext } = useLojista();
  const [tab, setTab] = useState("new");
  const [channel, setChannel] = useState("DELIVERY");
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState([]);
  const knownIds = useRef(null);
  const expectHighlight = useRef(false);

  const ordersQuery = useQuery({
    queryKey: ["lojista", "orders"],
    queryFn: () => getStoreOrders(),
    refetchInterval: offline ? false : 8000,
    enabled: context?.status === "ok",
  });

  const orders = ordersQuery.data?.orders ?? [];

  useEffect(() => {
    if (!ordersQuery.data) return;
    const ids = orders.map((order) => order.id);
    if (knownIds.current === null) {
      knownIds.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !knownIds.current.has(id));
    knownIds.current = new Set(ids);
    if (fresh.length > 0 && expectHighlight.current) {
      expectHighlight.current = false;
      setHighlight(fresh);
      const timer = setTimeout(() => setHighlight([]), 6000);
      return () => clearTimeout(timer);
    }
  }, [ordersQuery.data, orders]);

  async function toggleOpen(next) {
    if (!context?.establishment) return;
    setSaving(true);
    await base44.entities.Establishment.update(context.establishment.id, { is_open: next });
    await refetchContext();
    setSaving(false);
  }

  async function sync() {
    // Ao religar a conexão, o que chegou nesse intervalo entra destacado por 6s.
    await ordersQuery.refetch();
  }

  function toggleOffline(next) {
    setOffline(next);
    if (!next) expectHighlight.current = true;
  }

  const hasSalao = (context?.enabled_modules ?? []).includes("MESAS");
  const tabs = channel === "SALAO" ? SALAO_TABS : ORDER_TABS;

  function selectChannel(next) {
    setChannel(next);
    setTab(next === "SALAO" ? "open" : "new");
  }

  function inChannel(order) {
    return channel === "SALAO" ? isSalaoOrder(order) : !isSalaoOrder(order);
  }

  // Encerrados reúne os dois canais: mesa, balcão e delivery.
  function countFor(entry) {
    return orders.filter(
      (order) => entry.statuses.includes(order.status) && (entry.key === "done" || inChannel(order))
    ).length;
  }

  const visible = orders.filter(
    (order) =>
      (tabs.find((entry) => entry.key === tab)?.statuses ?? []).includes(order.status) &&
      (tab === "done" || inChannel(order))
  );
  const updatedAt = ordersQuery.dataUpdatedAt ? new Date(ordersQuery.dataUpdatedAt).toISOString() : null;

  return (
    <div className="px-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Pedidos</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium">
            <span className={cn("h-2 w-2 rounded-full", offline ? "bg-brand" : "bg-success")} />
            <span className={offline ? "text-brand" : "text-success"}>{offline ? "Sem conexão" : "Ao vivo"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          className="flex min-h-[40px] items-center gap-1.5 rounded-btn border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", ordersQuery.isFetching && "animate-spin")} aria-hidden="true" />
          Sincronizar
        </button>
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">
        {updatedAt ? `Atualizado às ${timeWithSecondsBR(updatedAt)}` : "Buscando pedidos..."}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-border bg-card px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Recebendo pedidos</p>
          <p className="text-[11px] text-muted-foreground">
            {context?.establishment?.is_open ? "A loja aceita pedidos agora." : "Pausada para o público."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
          <Switch
            checked={Boolean(context?.establishment?.is_open)}
            onChange={toggleOpen}
            label="Recebendo pedidos"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 rounded-card border border-dashed border-border px-3.5 py-2.5">
        <p className="text-[11.5px] text-muted-foreground">Simular sem conexão</p>
        <Switch checked={offline} onChange={toggleOffline} label="Simular sem conexão" />
      </div>
      {offline && (
        <p className="mt-2 rounded-btn bg-brand/[0.06] px-3 py-2 text-[11.5px] leading-relaxed text-brand">
          Sem conexão. Os pedidos feitos agora entram quando você sincronizar.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-card px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pedidos hoje</p>
          <p className="mt-1 text-[20px] font-semibold text-foreground">{ordersQuery.data?.today?.count ?? 0}</p>
        </div>
        <div className="rounded-card border border-border bg-card px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total hoje</p>
          <p className="mt-1 text-[20px] font-semibold text-foreground">
            {brl(ordersQuery.data?.today?.total_cents ?? 0)}
          </p>
        </div>
      </div>

      {hasSalao && (
        <div className="mt-4 flex gap-2">
          {[
            { key: "DELIVERY", label: "Delivery" },
            { key: "SALAO", label: "Salão" },
          ].map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => selectChannel(entry.key)}
              className={cn(
                "flex-1 rounded-btn border px-3 py-2 text-[12.5px] font-semibold",
                channel === entry.key
                  ? "border-brand bg-brand/[0.06] text-brand"
                  : "border-border bg-card text-foreground"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((entry) => {
          const count = countFor(entry);
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-[12px] font-medium",
                tab === entry.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground"
              )}
            >
              {entry.label}
              {count > 0 && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2.5 pb-6">
        {ordersQuery.isPending ? (
          <div className="grid place-items-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-card border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[13.5px] font-medium text-foreground">Nenhum pedido nesta aba.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Quando um cliente pedir pelo link da loja, o pedido aparece aqui sozinho.
            </p>
          </div>
        ) : (
          visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              highlighted={highlight.includes(order.id)}
              onOpen={(id) => {
                const target = orders.find((entry) => entry.id === id);
                if (isSalaoOrder(target)) {
                  navigate({ to: "/salao/comanda/$orderId", params: { orderId: id } });
                  return;
                }
                navigate({ to: "/pedidos/$orderId", params: { orderId: id } });
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}