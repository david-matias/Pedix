import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMoneyToCents } from "@/lib/pedix";
import { cn } from "@/lib/utils";

/** Cupom desta loja: código único, percentual ou valor fixo, com prazo e limite de uso. */
export default function CouponDialog({ open, onOpenChange, busy, error, onConfirm }) {
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENT");
  const [percent, setPercent] = useState("10");
  const [money, setMoney] = useState("5,00");
  const [minMoney, setMinMoney] = useState("0,00");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("0");

  useEffect(() => {
    if (!open) return;
    setCode("");
    setType("PERCENT");
    setPercent("10");
    setMoney("5,00");
    setMinMoney("0,00");
    setStartsAt("");
    setEndsAt("");
    setMaxUses("0");
  }, [open]);

  const value = type === "PERCENT" ? Number(percent) || 0 : parseMoneyToCents(money);
  const invalid = code.trim().length < 2 || value <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[430px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Novo cupom</DialogTitle>
        </DialogHeader>

        <div>
          <Label htmlFor="coupon" className="text-[12.5px] font-semibold">
            Código
          </Label>
          <Input
            id="coupon"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
            autoComplete="off"
            placeholder="ACAI10"
            className="mt-1.5 h-[46px] uppercase"
          />
        </div>

        <div>
          <Label className="text-[12.5px] font-semibold">Tipo de desconto</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {[
              { code: "PERCENT", label: "Percentual" },
              { code: "FIXED", label: "Valor fixo" },
            ].map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setType(option.code)}
                className={cn(
                  "min-h-[44px] rounded-btn border text-[13px] font-semibold",
                  type === option.code ? "border-brand bg-brand/[0.04] text-foreground" : "border-border text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {type === "PERCENT" ? (
          <div>
            <Label htmlFor="coupon-percent" className="text-[12.5px] font-semibold">
              Percentual (%)
            </Label>
            <Input
              id="coupon-percent"
              value={percent}
              inputMode="numeric"
              onChange={(event) => setPercent(event.target.value.replace(/\D/g, ""))}
              className="mt-1.5 h-[46px]"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="coupon-money" className="text-[12.5px] font-semibold">
              Valor do desconto
            </Label>
            <Input
              id="coupon-money"
              value={money}
              inputMode="decimal"
              onChange={(event) => setMoney(event.target.value)}
              className="mt-1.5 h-[46px]"
            />
          </div>
        )}

        <div>
          <Label htmlFor="coupon-min" className="text-[12.5px] font-semibold">
            Pedido mínimo (em produtos)
          </Label>
          <Input
            id="coupon-min"
            value={minMoney}
            inputMode="decimal"
            onChange={(event) => setMinMoney(event.target.value)}
            className="mt-1.5 h-[46px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="coupon-start" className="text-[12.5px] font-semibold">
              Começa em
            </Label>
            <Input
              id="coupon-start"
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1.5 h-[46px]"
            />
          </div>
          <div>
            <Label htmlFor="coupon-end" className="text-[12.5px] font-semibold">
              Termina em
            </Label>
            <Input
              id="coupon-end"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1.5 h-[46px]"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="coupon-uses" className="text-[12.5px] font-semibold">
            Limite de usos
          </Label>
          <Input
            id="coupon-uses"
            value={maxUses}
            inputMode="numeric"
            onChange={(event) => setMaxUses(event.target.value.replace(/\D/g, ""))}
            className="mt-1.5 h-[46px]"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Zero quer dizer sem limite.</p>
        </div>

        {error && <p className="rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}

        <Button
          type="button"
          disabled={busy || invalid}
          onClick={() =>
            onConfirm({
              code: code.trim(),
              type,
              value,
              min_subtotal_cents: parseMoneyToCents(minMoney),
              starts_at: startsAt,
              ends_at: endsAt,
              max_uses: Number(maxUses) || 0,
            })
          }
          className="h-12 w-full rounded-btn bg-brand text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          {busy ? "Salvando..." : "Criar cupom"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}