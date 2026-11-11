import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Armchair, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/** As duas ações do topo do Salão: Mapa e Balcão. */
export default function SalaoTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        to="/salao"
        className={cn(
          "flex min-h-[46px] items-center justify-center gap-2 rounded-btn border text-[13.5px] font-semibold",
          pathname === "/salao"
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground"
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        Mapa
      </Link>
      <Link
        to="/salao/balcao"
        className={cn(
          "flex min-h-[46px] items-center justify-center gap-2 rounded-btn border text-[13.5px] font-semibold",
          pathname.startsWith("/salao/balcao")
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground"
        )}
      >
        <Armchair className="h-4 w-4" aria-hidden="true" />
        Balcão
      </Link>
    </div>
  );
}