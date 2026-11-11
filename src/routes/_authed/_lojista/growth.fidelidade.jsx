import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import GrowthTabs from "@/components/growth/GrowthTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { getLoyalty, saveLoyaltyRule } from "@/lib/growth-fns";
import { brl, centsToInput, parseMoneyToCents } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/growth/fidelidade")({
  head: () => ({ meta: [{ title: "Fidelidade · Pedix Growth" }] }),
  component: LoyaltyPage,
});

function LoyaltyPage() {
  return (
    <ModuleGate code="GROWTH" name="O Pedix Growth">
      <Loyalty />
    </ModuleGate>
  );
}

function Loyalty() {
  const queryClient = useQueryClient();
  const load = useServerFn(getLoyalty);
  const save = useServerFn(saveLoyaltyRule);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({ queryKey: ["growth", "fidelidade"], queryFn: () => load() });
  const data = query.data;

  useEffect(() => {
    if (!data?.rule) return;
    setForm({
      points_per_real: String(data.rule.points_per_real ?? 1),
      reward_points: String(data.rule.reward_points ?? 50),
      reward_money: centsToInput(data.rule.reward_discount_cents ?? 500),
    });
  }, [data?.rule]);

  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await save({
        data: {
          points_per_real: Number(form.points_per_real) || 0,
          reward_points: Number(form.reward_points) || 0,
          reward_discount_cents: parseMoneyToCents(form.reward_money),
        },
      });
      if (result?.status === "ok") {
        await queryClient.invalidateQueries({ queryKey: ["growth", "fidelidade"] });
        setMessage("Regra salva. Os pontos já gravados não mudam.");
        return;
      }
      setError(result?.message ?? "Não foi possível salvar a regra.");
    } catch (err) {
      setError(err.message ?? "Não foi possível salvar a regra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <GrowthTabs />

      <h1 className="text-[19px] font-semibold leading-tight text-foreground">Fidelidade</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Uma regra por loja. Os pontos são do cliente com esta loja, não valem em outro lugar.
      </p>

      {query.isPending || !form ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card border border-border bg-card px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contas</p>
              <p className="text-[16px] font-semibold text-foreground">{data?.accounts ?? 0}</p>
            </div>
            <div className="rounded-card border border-border bg-card px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Com saldo</p>
              <p className="text-[16px] font-semibold text-foreground">{data?.with_points ?? 0}</p>
            </div>
            <div className="rounded-card border border-border bg-card px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pontos</p>
              <p className="text-[16px] font-semibold text-foreground">{data?.points_total ?? 0}</p>
            </div>
          </div>

          <div className="mt-3 space-y-3 rounded-card border border-border bg-card p-4">
            <div>
              <label htmlFor="points-per-real" className="text-[12.5px] font-semibold text-foreground">
                Pontos por real inteiro
              </label>
              <input
                id="points-per-real"
                value={form.points_per_real}
                inputMode="numeric"
                onChange={(event) => setForm({ ...form, points_per_real: event.target.value.replace(/\D/g, "") })}
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Conta sobre o total do pedido, sem a taxa de entrega.
              </p>
            </div>
            <div>
              <label htmlFor="reward-points" className="text-[12.5px] font-semibold text-foreground">
                Prêmio a cada quantos pontos
              </label>
              <input
                id="reward-points"
                value={form.reward_points}
                inputMode="numeric"
                onChange={(event) => setForm({ ...form, reward_points: event.target.value.replace(/\D/g, "") })}
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="reward-money" className="text-[12.5px] font-semibold text-foreground">
                Desconto do prêmio
              </label>
              <input
                id="reward-money"
                value={form.reward_money}
                inputMode="decimal"
                onChange={(event) => setForm({ ...form, reward_money: event.target.value })}
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Exemplo: {form.reward_points || 0} pontos valem {brl(parseMoneyToCents(form.reward_money))}.
              </p>
            </div>

            {error && <p className="rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}
            {message && <p className="rounded-btn bg-success/10 px-3 py-2 text-[12px] text-success">{message}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="flex min-h-[48px] w-full items-center justify-center rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Salvando..." : "Salvar regra"}
            </button>
          </div>

          <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Os pontos entram quando o pedido fica concluído (ou a comanda fecha). Cancelar estorna os pontos daquele
            pedido, sem deixar saldo negativo.
          </p>
        </>
      )}
    </div>
  );
}