import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function AssignCourierDialog({ open, onOpenChange, couriers, currentId, busy, error, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Escolher entregador</DialogTitle>
        </DialogHeader>

        {couriers.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Nenhum entregador ativo nesta loja. Peça ao Admin Pedix para cadastrar.
          </p>
        ) : (
          <div className="space-y-2">
            {couriers.map((courier) => (
              <button
                key={courier.id}
                type="button"
                disabled={busy}
                onClick={() => onConfirm(courier.id)}
                className={cn(
                  "flex min-h-[46px] w-full items-center justify-between rounded-btn border px-3.5 text-[13.5px] font-medium disabled:opacity-50",
                  courier.id === currentId
                    ? "border-brand bg-brand/[0.06] text-brand"
                    : "border-border bg-card text-foreground"
                )}
              >
                {courier.name}
                {courier.id === currentId && <span className="text-[11px] font-semibold uppercase">atual</span>}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-[12px] font-medium text-brand">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}