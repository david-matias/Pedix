import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import GrowthTabs from "@/components/growth/GrowthTabs";
import PromotionDialog from "@/components/growth/PromotionDialog";
import ModuleGate from "@/components/gestao/ModuleGate";
import { getPromotions, savePromotion, setPromotionActive } from "@/lib/growth-fns";
import { brl, dayBR } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/growth/promocoes")({
  head: () => ({ meta: [{ title: "Promoções · Pedix Growth" }] }),
  component: PromotionsPage,
});

function PromotionsPage() {
  return (
    <ModuleGate code="GROWTH" name="O Pedix Growth">
      <Promotions />
    </ModuleGate>
  );
}

function Promotions() {
  const queryClient = useQueryClient();
  const list = useServerFn(getPromotions);
  const save = useServerFn(savePromotion);
  const toggle = useServerFn(setPromotionActive);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({ queryKey: ["growth", "promocoes"], queryFn: () => list() });
  const products = query.data?.products ?? [];
  const promotions = query.data?.promotions ?? [];
  const today = query.data?.today ?? "";
  const nameOf = (id) => products.find((product) => product.id === id)?.name ?? "Produto";
  const baseOf = (id) => products.find((product) => product.id === id)?.price_cents ?? 0;

  async function submit(payload) {
    setBusy(true);
    setError("");
    try {
      const result = await save({ data: payload });
      if (result?.status === "ok") {
        await queryClient.invalidateQueries({ queryKey: ["growth", "promocoes"] });
        setOpen(false);
        setMessage("Promoção salva. O cardápio público já mostra o preço novo dentro do prazo.");
        return;
      }
      setError(result?.message ?? "Não foi possível salvar a promoção.");
    } catch (err) {
      setError(err.message ?? "Não foi possível salvar a promoção.");
    } finally {
      setBusy(false);
    }
  }

  async function switchActive(promotion) {
    setBusy(true);
    setError("");
    try {
      await toggle({ data: { id: promotion.id, active: promotion.active === false } });
      await queryClient.invalidateQueries({ queryKey: ["growth", "promocoes"] });
    } catch (err) {
      setError(err.message ?? "Não foi possível alterar a promoção.");
    } finally {
      setBusy(false);
    }
  }

  function within(promotion) {
    if (promotion.active === false) return false;
    if (promotion.starts_at && today < promotion.starts_at) return false;
    if (promotion.ends_at && today > promotion.ends_at) return false;
    return true;
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <GrowthTabs />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold leading-tight text-foreground">Promoções</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">Preço promocional no cardápio, só dentro do prazo.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setError("");
            setMessage("");
            setOpen(true);
          }}
          className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-btn bg-brand px-3.5 text-[12.5px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nova
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
      ) : promotions.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Nenhum produto em promoção. Escolha um produto e o preço promocional dele.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {promotions.map((promotion) => (
            <div key={promotion.id} className="rounded-card border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-foreground">{nameOf(promotion.product_id)}</p>
                  <p className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-[13.5px] font-semibold text-success">{brl(promotion.promo_price_cents)}</span>
                    <span className="text-[11.5px] text-muted-foreground line-through">
                      {brl(baseOf(promotion.product_id))}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {promotion.starts_at || promotion.ends_at
                      ? `De ${promotion.starts_at ? dayBR(promotion.starts_at) : "agora"} até ${
                          promotion.ends_at ? dayBR(promotion.ends_at) : "sem prazo"
                        }`
                      : "Sem prazo"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    within(promotion) ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {promotion.active === false ? "Desativada" : within(promotion) ? "No ar" : "Fora do prazo"}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(promotion);
                    setError("");
                    setOpen(true);
                  }}
                  className="flex min-h-[40px] items-center justify-center rounded-btn border border-border bg-card text-[12.5px] font-semibold text-foreground"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => switchActive(promotion)}
                  className="flex min-h-[40px] items-center justify-center rounded-btn border border-border bg-card text-[12.5px] font-semibold text-foreground disabled:opacity-50"
                >
                  {promotion.active === false ? "Ativar" : "Desativar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PromotionDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        promotion={editing}
        busy={busy}
        error={error}
        onConfirm={submit}
      />
    </div>
  );
}