import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import GestaoTabs from "@/components/gestao/GestaoTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import { getStock } from "@/lib/estoque-fns";

export const Route = createFileRoute("/_authed/_lojista/gestao/estoque/")({
  head: () => ({ meta: [{ title: "Estoque · Pedix" }] }),
  component: EstoquePage,
});

function EstoquePage() {
  return (
    <ModuleGate code="GESTAO" name="O Pedix Gestão">
      <List />
    </ModuleGate>
  );
}

function List() {
  const query = useQuery({ queryKey: ["gestao", "estoque"], queryFn: () => getStock() });
  const products = query.data?.products ?? [];

  return (
    <div className="px-4 pb-8 pt-4">
      <GestaoTabs />

      <h1 className="text-[19px] font-semibold leading-tight text-foreground">Estoque</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">Só os produtos que controlam quantidade.</p>

      {query.isPending ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : products.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Nenhum produto controla estoque. Ligue “Controlar estoque” na ficha do produto, no Cardápio.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {products.map((product) => (
            <Link
              key={product.id}
              to="/gestao/estoque/$productId"
              params={{ productId: product.id }}
              className="flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">{product.name}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">Mínimo {product.stock_min}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[15px] font-semibold text-foreground">{product.stock_qty}</span>
                {product.low && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                    Baixo
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}