import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import TableCard from "@/components/salao/TableCard";
import { openTableComanda } from "@/lib/salao-fns";

export default function TableMap({ tables }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openTable = useServerFn(openTableComanda);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const open = useMutation({
    mutationFn: (tableId) => openTable({ data: { table_id: tableId } }),
    onSuccess: (result) => {
      setBusyId(null);
      if (result.status === "ok") {
        queryClient.invalidateQueries({ queryKey: ["salao"] });
        navigate({ to: "/salao/comanda/$orderId", params: { orderId: result.order.id } });
        return;
      }
      setError(result.message ?? "Não foi possível abrir esta mesa.");
    },
    onError: (err) => {
      setBusyId(null);
      setError(err.message ?? "Não foi possível abrir esta mesa.");
    },
  });

  function handle(table) {
    setError("");
    setBusyId(table.id);
    open.mutate(table.id);
  }

  const active = tables.filter((table) => table.active !== false);

  if (active.length === 0) {
    return (
      <div className="mt-4 rounded-card border border-dashed border-border px-4 py-10 text-center">
        <p className="text-[13.5px] font-medium text-foreground">Nenhuma mesa cadastrada.</p>
        <p className="mt-1 text-[12px] text-muted-foreground">Cadastre as mesas em Loja → Mesas.</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brand">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {active.map((table) => (
          <TableCard key={table.id} table={table} busy={busyId === table.id} onOpen={handle} />
        ))}
      </div>
      {open.isPending && (
        <p className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Abrindo comanda
        </p>
      )}
    </div>
  );
}