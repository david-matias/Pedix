import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import AssignCourierDialog from "@/components/gestao/AssignCourierDialog";
import DeliveryCard from "@/components/gestao/DeliveryCard";
import GestaoTabs from "@/components/gestao/GestaoTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { assignCourier, completeDelivery, getDeliveries } from "@/lib/entregas-fns";
import { waLink } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/gestao/entregas")({
  head: () => ({ meta: [{ title: "Entregas · Pedix" }] }),
  component: EntregasPage,
});

function EntregasPage() {
  return (
    <ModuleGate code="GESTAO" name="O Pedix Gestão">
      <Board />
    </ModuleGate>
  );
}

function Board() {
  const queryClient = useQueryClient();
  const { data: context } = useLojista();
  const assign = useServerFn(assignCourier);
  const complete = useServerFn(completeDelivery);

  const [dialogOrder, setDialogOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["gestao", "entregas"],
    queryFn: () => getDeliveries(),
    refetchInterval: 15000,
  });

  const data = query.data;
  const orders = data?.orders ?? [];
  const couriers = data?.couriers ?? [];
  const courierById = new Map(couriers.map((courier) => [courier.id, courier]));
  const storeName = context?.establishment?.name ?? "a loja";

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["gestao"] });
    await queryClient.invalidateQueries({ queryKey: ["lojista"] });
  }

  async function onAssign(order, courierId) {
    setBusy(true);
    setError("");
    const result = await assign({ data: { order_id: order.id, courier_id: courierId } });
    if (result.status === "ok") {
      setDialogOrder(null);
      setMessage(
        result.order.status === "OUT_FOR_DELIVERY"
          ? `Pedido #${order.number} saiu para entrega com ${result.courier_name}.`
          : `Pedido #${order.number} com ${result.courier_name}.`
      );
      await refresh();
    } else {
      setError(result.message ?? "Não foi possível atribuir.");
    }
    setBusy(false);
  }

  async function onComplete(order) {
    setBusy(true);
    setError("");
    const result = await complete({ data: { order_id: order.id } });
    if (result.status === "ok") {
      setMessage(`Pedido #${order.number} concluído.`);
      await refresh();
    } else {
      setError(result.message ?? "Não foi possível concluir a entrega.");
    }
    setBusy(false);
  }

  function whatsappFor(order) {
    const courier = courierById.get(order.courier_id);
    if (!courier?.whatsapp) return "";
    const address = [order.address_street, order.address_neighborhood, order.address_reference]
      .filter(Boolean)
      .join(", ");
    return waLink(
      courier.whatsapp,
      `Olá, ${courier.name}! Pedido #${order.number} de ${storeName} para ${order.customer_name}: ${address}.`
    );
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <GestaoTabs />

      <h1 className="text-[19px] font-semibold leading-tight text-foreground">Entregas</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">Pedidos de entrega em preparo ou na rua.</p>

      {message && <p className="mt-3 rounded-btn bg-success/10 px-3 py-2 text-[12px] text-success">{message}</p>}
      {error && <p className="mt-3 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}

      {query.isPending ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Nenhum pedido de entrega em preparo ou na rua agora.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {orders.map((order) => (
            <DeliveryCard
              key={order.id}
              order={order}
              whatsappHref={whatsappFor(order)}
              busy={busy}
              onAssign={(entry) => {
                setError("");
                setDialogOrder(entry);
              }}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}

      <AssignCourierDialog
        open={Boolean(dialogOrder)}
        onOpenChange={(value) => !value && setDialogOrder(null)}
        couriers={couriers}
        currentId={dialogOrder?.courier_id}
        busy={busy}
        error={error}
        onConfirm={(courierId) => onAssign(dialogOrder, courierId)}
      />
    </div>
  );
}