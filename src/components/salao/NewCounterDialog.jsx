import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function NewCounterDialog({ open, onOpenChange, onConfirm, busy }) {
  const [name, setName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Novo pedido de balcão</DialogTitle>
        </DialogHeader>

        <div>
          <Label className="text-[12.5px] font-semibold">Nome (opcional)</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Ex.: Ana"
            className="mt-1.5 h-[46px]"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Sem nome, o pedido aparece como Balcão.</p>
        </div>

        <Button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(name.trim())}
          className="h-12 w-full rounded-btn bg-brand text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          Abrir pedido
        </Button>
      </DialogContent>
    </Dialog>
  );
}