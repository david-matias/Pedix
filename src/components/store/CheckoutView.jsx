import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getCheckoutPerks, placeOrder } from "@/lib/storefront-fns";
import { brl, isValidWhatsapp } from "@/lib/pedix";
import { resolveLine } from "@/components/store/cart-utils";
import CheckoutPerks from "@/components/store/CheckoutPerks";
import { FulfillmentChoice, DeliveryFields, PaymentFields } from "@/components/store/CheckoutFields";

export default function CheckoutView({ catalog, establishment, items, notes, totals, onBack, onOrderCreated, onMismatch }) {
  const place = useServerFn(placeOrder);
  const perks = useServerFn(getCheckoutPerks);
  const [fulfillment, setFulfillment] = useState(
    establishment.delivery_enabled ? "DELIVERY" : "PICKUP"
  );
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [paymentCode, setPaymentCode] = useState(catalog.payments[0]?.code ?? "PIX");
  const [changeFor, setChangeFor] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [useReward, setUseReward] = useState(false);
  const [perkData, setPerkData] = useState(null);
  const [perksBusy, setPerksBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const growth = catalog.growth === true;

  // Cupom e pontos são conferidos no servidor, na mesma regra que fecha o pedido.
  useEffect(() => {
    if (!growth) return undefined;
    const code = couponCode.trim();
    if (!code && !isValidWhatsapp(whatsapp)) {
      setPerkData(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setPerksBusy(true);
      try {
        const result = await perks({
          data: {
            slug: establishment.slug,
            whatsapp,
            coupon_code: code,
            subtotal_cents: totals.subtotal,
          },
        });
        setPerkData(result?.status === "ok" ? result : null);
      } catch {
        setPerkData(null);
      } finally {
        setPerksBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [growth, couponCode, whatsapp, totals.subtotal]);

  const zone = catalog.zones.find((entry) => entry.neighborhood === neighborhood);
  const deliveryFee = fulfillment === "DELIVERY" ? (zone?.fee_cents ?? 0) : 0;
  const minOrder = establishment.min_order_cents ?? 0;
  const missingForMin = Math.max(0, minOrder - totals.subtotal);
  const belowMin = missingForMin > 0;

  const typedCode = couponCode.trim().toUpperCase();
  const coupon =
    perkData?.coupon && (!perkData.coupon.code || perkData.coupon.code === typedCode) ? perkData.coupon : null;
  const loyalty = perkData?.loyalty && isValidWhatsapp(whatsapp) ? perkData.loyalty : null;
  const couponDiscount = coupon?.status === "ok" ? coupon.discount_cents : 0;
  const rewardOn = useReward && loyalty?.can_redeem === true;
  const rewardDiscount = rewardOn
    ? Math.min(loyalty.reward_discount_cents ?? 0, Math.max(0, totals.subtotal - couponDiscount))
    : 0;
  const discount = Math.min(couponDiscount + rewardDiscount, totals.subtotal);
  const total = Math.max(0, totals.subtotal + deliveryFee - discount);

  const canSubmit = !busy && !belowMin && name.trim().length >= 2 && isValidWhatsapp(whatsapp) &&
    (fulfillment === "PICKUP" || (street.trim().length > 2 && Boolean(neighborhood)));

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const result = await place({
        data: {
          slug: establishment.slug,
          fulfillment_type: fulfillment,
          customer_name: name.trim(),
          customer_whatsapp: whatsapp,
          address_street: fulfillment === "DELIVERY" ? street.trim() : "",
          address_neighborhood: fulfillment === "DELIVERY" ? neighborhood : "",
          address_reference: fulfillment === "DELIVERY" ? reference.trim() : "",
          payment_code: paymentCode,
          change_for_cents:
            paymentCode === "CASH" && changeFor.trim() !== ""
              ? Math.round(Number(changeFor.replace(",", ".")) * 100)
              : null,
          notes,
          coupon_code: couponCode.trim(),
          use_reward: rewardDiscount > 0,
          expected_subtotal_cents: totals.subtotal,
          expected_delivery_fee_cents: deliveryFee,
          items: items.map((item) => {
            const line = resolveLine(catalog, item);
            return {
              kind: item.kind,
              ref_id: item.ref_id,
              quantity: item.quantity,
              option_ids: item.option_ids ?? [],
              notes: item.notes ?? "",
              expected_unit_price_cents: line.unit,
            };
          }),
        },
      });

      if (result.status === "ok") {
        onOrderCreated(result);
        return;
      }
      if (result.status === "mismatch") {
        onMismatch(result);
        return;
      }
      setError(result.message ?? "Não foi possível enviar o pedido.");
    } catch {
      setError("Não foi possível enviar o pedido agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-card pb-28">
      <div className="sticky top-0 z-10 flex min-h-[56px] items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para a sacola"
          className="grid h-11 w-11 place-items-center rounded-btn text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-[16px] font-semibold text-foreground">Finalizar pedido</h1>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Como você quer receber
          </h2>
          <FulfillmentChoice establishment={establishment} value={fulfillment} onChange={setFulfillment} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Seus dados</h2>
          <div>
            <label htmlFor="customer-name" className="text-[13px] font-semibold text-foreground">
              Nome
            </label>
            <input
              id="customer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Como podemos te chamar?"
              className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div>
            <label htmlFor="customer-whatsapp" className="text-[13px] font-semibold text-foreground">
              WhatsApp
            </label>
            <input
              id="customer-whatsapp"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              inputMode="tel"
              placeholder="(85) 98800-0000"
              className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            {whatsapp.trim().length > 0 && !isValidWhatsapp(whatsapp) && (
              <p className="mt-1 text-[12px] font-medium text-brand">Informe um WhatsApp válido com DDD.</p>
            )}
          </div>
        </section>

        {fulfillment === "DELIVERY" ? (
          <section>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Endereço de entrega
            </h2>
            <DeliveryFields
              zones={catalog.zones}
              neighborhood={neighborhood}
              onNeighborhood={setNeighborhood}
              street={street}
              onStreet={setStreet}
              reference={reference}
              onReference={setReference}
            />
          </section>
        ) : (
          <section className="rounded-card border border-border bg-secondary/40 px-4 py-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Retirada</h2>
            <p className="mt-1.5 text-[14px] text-foreground">
              {establishment.street}
              {establishment.neighborhood ? ` — ${establishment.neighborhood}` : ""}
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Pronto em cerca de {establishment.eta_pickup_min ?? 20} min. Taxa zero.
            </p>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Pagamento
          </h2>
          <PaymentFields
            payments={catalog.payments}
            value={paymentCode}
            onChange={setPaymentCode}
            changeFor={changeFor}
            onChangeFor={setChangeFor}
          />
        </section>

        {growth && (
          <CheckoutPerks
            couponCode={couponCode}
            onCouponCode={(value) => {
              setCouponCode(value);
              setError("");
            }}
            coupon={coupon}
            loyalty={loyalty}
            busy={perksBusy}
            useReward={rewardOn}
            onUseReward={setUseReward}
          />
        )}

        <section className="rounded-card border border-border bg-secondary/30 p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Resumo</h2>
          <ul className="mt-2 space-y-1.5">
            {items.map((item) => {
              const line = resolveLine(catalog, item);
              return (
                <li key={item.key} className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="min-w-0 flex-1 text-foreground">
                    {item.quantity}x {line.name}
                  </span>
                  <span className="shrink-0 font-medium text-foreground">{brl(line.unit * item.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[13px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="text-foreground">{brl(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de entrega</span>
              <span className="text-foreground">{fulfillment === "DELIVERY" ? brl(deliveryFee) : "Grátis"}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-success">
                <span>Cupom {coupon?.code}</span>
                <span>−{brl(couponDiscount)}</span>
              </div>
            )}
            {rewardDiscount > 0 && (
              <div className="flex justify-between text-success">
                <span>Prêmio de fidelidade</span>
                <span>−{brl(rewardDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-[15px] font-semibold text-foreground">
              <span>Total</span>
              <span>{brl(total)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            O valor é confirmado pela loja antes de seguir.
          </p>
        </section>

        {error && (
          <p className="rounded-btn border border-brand/30 bg-brand/[0.06] px-3.5 py-2.5 text-[13px] font-medium text-brand">
            {error}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
        {belowMin && (
          <p className="mb-2 text-center text-[12px] font-medium text-warning">
            Faltam {brl(missingForMin)} para o pedido mínimo de {brl(minOrder)}.
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-btn bg-brand px-5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Enviando...
            </>
          ) : (
            <>Fazer pedido · {brl(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}