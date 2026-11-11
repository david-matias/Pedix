import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseMoneyToCents } from "@/lib/pedix";

const CONFIG = {
  OPEN: { title: "Abrir caixa", label: "Fundo inicial (R$)", confirm: "Abrir caixa", note: "none" },
  SUPPLY: { title: "Suprimento", label: "Valor (R$)", confirm: "Lançar suprimento", note: "required" },
  WITHDRAWAL: { title: "Sangria", label: "Valor (R$)", confirm: "Lançar sangria", note: "required" },
  CLOSE: { title: "Fechar caixa", label: "Dinheiro contado (R$)", confirm: "Fechar caixa", note: "optional" },
};

export default function CashDialog({ mode, open, onOpenChange, busy, error, onSubmit }) {
  const config = CONFIG[mode] ?? CONFIG.OPEN;
  const [amount, setAmount] = useState("0,00");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("0,00");
    setNote("");
    setLocalError("");
  }, [open, mode]);

  function submit() {
    if (config.note === "required" && note.trim().length < 3) {
      setLocalError("Escreva o motivo.");
      return;
    }
    setLocalError("");
    onSubmit({ amount_cents: parseMoneyToCents(amount), note: note.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">{config.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="cash-amount" className="text-[12.5px] font-semibold text-foreground">
              {config.label}
            </label>
            <input
              id="cash-amount"
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              onBlur={(event) => {
                const cents = parseMoneyToCents(event.target.value);
                setAmount((cents / 100).toFixed(2).replace(".", ","));
              }}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[15px] outline-none focus:border-brand"
            />
          </div>

          {config.note !== "none" && (
            <div>
              <label htmlFor="cash-note" className="text-[12.5px] font-semibold text-foreground">
                {config.note === "required" ? "Motivo" : "Observação (opcional)"}
              </label>
              <input
                id="cash-note"
                value={note}
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
              />
            </div>
          )}

          {(localError || error) && <p className="text-[12px] font-medium text-brand">{localError || error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Salvando..." : config.confirm}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}