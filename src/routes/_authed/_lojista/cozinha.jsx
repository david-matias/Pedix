import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import KitchenTicketCard from "@/components/cozinha/KitchenTicketCard";
import ModuleGate from "@/components/gestao/ModuleGate";
import { advanceKitchenTicket, getKitchenBoard } from "@/lib/cozinha-fns";
import { timeWithSecondsBR } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha · Pedix" }] }),
  component: CozinhaPage,
});

const STAGES = [
  { key: "QUEUED", label: "Na fila" },
  { key: "PREPARING", label: "Preparando" },
  { key: "DONE", label: "Pronto" },
];

function CozinhaPage() {
  return (
    <ModuleGate code="COZINHA" name="O Pedix Cozinha">
      <Board />
    </ModuleGate>
  );
}

function Board() {
  const queryClient = useQueryClient();
  const advance = useServerFn(advanceKitchenTicket);

  const [stationId, setStationId] = useState("");
  const [stage, setStage] = useState("QUEUED");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState(null);

  const query = useQuery({
    queryKey: ["cozinha", "board"],
    queryFn: () => getKitchenBoard(),
    refetchInterval: 8000,
  });

  const data = query.data;
  const stations = data?.stations ?? [];
  const activeStation = stations.some((station) => station.id === stationId)
    ? stationId
    : (stations[0]?.id ?? "");

  const tickets = (data?.tickets ?? []).filter((ticket) => ticket.station_id === activeStation);
  const active = tickets.filter((ticket) => ticket.status === stage);
  const done = (data?.done_today ?? []).filter((ticket) => ticket.station_id === activeStation);

  const counts = {
    QUEUED: tickets.filter((ticket) => ticket.status === "QUEUED").length,
    PREPARING: tickets.filter((ticket) => ticket.status === "PREPARING").length,
    DONE: done.length,
  };

  async function onAdvance(ticket) {
    setBusyId(ticket.id);
    setMessage(null);
    const result = await advance({ data: { ticket_id: ticket.id } });
    if (result?.status !== "ok") setMessage(result?.message ?? "Não foi possível avançar a ficha.");
    await queryClient.invalidateQueries({ queryKey: ["cozinha"] });
    setBusyId("");
  }

  if (query.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pedix Cozinha</p>
          <h1 className="mt-1 text-[19px] font-semibold leading-tight text-foreground">Produção por estação</h1>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-btn border border-border bg-card px-3 text-[12px] font-semibold text-foreground"
        >
          {query.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Sincronizar
        </button>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        Atualiza sozinho a cada 8 segundos · {timeWithSecondsBR(data?.server_time)}
      </p>

      {message && (
        <p className="mt-3 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{message}</p>
      )}

      {stations.length === 0 ? (
        <p className="mt-6 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Nenhuma estação ativa nesta loja. Defina a estação de cada produto no cardápio.
        </p>
      ) : (
        <>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {stations.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => setStationId(station.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold",
                  station.id === activeStation
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-card text-foreground"
                )}
              >
                {station.name}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {STAGES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setStage(entry.key)}
                className={cn(
                  "rounded-btn border px-2 py-2 text-[12px] font-semibold",
                  stage === entry.key
                    ? "border-brand bg-brand/[0.06] text-brand"
                    : "border-border bg-card text-foreground"
                )}
              >
                {entry.label}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">{counts[entry.key]}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2.5">
            {stage === "DONE" ? (
              done.length === 0 ? (
                <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  Nada ficou pronto hoje nesta estação.
                </p>
              ) : (
                done.map((ticket) => <KitchenTicketCard key={ticket.id} ticket={ticket} busy />)
              )
            ) : active.length === 0 ? (
              <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                {stage === "QUEUED" ? "Nenhuma ficha na fila." : "Nada em preparo agora."}
              </p>
            ) : (
              active.map((ticket) => (
                <KitchenTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  busy={busyId === ticket.id}
                  onAdvance={onAdvance}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}