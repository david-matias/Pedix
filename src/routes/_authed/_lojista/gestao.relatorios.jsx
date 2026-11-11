import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import GestaoTabs from "@/components/gestao/GestaoTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { getReports } from "@/lib/relatorios-fns";
import { brl } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/gestao/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · Pedix" }] }),
  component: RelatoriosPage,
});

const RANGES = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "custom", label: "Escolher datas" },
];

function shortDate(day) {
  const [, month, date] = String(day ?? "").split("-");
  return month ? `${date}/${month}` : day;
}

function RelatoriosPage() {
  return (
    <ModuleGate code="GESTAO" name="O Pedix Gestão">
      <Board />
    </ModuleGate>
  );
}

function Board() {
  const [range, setRange] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const customReady = range !== "custom" || (from.length === 10 && to.length === 10);

  const query = useQuery({
    queryKey: ["gestao", "relatorios", range, from, to],
    queryFn: () =>
      getReports({
        data: { range, ...(range === "custom" && customReady ? { from, to } : {}) },
      }),
    enabled: customReady,
  });

  const data = query.data;
  const metrics = data?.metrics;

  return (
    <div className="px-4 pb-8 pt-4">
      <GestaoTabs />

      <h1 className="text-[19px] font-semibold leading-tight text-foreground">Relatórios</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">Números dos pedidos reais desta loja.</p>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {RANGES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setRange(entry.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold",
              range === entry.key ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[11.5px] font-semibold text-muted-foreground">
            De
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-btn border border-input px-3 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </label>
          <label className="text-[11.5px] font-semibold text-muted-foreground">
            Até
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-btn border border-input px-3 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </label>
        </div>
      )}

      {query.isPending ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : range === "custom" && !customReady ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Escolha a data inicial e a final.
        </p>
      ) : !metrics || !data?.has_orders ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Ainda não há pedidos neste período.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Pedidos", value: String(metrics.orders) },
              { label: "Faturamento", value: brl(metrics.revenue_cents) },
              { label: "Ticket médio", value: brl(metrics.average_ticket_cents) },
              { label: "Cancelados", value: String(metrics.cancelled) },
            ].map((card) => (
              <div key={card.label} className="rounded-card border border-border bg-card px-3.5 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-1 text-[18px] font-semibold leading-tight text-foreground">{card.value}</p>
              </div>
            ))}
          </div>

          <section className="mt-4 rounded-card border border-border bg-card p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Por dia</h2>
            <ul className="mt-2 divide-y divide-border">
              {(data.days ?? []).map((day) => (
                <li key={day.date} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                  <span className="text-foreground">{shortDate(day.date)}</span>
                  <span className="text-muted-foreground">{day.count} ped.</span>
                  <span className="tabular-nums font-medium text-foreground">{brl(day.total_cents)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-3 rounded-card border border-border bg-card p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Por modalidade</h2>
            <ul className="mt-2 divide-y divide-border">
              {(data.modalities ?? []).map((entry) => (
                <li key={entry.key} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                  <span className="text-foreground">{entry.label}</span>
                  <span className="text-muted-foreground">{entry.count} ped.</span>
                  <span className="tabular-nums font-medium text-foreground">{brl(entry.total_cents)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-3 rounded-card border border-border bg-card p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Mais vendidos
            </h2>
            {(data.top_products ?? []).length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted-foreground">Sem itens no período.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {data.top_products.map((product) => (
                  <li key={product.name} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate text-foreground">{product.name}</span>
                    <span className="shrink-0 text-muted-foreground">{product.quantity}x</span>
                    <span className="shrink-0 tabular-nums font-medium text-foreground">{brl(product.total_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}