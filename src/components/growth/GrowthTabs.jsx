import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const GROWTH_TABS = [
  { to: "/growth", label: "Cupons" },
  { to: "/growth/fidelidade", label: "Fidelidade" },
  { to: "/growth/promocoes", label: "Promoções" },
  { to: "/growth/clientes", label: "Clientes" },
];

export default function GrowthTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-3">
      {GROWTH_TABS.map((tab) => {
        const active = tab.to === "/growth" ? pathname === "/growth" : pathname.startsWith(tab.to);
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