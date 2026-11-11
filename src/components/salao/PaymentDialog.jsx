import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, PAYMENT_LABELS, parseMoneyToCents } from "@/lib/pedix";
import { cn } from "@/lib/utils";

/** Fechamento: forma de pagamento já cadastrada na loja; dinheiro pergunta o troco. */
export default function PaymentDialog({ open, onOpenChange, payments, totalCents, onConfirm, busy, error, allowCoupon }) {
  const [code, setCode] = useState(payments[0]?.code ?? "CASH");
  const [change, setChange] = useState("");
  const [coupon, setCoupon] = useState("");

  useEffect(() => {
    if (!open) return;
    setCode(payments[0]?.code ?? "CASH");
    setChange("");
    setCoupon("");
  }, [open]);

  const changeCents = change.trim() ? parseMoneyToCents(change) : 0;
  const needsChange = code === "CASH";
  const invalidChange = needsChange && changeCents > 0 && changeCents < totalCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Fechar comanda · {brl(totalCents)}</DialogTitle>
        </DialogHeader>

        <div>
          <Label className="text-[12.5px] font-semibold">Forma de pagamento</Label>
          <div className="mt-1.5 space-y-1.5">
            {payments.map((payment) => (
              <button
                key={payment.code}
                type="button"
                onClick={() => setCode(payment.code)}
                className={cn(
                  "flex min-h-[46px] w-full items-center gap-3 rounded-btn border px-3.5 text-left text-[13.5px]",
                  code === payment.code ? "border-brand bg-brand/[0.04] text-foreground" : "border-border bg-card text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                    code === payment.code ? "border-brand" : "border-border"
                  )}
                >
                  {code === payment.code && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                {payment.label || PAYMENT_LABELS[payment.code] || payment.code}
              </button>
            ))}
          </div>
        </div>

        {needsChange && (
          <div>
            <Label htmlFor="comanda-change" className="text-[12.5px] font-semibold">
              Troco para (opcional)
            </Label>
            <Input
              id="comanda-change"
              value={change}
              onChange={(event) => setChange(event.target.value)}
              inputMode="decimal"
              placeholder="Ex.: 100,00"
              className="mt-1.5 h-[46px]"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {invalidChange
                ? "O troco precisa ser maior que o total."
                : changeCents > 0
                  ? `Levar troco de ${brl(changeCents - totalCents)}`
                  : "Deixe em branco se não precisa de troco."}
            </p>
          </div>
        )}

        {allowCoupon && (
          <div>
            <Label htmlFor="comanda-coupon" className="text-[12.5px] font-semibold">
              Cupom (opcional)
            </Label>
            <Input
              id="comanda-coupon"
              value={coupon}
              onChange={(event) => setCoupon(event.target.value.toUpperCase())}
              autoComplete="off"
              placeholder="Código do cupom"
              className="mt-1.5 h-[46px] uppercase"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              O desconto é conferido e aplicado ao fechar a conta.
            </p>
          </div>
        )}

        {error && <p className="rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}

        <Button
          type="button"
          disabled={busy || payments.length === 0 || invalidChange}
          onClick={() =>
            onConfirm({
              payment_code: code,
              change_for_cents: needsChange && changeCents > 0 ? changeCents : null,
              coupon_code: allowCoupon ? coupon.trim() : "",
            })
          }
          className="h-12 w-full rounded-btn bg-brand text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          Fechar comanda
        </Button>
      </DialogContent>
    </Dialog>
  );
}