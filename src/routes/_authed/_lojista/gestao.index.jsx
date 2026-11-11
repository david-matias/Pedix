import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Bike, Boxes, Wallet } from "lucide-react";
import ModuleGate from "@/components/gestao/ModuleGate";

export const Route = createFileRoute("/_authed/_lojista/gestao/")({
  head: () => ({ meta: [{ title: "Gestão · Pedix" }] }),
  component: GestaoPage,
});

const BOARDS = [
  {
    to: "/gestao/entregas",
    label: "Entregas",
    description: "Despacho dos pedidos de delivery com os entregadores da loja.",
    icon: Bike,
  },
  { to: "/gestao/caixa", label: "Caixa", description: "Fundo, vendas do turno, sangrias e fechamento.", icon: Wallet },
  { to: "/gestao/estoque", label: "Estoque", description: "Saldo dos produtos que controlam quantidade.", icon: Boxes },
  { to: "/gestao/relatorios", label: "Relatórios", description: "Pedidos, faturamento e produtos mais vendidos.", icon: BarChart3 },
];

function GestaoPage() {
  return (
    <ModuleGate code="GESTAO" name="O Pedix Gestão">
      <div className="px-4 pb-8 pt-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pedix Gestão</p>
        <h1 className="mt-1 text-[19px] font-semibold leading-tight text-foreground">Operação da sua loja</h1>

        <div className="mt-4 space-y-2.5">
          {BOARDS.map((board) => {
            const Icon = board.icon;
            return (
              <Link
                key={board.to}
                to={board.to}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-secondary text-brand">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-foreground">{board.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{board.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </ModuleGate>
  );
}