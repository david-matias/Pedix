import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import NewCounterDialog from "@/components/salao/NewCounterDialog";
import { brl, STATUS_LABELS } from "@/lib/pedix";
import { minutesAgo } from "@/components/salao/minutes";
import { openCounterOrder } from "@/lib/salao-fns";

export default function CounterList({ counters }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const newCounter = useServerFn(openCounterOrder);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: (name) => newCounter({ data: { name } }),
    onSuccess: (result) => {
      setDialogOpen(false);
      if (result.status === "ok") {
        queryClient.invalidateQueries({ queryKey: ["salao"] });
        navigate({ to: "/salao/comanda/$orderId", params: { orderId: result.order.id } });
        return;
      }
      setError(result.message ?? "Não foi possível abrir o pedido.");
    },
    onError: (err) => setError(err.message ?? "Não foi possível abrir o pedido."),
  });

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-btn bg-brand px-4 text-[14px] font-semibold text-white"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Novo pedido de balcão
      </button>

      {error && (
        <p className="mt-2 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brand">{error}</p>
      )}

      <div className="mt-3 space-y-2.5">
        {counters.length === 0 ? (
          <div className="rounded-card border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[13.5px] font-medium text-foreground">Nenhum pedido de balcão em aberto.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">O pedido de balcão não ocupa mesa.</p>
          </div>
        ) : (
          counters.map((counter) => (
            <button
              key={counter.id}
              type="button"
              onClick={() => navigate({ to: "/salao/comanda/$orderId", params: { orderId: counter.id } })}
              className="flex w-full items-center justify-between gap-3 rounded-card border border-border bg-card p-3.5 text-left"
            >
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-foreground">
                  #{counter.number}
                  <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
                    {minutesAgo(counter.opened_at)}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{counter.customer_name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14.5px] font-semibold text-foreground">{brl(counter.total_cents)}</p>
                <p className="text-[11px] text-muted-foreground">{STATUS_LABELS[counter.status] ?? counter.status}</p>
              </div>
            </button>
          ))
        )}
      </div>

      <NewCounterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={(name) => create.mutate(name)}
        busy={create.isPending}
      />
    </div>
  );
}