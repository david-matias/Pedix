import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { MODULES } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/modulo/$module")({ component: ModulePlaceholder });

function ModulePlaceholder() {
  const { module: moduleCode } = Route.useParams();
  const { data: context } = useLojista();
  const module = MODULES.find((entry) => entry.code === moduleCode);
  const enabled = (context?.entitlements ?? []).some((entry) => entry.module === moduleCode && entry.enabled);

  if (!enabled) {
    return (
      <div className="px-5 py-16 text-center">
        <Lock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-[15px] font-semibold text-foreground">Este módulo não está contratado.</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Fale com o Admin Pedix para liberar.</p>
        <Link to="/conta" className="mt-4 inline-block text-[13px] font-semibold text-brand">
          Voltar para a conta
        </Link>
      </div>
    );
  }

  if (moduleCode === "COZINHA" || moduleCode === "GESTAO" || moduleCode === "GROWTH") {
    const target = moduleCode === "COZINHA" ? "/cozinha" : moduleCode === "GESTAO" ? "/gestao" : "/growth";
    const headline =
      moduleCode === "COZINHA"
        ? "Produção por estação."
        : moduleCode === "GESTAO"
          ? "Entregas, caixa, estoque e relatórios."
          : "Cupom, fidelidade e a carteira de clientes da loja.";
    const action =
      moduleCode === "COZINHA" ? "Abrir Cozinha" : moduleCode === "GESTAO" ? "Abrir Gestão" : "Abrir Growth";
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{module?.name}</p>
        <h1 className="mt-3 text-[19px] font-semibold leading-snug text-foreground">{headline}</h1>
        <Link
          to={target}
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-btn bg-brand px-5 text-[14px] font-semibold text-white"
        >
          {action}
        </Link>
      </div>
    );
  }

  if (moduleCode === "MESAS") {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{module?.name}</p>
        <h1 className="mt-3 text-[19px] font-semibold leading-snug text-foreground">Comandas de mesa e de balcão.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          O salão usa o mesmo cardápio e o mesmo pedido da loja.
        </p>
        <Link
          to="/salao"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-btn bg-brand px-5 text-[14px] font-semibold text-white"
        >
          Abrir Salão
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{module?.name}</p>
      <h1 className="mt-3 text-[19px] font-semibold leading-snug text-foreground">
        Módulo contratado. Esta função entra numa próxima versão.
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Seus pedidos antigos continuam disponíveis no painel de Pedidos.
      </p>
      <Link
        to="/pedidos"
        className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-btn bg-brand px-5 text-[14px] font-semibold text-white"
      >
        Ver pedidos
      </Link>
    </div>
  );
}