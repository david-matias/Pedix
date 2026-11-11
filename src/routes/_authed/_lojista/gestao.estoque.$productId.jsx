import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import GestaoTabs from "@/components/gestao/GestaoTabs";
import ModuleGate from "@/components/gestao/ModuleGate";
import AdjustStockDialog from "@/components/gestao/stock/AdjustStockDialog";
import { adjustStock, getStockProduct } from "@/lib/estoque-fns";
import { dateTimeBR } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/gestao/estoque/$productId")({
  head: () => ({ meta: [{ title: "Movimentos de estoque · Pedix" }] }),
  component: StockProductPage,
});

const TYPE_LABELS = { IN: "Entrada", OUT: "Saída", ADJUST: "Ajuste" };

function StockProductPage() {
  return (
    <ModuleGate code="GESTAO" name="O Pedix Gestão">
      <Detail />
    </ModuleGate>
  );
}

function Detail() {
  const { productId } = Route.useParams();
  const queryClient = useQueryClient();
  const adjust = useServerFn(adjustStock);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["gestao", "estoque", productId],
    queryFn: () => getStockProduct({ data: { product_id: productId } }),
  });

  const data = query.data;
  const product = data?.product;

  async function onSubmit({ quantity, note }) {
    setBusy(true);
    setError("");
    const result = await adjust({ data: { product_id: productId, quantity, note } });
    if (result.status === "ok") {
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["gestao", "estoque"] });
    } else {
      setError(result.message ?? "Não foi possível ajustar.");
    }
    setBusy(false);
  }

  if (query.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (data?.status !== "ok") {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[14px] font-medium text-foreground">Produto não encontrado nesta loja.</p>
        <Link to="/gestao/estoque" className="mt-4 inline-block text-[13px] font-semibold text-brand">
          Voltar ao estoque
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <GestaoTabs />

      <Link to="/gestao/estoque" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Estoque
      </Link>

      <h1 className="mt-2 text-[19px] font-semibold leading-tight text-foreground">{product.name}</h1>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-card px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Saldo</p>
          <p className="mt-1 text-[20px] font-semibold text-foreground">{product.stock_qty}</p>
        </div>
        <div className="rounded-card border border-border bg-card px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Mínimo</p>
          <p className="mt-1 text-[20px] font-semibold text-foreground">{product.stock_min}</p>
        </div>
      </div>

      {!product.track_stock ? (
        <p className="mt-3 rounded-btn bg-secondary px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          Este produto não controla estoque.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError("");
            setDialogOpen(true);
          }}
          className="mt-3 min-h-[46px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white"
        >
          Ajustar saldo
        </button>
      )}

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Movimentos</h2>
        {(data.movements ?? []).length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">Nenhum movimento ainda.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {data.movements.map((movement) => (
              <li key={movement.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">
                    {TYPE_LABELS[movement.type] ?? movement.type}
                  </p>
                  <p className="text-[11.5px] leading-snug text-muted-foreground">
                    {dateTimeBR(movement.created_at)}
                    {movement.note ? ` · ${movement.note}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-foreground">
                  {movement.type === "OUT" ? "-" : movement.quantity > 0 ? "+" : ""}
                  {movement.type === "OUT" ? Math.abs(movement.quantity) : movement.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdjustStockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productName={product.name}
        busy={busy}
        error={error}
        onSubmit={onSubmit}
      />
    </div>
  );
}