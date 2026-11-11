import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tableStatus } from "@/components/salao/minutes";
import { cn } from "@/lib/utils";

/** Transferir: só para uma mesa livre da mesma loja. */
export default function TransferDialog({ open, onOpenChange, tables, currentTableId, onConfirm, busy }) {
  const free = tables.filter(
    (table) => table.active !== false && table.id !== currentTableId && tableStatus(table) === "LIVRE"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Transferir comanda</DialogTitle>
        </DialogHeader>

        {free.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Nenhuma mesa livre nesta loja agora.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {free.map((table) => (
              <Button
                key={table.id}
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onConfirm(table.id)}
                className={cn("h-12 justify-start rounded-btn text-[13.5px] font-semibold")}
              >
                {table.name?.trim() || `Mesa ${table.number}`}
              </Button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          A mesa atual fica livre assim que a comanda muda de lugar.
        </p>
      </DialogContent>
    </Dialog>
  );
}