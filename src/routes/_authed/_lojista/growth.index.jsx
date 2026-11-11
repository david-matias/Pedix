import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import CouponDialog from "@/components/growth/CouponDialog";
import GrowthTabs from "@/components/growth/GrowthTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { createCoupon, getCoupons, setCouponActive } from "@/lib/growth-fns";
import { brl, dayBR } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/growth/")({
  head: () => ({ meta: [{ title: "Cupons · Pedix Growth" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  return (
    <ModuleGate code="GROWTH" name="O Pedix Growth">
      <Coupons />
    </ModuleGate>
  );
}

function Coupons() {
  const queryClient = useQueryClient();
  const list = useServerFn(getCoupons);
  const create = useServerFn(createCoupon);
  const toggle = useServerFn(setCouponActive);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({ queryKey: ["growth", "cupons"], queryFn: () => list() });
  const coupons = query.data?.coupons ?? [];

  async function submit(payload) {
    setBusy(true);
    setError("");
    try {
      const result = await create({ data: payload });
      if (result?.status === "ok") {
        await queryClient.invalidateQueries({ queryKey: ["growth", "cupons"] });
        setOpen(false);
        setMessage("Cupom criado. Ele já vale no checkout desta loja.");
        return;
      }
      setError(result?.message ?? "Não foi possível criar o cupom.");
    } catch (err) {
      setError(err.message ?? "Não foi possível criar o cupom.");
    } finally {
      setBusy(false);
    }
  }

  async function switchActive(coupon) {
    setBusy(true);
    setError("");
    try {
      await toggle({ data: { id: coupon.id, active: coupon.active === false } });
      await queryClient.invalidateQueries({ queryKey: ["growth", "cupons"] });
    } catch (err) {
      setError(err.message ?? "Não foi possível alterar o cupom.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <GrowthTabs />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold leading-tight text-foreground">Cupons</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">Cada código vale só nesta loja.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setMessage("");
            setOpen(true);
          }}
          className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-btn bg-brand px-3.5 text-[12.5px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Novo
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-btn bg-success/10 px-3 py-2 text-[12px] leading-relaxed text-success">{message}</p>
      )}
      {error && !open && (
        <p className="mt-3 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brand">{error}</p>
      )}

      {query.isPending ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : coupons.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Nenhum cupom ainda. Crie o primeiro e ele passa a valer no checkout.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="rounded-card border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold tracking-wide text-foreground">{coupon.code}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {coupon.type === "PERCENT" ? `${coupon.value}% de desconto` : `${brl(coupon.value)} de desconto`}
                    {Number(coupon.min_subtotal_cents ?? 0) > 0
                      ? ` · mínimo ${brl(coupon.min_subtotal_cents)}`
                      : " · sem mínimo"}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {coupon.starts_at || coupon.ends_at
                      ? `Vale ${coupon.starts_at ? dayBR(coupon.starts_at) : "desde já"} até ${
                          coupon.ends_at ? dayBR(coupon.ends_at) : "sem prazo"
                        }`
                      : "Sem prazo"}
                    {" · "}
                    {Number(coupon.max_uses ?? 0) > 0
                      ? `${coupon.used_count ?? 0} de ${coupon.max_uses} usos`
                      : "Sem limite de usos"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    coupon.active === false ? "bg-secondary text-muted-foreground" : "bg-success/10 text-success"
                  )}
                >
                  {coupon.active === false ? "Desativado" : "Ativo"}
                </span>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => switchActive(coupon)}
                className="mt-2.5 flex min-h-[40px] w-full items-center justify-center rounded-btn border border-border bg-card text-[12.5px] font-semibold text-foreground disabled:opacity-50"
              >
                {coupon.active === false ? "Reativar cupom" : "Desativar cupom"}
              </button>
              <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                Desativar não altera pedidos já gravados.
              </p>
            </div>
          ))}
        </div>
      )}

      <CouponDialog
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        error={error}
        onConfirm={submit}
      />
    </div>
  );
}