import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import CustomerCard from "@/components/growth/CustomerCard";
import GrowthTabs from "@/components/growth/GrowthTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { getCustomers, logCrmMessage } from "@/lib/growth-fns";
import { isValidWhatsapp, waLink } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/growth/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Pedix Growth" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <ModuleGate code="GROWTH" name="O Pedix Growth">
      <Customers />
    </ModuleGate>
  );
}

function Customers() {
  const load = useServerFn(getCustomers);
  const logMessage = useServerFn(logCrmMessage);

  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({ queryKey: ["growth", "clientes"], queryFn: () => load() });
  const customers = query.data?.customers ?? [];

  /**
   * Sem API de WhatsApp: só abre o wa.me com o texto e registra o CrmLog.
   * Número inválido não abre nada — avisa e para.
   */
  async function openMessage(customer) {
    setError("");
    if (!isValidWhatsapp(customer.whatsapp)) {
      setError(`${customer.name || "Este cliente"} está sem WhatsApp válido. Corrija o cadastro antes de abrir a mensagem.`);
      return;
    }
    setBusyId(customer.customer_id);
    try {
      const result = await logMessage({ data: { customer_id: customer.customer_id } });
      if (result?.status !== "ok") {
        setError("Não foi possível registrar a mensagem agora.");
        return;
      }
      window.open(waLink(result.whatsapp, result.message), "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message ?? "Não foi possível abrir a mensagem agora.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <GrowthTabs />

      <h1 className="text-[19px] font-semibold leading-tight text-foreground">Clientes</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Agrupados pelo WhatsApp, só desta loja. Nada é enviado automaticamente.
      </p>

      {error && (
        <p className="mt-3 rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brand">{error}</p>
      )}

      {query.isPending ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : customers.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Nenhum cliente ainda. A ficha nasce no primeiro pedido do cardápio.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {customers.map((customer) => (
            <CustomerCard
              key={`${customer.whatsapp}-${customer.customer_id}`}
              customer={customer}
              busy={busyId === customer.customer_id}
              onMessage={openMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
}