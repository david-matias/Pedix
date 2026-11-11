import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const GESTAO_TABS = [
  { to: "/gestao/entregas", label: "Entregas" },
  { to: "/gestao/caixa", label: "Caixa" },
  { to: "/gestao/estoque", label: "Estoque" },
  { to: "/gestao/relatorios", label: "Relatórios" },
];

export default function GestaoTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-3">
      {GESTAO_TABS.map((tab) => {
        const active = pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold",
              active ? "border-brand bg-brand/[0.06] text-brand" : "border-border bg-card text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}