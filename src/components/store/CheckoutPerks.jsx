import { Gift, Loader2, Ticket } from "lucide-react";
import { brl } from "@/lib/pedix";
import { cn } from "@/lib/utils";

/** Cupom e prêmio de fidelidade do checkout: só aparecem com o Pedix Growth ligado. */
export default function CheckoutPerks({
  couponCode,
  onCouponCode,
  coupon,
  loyalty,
  busy,
  useReward,
  onUseReward,
}) {
  const valid = coupon?.status === "ok";
  const invalid = coupon?.status === "invalid";
  const canRedeem = loyalty?.can_redeem === true;
  const missing = loyalty ? Math.max(0, (loyalty.reward_points ?? 0) - (loyalty.points ?? 0)) : 0;

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Ticket className="h-3.5 w-3.5" aria-hidden="true" /> Cupom e pontos
      </h2>

      <label htmlFor="coupon-code" className="mt-3 block text-[13px] font-semibold text-foreground">
        Cupom
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id="coupon-code"
          value={couponCode}
          onChange={(event) => onCouponCode(event.target.value.toUpperCase())}
          placeholder="Ex.: ACAI10"
          autoComplete="off"
          className="min-h-[48px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] uppercase outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" aria-hidden="true" />}
      </div>
      {valid && (
        <p className="mt-1.5 text-[12.5px] font-medium text-success">
          Cupom {coupon.code} aplicado · −{brl(coupon.discount_cents)}
        </p>
      )}
      {invalid && <p className="mt-1.5 text-[12.5px] font-medium text-brand">{coupon.message}</p>}

      {loyalty && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {loyalty.points} {loyalty.points === 1 ? "ponto" : "pontos"} neste WhatsApp · prêmio a cada{" "}
            {loyalty.reward_points} pontos
          </p>
          {canRedeem ? (
            <label
              className={cn(
                "mt-2 flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-btn border px-3.5",
                useReward ? "border-brand bg-brand/[0.04]" : "border-border"
              )}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                <Gift className="h-4 w-4 text-brand" aria-hidden="true" />
                Usar prêmio · −{brl(loyalty.reward_discount_cents)}
              </span>
              <input
                type="checkbox"
                checked={useReward}
                onChange={(event) => onUseReward(event.target.checked)}
                className="h-5 w-5 accent-[#D0121A]"
              />
            </label>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              Faltam {missing} {missing === 1 ? "ponto" : "pontos"} para o prêmio desta loja.
            </p>
          )}
        </div>
      )}
    </section>
  );
}