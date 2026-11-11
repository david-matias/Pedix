import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CancelComandaDialog({ open, onOpenChange, onConfirm, busy, error }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Cancelar comanda</DialogTitle>
        </DialogHeader>

        <div>
          <Label htmlFor="cancel-reason" className="text-[12.5px] font-semibold">
            Motivo (obrigatório)
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ex.: cliente foi embora"
            className="mt-1.5"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Os itens já lançados ficam no histórico. A mesa fica livre.
          </p>
        </div>

        {error && <p className="rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}

        <Button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={() => onConfirm(reason.trim())}
          className="h-12 w-full rounded-btn bg-brand text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          Cancelar comanda
        </Button>
      </DialogContent>
    </Dialog>
  );
}