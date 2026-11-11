import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import CounterList from "@/components/salao/CounterList";
import ModuleOff from "@/components/salao/ModuleOff";
import SalaoTabs from "@/components/salao/SalaoTabs";
import { useSalao } from "@/components/salao/useSalao";

export const Route = createFileRoute("/_authed/_lojista/salao/balcao")({
  head: () => ({ meta: [{ title: "Balcão · Pedix" }] }),
  component: SalaoCounterPage,
});

function SalaoCounterPage() {
  const { data, isPending } = useSalao();

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="text-[20px] font-semibold text-foreground">Salão</h1>
      <p className="mt-1 text-[11.5px] text-muted-foreground">Pedido de balcão não ocupa mesa.</p>

      <div className="mt-3">
        <SalaoTabs />
      </div>

      {isPending ? (
        <div className="grid place-items-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : !data?.module_enabled ? (
        <ModuleOff />
      ) : (
        <CounterList counters={data.counters ?? []} />
      )}
    </div>
  );
}