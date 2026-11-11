import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ChefHat,
  Loader2,
  Receipt,
  Sparkles,
  Store,
  UserRound,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Brand from "@/components/Brand";
import { LojistaProvider, useLojista } from "@/components/lojista/LojistaProvider";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/pedidos", label: "Pedidos", icon: Receipt },
  { to: "/cardapio", label: "Cardápio", icon: BookOpen },
  { to: "/minha-loja", label: "Loja", icon: Store },
  { to: "/conta", label: "Conta", icon: UserRound },
];

// Cada módulo contratado ganha (ou perde) sua entrada no menu desta loja.
const SALAO_NAV = { to: "/salao", label: "Salão", icon: UtensilsCrossed };
const COZINHA_NAV = { to: "/cozinha", label: "Cozinha", icon: ChefHat };
const GESTAO_NAV = { to: "/gestao", label: "Gestão", icon: Wallet };
const GROWTH_NAV = { to: "/growth", label: "Growth", icon: Sparkles };

function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data } = useLojista();
  const enabled = data?.enabled_modules ?? [];

  const items = [NAV[0]];
  if (enabled.includes("COZINHA")) items.push(COZINHA_NAV);
  if (enabled.includes("MESAS")) items.push(SALAO_NAV);
  if (enabled.includes("GESTAO")) items.push(GESTAO_NAV);
  if (enabled.includes("GROWTH")) items.push(GROWTH_NAV);
  items.push(NAV[1], NAV[2], NAV[3]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
      <div className="no-scrollbar mx-auto flex max-w-[520px] overflow-x-auto">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-[58px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium",
                active ? "text-brand" : "text-muted-foreground"
              )}
            >
              <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Unlinked({ user }) {
  return (
    <div className="mx-auto max-w-[520px] px-5 py-16 text-center">
      <Brand size="md" className="justify-center" />
      <h1 className="mt-8 text-[18px] font-semibold text-foreground">Sua conta ainda não está vinculada a uma loja</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Você entrou como <span className="font-medium text-foreground">{user?.email}</span>. Peça ao Admin Pedix para
        usar este e-mail como dono do estabelecimento em Admin Pedix → Estabelecimentos.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link
          to="/admin"
          className="flex min-h-[48px] items-center justify-center rounded-btn bg-brand px-5 text-[14px] font-semibold text-white"
        >
          Ir para o Admin Pedix
        </Link>
        <Link
          to="/"
          className="flex min-h-[48px] items-center justify-center rounded-btn border border-border bg-card px-5 text-[14px] font-medium text-foreground"
        >
          Voltar para a entrada
        </Link>
      </div>
    </div>
  );
}

function Shell({ children }) {
  const { data, isPending, error } = useLojista();

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[520px] px-5 py-16 text-center">
        <p className="text-[14px] font-medium text-foreground">Não foi possível abrir o painel.</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (data?.status !== "ok") return <Unlinked user={data?.user} />;

  return (
    <div className="min-h-screen bg-background pb-[70px]">
      <header className="sticky top-0 z-20 flex min-h-[58px] items-center gap-2.5 border-b border-border bg-card/95 px-4 backdrop-blur">
        <Brand size="sm" showWord={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight text-foreground">
            {data.establishment.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {data.establishment.neighborhood || "Trairi"} · {data.establishment.city}
          </p>
        </div>
        {data.subscription && (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {data.subscription.status === "ACTIVE"
              ? "Ativa"
              : data.subscription.status === "TRIAL"
                ? "Demo"
                : data.subscription.status === "SUSPENDED"
                  ? "Suspensa"
                  : "Em atraso"}
          </span>
        )}
      </header>

      <main className="mx-auto w-full max-w-[520px]">{children}</main>
      <BottomNav />
    </div>
  );
}

export default function LojistaShell() {
  return (
    <LojistaProvider>
      <Shell>
        <Outlet />
      </Shell>
    </LojistaProvider>
  );
}