import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import CashDialog from "@/components/gestao/cash/CashDialog";
import CashSummaryCard from "@/components/gestao/cash/CashSummaryCard";
import GestaoTabs from "@/components/gestao/GestaoTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { addCashMovement, closeCash, getCash, openCash } from "@/lib/caixa-fns";
import { brl, dateTimeBR, PAYMENT_LABELS, timeBR } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/gestao/caixa")({
  head: () => ({ meta: [{ title: "Caixa · Pedix" }] }),
  component: CaixaPage,
});

const MOVEMENT_LABELS = { SALE: "Venda", SUPPLY: "Suprimento", WITHDRAWAL: "Sangria" };

function CaixaPage() {
  return (
    <ModuleGate code="GESTAO" name="O Pedix Gestão">
      <Board />
    </ModuleGate>
  );
}

function Board() {
  const queryClient = useQueryClient();
  const open = useServerFn(openCash);
  const addMovement = useServerFn(addCashMovement);
  const close = useServerFn(closeCash);

  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["gestao", "caixa"],
    queryFn: () => getCash(),
    refetchInterval: 20000,
  });

  const data = query.data;
  const session = data?.session ?? null;

  async function submit({ amount_cents, note }) {
    setBusy(true);
    setError("");
    try {
      let result;
      if (mode === "OPEN") result = await open({ data: { opening_float_cents: amount_cents } });
      else if (mode === "CLOSE") result = await close({ data: { counted_cents: amount_cents, note } });
      else result = await addMovement({ data: { type: mode, amount_cents, note } });

      if (result.status === "ok") {
        setMessage(
          mode === "OPEN"
            ? "Caixa aberto."
            : mode === "CLOSE"
              ? `Caixa fechado. Esperado ${brl(result.expected_cents)} · contado ${brl(result.counted_cents)} · diferença ${brl(result.difference_cents)}.`
              : mode === "SUPPLY"
                ? "Suprimento lançado."
                : "Sangria lançada."
        );
        setMode(null);
        await queryClient.invalidateQueries({ queryKey: ["gestao", "caixa"] });
      } else {
        setError(result.message ?? "Não foi possível concluir.");
      }
    } finally {
      setBusy(false);
    }
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
      <GestaoTabs />

      <h1 className="text-[19px] font-semibold leading-tight text-foreground">Caixa</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">Movimento do dia. Não é nota fiscal.</p>

      {message && <p className="mt-3 rounded-btn bg-success/10 px-3 py-2 text-[12px] leading-relaxed text-success">{message}</p>}
      {error && <p className="mt-3 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brand">{error}</p>}

      {data?.orphan_sales?.count > 0 && (
        <p className="mt-3 rounded-btn border border-warning/30 bg-warning/[0.08] px-3 py-2 text-[11.5px] font-medium leading-relaxed text-warning">
          Venda sem caixa aberto · {data.orphan_sales.count}{" "}
          {data.orphan_sales.count === 1 ? "pedido" : "pedidos"} · {brl(data.orphan_sales.total_cents)}
        </p>
      )}

      {session ? (
        <>
          <p className="mt-4 text-[11.5px] text-muted-foreground">
            Caixa aberto em {dateTimeBR(session.opened_at)} · {timeBR(session.opened_at)}
          </p>
          <div className="mt-2">
            <CashSummaryCard summary={data.summary} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("SUPPLY");
              }}
              className="min-h-[46px] rounded-btn border border-border bg-card text-[13px] font-semibold text-foreground"
            >
              Suprimento
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("WITHDRAWAL");
              }}
              className="min-h-[46px] rounded-btn border border-border bg-card text-[13px] font-semibold text-foreground"
            >
              Sangria
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode("CLOSE");
            }}
            className="mt-2 min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white"
          >
            Fechar caixa
          </button>

          {(data.movements ?? []).length > 0 && (
            <section className="mt-4 rounded-card border border-border bg-card p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Movimentos do turno
              </h2>
              <ul className="mt-2 divide-y divide-border">
                {data.movements.map((movement) => (
                  <li key={movement.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">
                        {MOVEMENT_LABELS[movement.type] ?? movement.type}
                        {movement.payment_code ? ` · ${PAYMENT_LABELS[movement.payment_code] ?? movement.payment_code}` : ""}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {timeBR(movement.created_at)}
                        {movement.note ? ` · ${movement.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-foreground">
                      {movement.type === "WITHDRAWAL" ? "- " : ""}
                      {brl(movement.amount_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-card border border-border bg-card p-4 text-center">
          <p className="text-[14px] font-semibold text-foreground">Caixa fechado</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Abra o caixa para registrar as vendas do turno.
          </p>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode("OPEN");
            }}
            className="mt-3 min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white"
          >
            Abrir caixa
          </button>
        </div>
      )}

      {data?.last_closed && (
        <section className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Último turno fechado
            </h2>
            <span className="text-[11px] text-muted-foreground">{dateTimeBR(data.last_closed.closed_at)}</span>
          </div>
          <div className="mt-2">
            <CashSummaryCard
              summary={data.last_closed.summary}
              countedCents={data.last_closed.counted_cents}
              differenceCents={data.last_closed.difference_cents}
            />
          </div>
          {data.last_closed.note && (
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">Observação: {data.last_closed.note}</p>
          )}
        </section>
      )}

      <CashDialog
        mode={mode ?? "OPEN"}
        open={Boolean(mode)}
        onOpenChange={(value) => !value && setMode(null)}
        busy={busy}
        error={error}
        onSubmit={submit}
      />
    </div>
  );
}