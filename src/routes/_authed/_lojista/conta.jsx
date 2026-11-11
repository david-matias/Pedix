import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { brl, MODULES, SUBSCRIPTION_LABELS } from "@/lib/pedix";

export const Route = createFileRoute("/_authed/_lojista/conta")({ component: AccountPage });

function AccountPage() {
  const { data: context } = useLojista();
  const { establishment, subscription, entitlements, user } = context;
  const enabled = new Set((entitlements ?? []).filter((entry) => entry.enabled).map((entry) => entry.module));

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="text-[20px] font-semibold text-foreground">Conta</h1>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <p className="text-[14.5px] font-semibold text-foreground">{user.full_name || "Lojista"}</p>
        <p className="text-[12.5px] text-muted-foreground">{user.email}</p>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Loja vinculada</p>
          <p className="mt-1 text-[13.5px] text-foreground">{establishment.name}</p>
          <p className="text-[11.5px] text-muted-foreground">/loja/{establishment.slug}</p>
        </div>
      </section>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Módulos</h2>
        <ul className="mt-2 divide-y divide-border">
          {MODULES.map((module) => {
            const active = enabled.has(module.code);
            return (
              <li key={module.code} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-foreground">{module.name}</p>
                  <p className="text-[11px] text-muted-foreground">{module.description}</p>
                </div>
                {active ? (
                  <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[10.5px] font-semibold text-success">
                    Ativo
                  </span>
                ) : module.available ? (
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground">
                    Desligado
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Em breve
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {MODULES.filter((module) => enabled.has(module.code) && !module.available).map((module) => (
          <Link
            key={module.code}
            to="/modulo/$module"
            params={{ module: module.code }}
            className="mt-2 block text-[12px] font-semibold text-brand"
          >
            Abrir {module.name}
          </Link>
        ))}
      </section>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Cobrança</h2>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground">
            {subscription ? SUBSCRIPTION_LABELS[subscription.status] : "—"}
          </span>
        </div>

        <dl className="mt-3 space-y-2 text-[13px]">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Mensalidade</dt>
            <dd className="font-medium text-foreground">{brl(subscription?.monthly_fee_cents ?? 0)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Taxa de implantação</dt>
            <dd className="font-medium text-foreground">
              {brl(subscription?.implementation_fee_cents ?? 0)}
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                {subscription?.implementation_paid ? "· paga" : "· em aberto"}
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-3 rounded-btn bg-warning/[0.08] px-3 py-2 text-[11px] font-medium leading-relaxed text-warning">
          valor de demonstração — hipótese, não é preço aprovado
        </p>

        <p className="mt-3 text-[12.5px] leading-relaxed text-foreground">
          O Pedix não cobra comissão sobre os pedidos.
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Você paga a assinatura mensal fixa e a implantação assistida. Nada é descontado por pedido vendido.
        </p>
      </section>
    </div>
  );
}