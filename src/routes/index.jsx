import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, MapPin, ShieldCheck, Store, UtensilsCrossed } from "lucide-react";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pedix — pedidos organizados para o seu estabelecimento" },
      {
        name: "description",
        content:
          "O Pedix organiza cardápio, sacola e painel de pedidos dos estabelecimentos de alimentação de Trairi, CE. Assinatura fixa, sem comissão por pedido.",
      },
    ],
  }),
  component: EntryPage,
});

const DEMO_STORES = [
  { name: "Sabor da Praia", slug: "sabor-da-praia", city: "Centro · Trairi" },
  { name: "Cantinho do Açaí", slug: "cantinho-do-acai", city: "Centro · Trairi" },
];

const DEMO_USERS = [
  { email: "admin@pedix.demo", role: "Admin Pedix" },
  { email: "maria@sabordapraia.demo", role: "Sabor da Praia" },
  { email: "joao@cantinhodoacai.demo", role: "Cantinho do Açaí" },
];

function EntryPage() {
  const [showStores, setShowStores] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[430px] px-5 py-9 sm:max-w-[520px] lg:grid lg:min-h-screen lg:max-w-5xl lg:grid-cols-[1fr_400px] lg:items-center lg:gap-20 lg:px-10 lg:py-16">
        <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Brand size="lg" />
          <p className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Trairi · Ceará
          </p>
          <h1 className="mt-4 text-[30px] font-semibold leading-[1.12] text-foreground lg:text-[42px]">
            Pedidos do balcão ao WhatsApp,
            <br className="hidden lg:block" /> sem se perder no meio.
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            O Pedix organiza o cardápio, a sacola e o painel de pedidos do seu estabelecimento. Cada loja
            tem o seu próprio link e fala direto com o próprio cliente.
          </p>
        </header>

        <nav className="mt-9 space-y-3 lg:mt-0" aria-label="Caminhos de entrada">
          <button
            type="button"
            onClick={() => setShowStores((v) => !v)}
            aria-expanded={showStores}
            className="flex min-h-[76px] w-full items-center gap-4 rounded-card border border-border bg-card px-4 py-4 text-left transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-foreground">Abrir cardápio demo</span>
              <span className="block text-[13px] text-muted-foreground">Como o seu cliente vê a loja</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                showStores && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          <div
            className={cn(
              "grid gap-2 overflow-hidden transition-all duration-300",
              showStores ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="space-y-2 overflow-hidden pl-1">
              {DEMO_STORES.map((store) => (
                <Link
                  key={store.slug}
                  to="/loja/$slug"
                  params={{ slug: store.slug }}
                  className="flex min-h-[60px] items-center gap-3 rounded-btn border border-border bg-card px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-foreground">
                      {store.name}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      /loja/{store.slug} · {store.city}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-brand">Abrir</span>
                </Link>
              ))}
              <p className="px-1 pt-1 text-[12px] leading-relaxed text-muted-foreground">
                Atalhos de demonstração. No uso real, o cliente entra pelo link da própria loja.
              </p>
            </div>
          </div>

          <Link
            to="/login"
            search={{ returnTo: "/pedidos" }}
            className="flex min-h-[76px] items-center gap-4 rounded-card border border-border bg-card px-4 py-4 transition-colors hover:border-foreground/20"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-foreground">Entrar como lojista</span>
              <span className="block text-[13px] text-muted-foreground">Pedidos, cardápio e conta da sua loja</span>
            </span>
          </Link>

          <Link
            to="/login"
            search={{ returnTo: "/admin" }}
            className="flex min-h-[76px] items-center gap-4 rounded-card border border-border bg-card px-4 py-4 transition-colors hover:border-foreground/20"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-foreground">Entrar como Admin Pedix</span>
              <span className="block text-[13px] text-muted-foreground">Estabelecimentos, assinaturas e módulos</span>
            </span>
          </Link>

          <div className="rounded-card border border-dashed border-border/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Acesso de demonstração
            </p>
            <ul className="mt-2 space-y-1">
              {DEMO_USERS.map((user) => (
                <li key={user.email} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-mono text-foreground">{user.email}</span>
                  <span className="text-muted-foreground">{user.role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Senha de demonstração: <span className="font-mono text-foreground">demo1234</span> — neste protótipo, entre
              com a conta que você já acessa: ela abre o painel da Sabor da Praia e o Admin Pedix.
            </p>
          </div>
        </nav>
      </div>

      <footer className="pb-8 text-center text-[11px] text-muted-foreground">
        Pedix · assinatura fixa, sem comissão por pedido
      </footer>
    </div>
  );
}