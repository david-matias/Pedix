import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdjustStockDialog({ open, onOpenChange, productName, busy, error, onSubmit }) {
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuantity("1");
    setNote("");
    setLocalError("");
  }, [open]);

  function submit() {
    const value = Number(String(quantity).replace(",", ".").trim());
    if (!Number.isInteger(value) || value === 0) {
      setLocalError("Informe uma quantidade inteira, positiva ou negativa.");
      return;
    }
    if (note.trim().length < 3) {
      setLocalError("Escreva o motivo do ajuste.");
      return;
    }
    setLocalError("");
    onSubmit({ quantity: value, note: note.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Ajustar estoque</DialogTitle>
        </DialogHeader>

        <p className="text-[12.5px] text-muted-foreground">{productName}</p>

        <div className="space-y-3">
          <div>
            <label htmlFor="stock-quantity" className="text-[12.5px] font-semibold text-foreground">
              Quantidade (use negativo para tirar)
            </label>
            <input
              id="stock-quantity"
              value={quantity}
              inputMode="numeric"
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[15px] outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="stock-note" className="text-[12.5px] font-semibold text-foreground">
              Motivo
            </label>
            <input
              id="stock-note"
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </div>

          {(localError || error) && <p className="text-[12px] font-medium text-brand">{localError || error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Salvando..." : "Lançar ajuste"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}