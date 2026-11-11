import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, centsToInput, parseMoneyToCents } from "@/lib/pedix";

/** Preço promocional de um produto, com prazo. Fora do prazo, volta o preço base. */
export default function PromotionDialog({ open, onOpenChange, products, promotion, busy, error, onConfirm }) {
  const [productId, setProductId] = useState("");
  const [money, setMoney] = useState("0,00");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setProductId(promotion?.product_id ?? products[0]?.id ?? "");
    setMoney(promotion ? centsToInput(promotion.promo_price_cents) : "0,00");
    setStartsAt(promotion?.starts_at ?? "");
    setEndsAt(promotion?.ends_at ?? "");
  }, [open, promotion, products]);

  const product = products.find((entry) => entry.id === productId);
  const price = parseMoneyToCents(money);
  const invalid = !product || price <= 0 || price >= (product?.price_cents ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[430px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[16px]">{promotion ? "Editar promoção" : "Nova promoção"}</DialogTitle>
        </DialogHeader>

        <div>
          <Label htmlFor="promo-product" className="text-[12.5px] font-semibold">
            Produto
          </Label>
          <select
            id="promo-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            disabled={Boolean(promotion)}
            className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input bg-card px-2 text-[13px] outline-none focus:border-brand disabled:opacity-60"
          >
            {products.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} · {brl(entry.price_cents)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="promo-price" className="text-[12.5px] font-semibold">
            Preço promocional
          </Label>
          <Input
            id="promo-price"
            value={money}
            inputMode="decimal"
            onChange={(event) => setMoney(event.target.value)}
            className="mt-1.5 h-[46px]"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {product
              ? `Hoje no cardápio: ${brl(product.price_cents)}. A promoção precisa ser menor que isso.`
              : "Escolha o produto."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="promo-start" className="text-[12.5px] font-semibold">
              Começa em
            </Label>
            <Input
              id="promo-start"
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1.5 h-[46px]"
            />
          </div>
          <div>
            <Label htmlFor="promo-end" className="text-[12.5px] font-semibold">
              Termina em
            </Label>
            <Input
              id="promo-end"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1.5 h-[46px]"
            />
          </div>
        </div>

        {error && <p className="rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}

        <Button
          type="button"
          disabled={busy || invalid}
          onClick={() =>
            onConfirm({
              id: promotion?.id ?? "",
              product_id: productId,
              promo_price_cents: price,
              starts_at: startsAt,
              ends_at: endsAt,
            })
          }
          className="h-12 w-full rounded-btn bg-brand text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          {busy ? "Salvando..." : "Salvar promoção"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}