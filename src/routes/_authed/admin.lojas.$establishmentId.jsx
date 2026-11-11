import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { adminStoreDetail, updateStoreAsAdmin } from "@/lib/admin-fns";
import { brl, centsToInput, MODULES, parseMoneyToCents, SUBSCRIPTION_LABELS } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/admin/lojas/$establishmentId")({ component: AdminStorePage });

const inputClass =
  "mt-1.5 min-h-[42px] w-full rounded-btn border border-input bg-card px-3 text-[13.5px] outline-none focus:border-brand";

function AdminStorePage() {
  const { establishmentId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["admin", "store", establishmentId],
    queryFn: () => adminStoreDetail({ data: { establishment_id: establishmentId } }),
  });

  const [form, setForm] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [modules, setModules] = useState({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data || data.status !== "ok" || form) return;
    setForm({
      name: data.establishment.name ?? "",
      slug: data.establishment.slug ?? "",
      whatsapp: data.establishment.whatsapp ?? "",
      street: data.establishment.street ?? "",
      neighborhood: data.establishment.neighborhood ?? "",
      description: data.establishment.description ?? "",
      owner_email: data.establishment.owner_email ?? "",
    });
    setSubscription({
      status: data.subscription?.status ?? "TRIAL",
      monthly_fee: centsToInput(data.subscription?.monthly_fee_cents ?? 0),
      implementation_fee: centsToInput(data.subscription?.implementation_fee_cents ?? 0),
      implementation_paid: Boolean(data.subscription?.implementation_paid),
    });
    setModules(
      MODULES.reduce((acc, module) => {
        const found = (data.entitlements ?? []).find((entry) => entry.module === module.code);
        acc[module.code] = found ? Boolean(found.enabled) : module.code === "BASE" || module.code === "DELIVERY";
        return acc;
      }, {})
    );
  }, [data, form]);

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (data?.status !== "ok") {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-medium text-foreground">Loja não encontrada.</p>
        <Link to="/admin" className="mt-3 inline-block text-[13px] font-semibold text-brand">
          Voltar
        </Link>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  const { establishment, owner, orders_today: ordersToday } = data;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await updateStoreAsAdmin({
        data: {
          establishment_id: establishmentId,
          establishment: {
            name: form.name.trim(),
            slug: form.slug.trim(),
            whatsapp: form.whatsapp.trim(),
            street: form.street.trim(),
            neighborhood: form.neighborhood.trim(),
            description: form.description.trim(),
            owner_email: form.owner_email.trim(),
          },
          subscription: {
            status: subscription.status,
            monthly_fee_cents: parseMoneyToCents(subscription.monthly_fee),
            implementation_fee_cents: parseMoneyToCents(subscription.implementation_fee),
            implementation_paid: subscription.implementation_paid,
          },
          entitlements: MODULES.map((module) => ({ module: module.code, enabled: modules[module.code] })),
        },
      });
      if (result.status === "ok") {
        setSaved(true);
        queryClient.invalidateQueries({ queryKey: ["admin"] });
      } else {
        setError(result.message ?? "Não foi possível salvar.");
      }
    } catch {
      setError("Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin" className="grid h-10 w-10 place-items-center rounded-btn hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold text-foreground">{establishment.name}</h1>
          <p className="text-[12px] text-muted-foreground">
            /loja/{establishment.slug} · {ordersToday} pedidos hoje
          </p>
        </div>
        <Link
          to="/loja/$slug"
          params={{ slug: establishment.slug }}
          target="_blank"
          className="flex min-h-[40px] items-center gap-1.5 rounded-btn border border-border bg-card px-3 text-[12px] font-semibold text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ver cardápio
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Dados cadastrais
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Nome</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Endereço no Pedix</span>
              <input
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">WhatsApp</span>
              <input
                value={form.whatsapp}
                onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Dono (e-mail)</span>
              <input
                value={form.owner_email}
                onChange={(event) => setForm({ ...form, owner_email: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Rua</span>
              <input
                value={form.street}
                onChange={(event) => setForm({ ...form, street: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Bairro</span>
              <input
                value={form.neighborhood}
                onChange={(event) => setForm({ ...form, neighborhood: event.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-foreground">Descrição</span>
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className={inputClass}
            />
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Dono atual: {owner ? `${owner.full_name || "sem nome"} · ${owner.email}` : form.owner_email || "sem conta vinculada"}
          </p>
        </section>

        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Assinatura</h2>
          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-foreground">Status</span>
            <select
              value={subscription.status}
              onChange={(event) => setSubscription({ ...subscription, status: event.target.value })}
              className={inputClass}
            >
              {Object.entries(SUBSCRIPTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Mensalidade (R$)</span>
              <input
                value={subscription.monthly_fee}
                onChange={(event) => setSubscription({ ...subscription, monthly_fee: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Implantação (R$)</span>
              <input
                value={subscription.implementation_fee}
                onChange={(event) => setSubscription({ ...subscription, implementation_fee: event.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          <label className="mt-3 flex min-h-[42px] items-center justify-between rounded-btn border border-border px-3">
            <span className="text-[12.5px] text-foreground">Implantação paga</span>
            <input
              type="checkbox"
              checked={subscription.implementation_paid}
              onChange={(event) => setSubscription({ ...subscription, implementation_paid: event.target.checked })}
              className="h-4 w-4 accent-[#D0121A]"
            />
          </label>
          <p className="mt-2 rounded-btn bg-warning/[0.08] px-3 py-2 text-[10.5px] font-medium leading-relaxed text-warning">
            valor de demonstração — hipótese, não é preço aprovado
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Mensalidade atual: {brl(parseMoneyToCents(subscription.monthly_fee))} · sem comissão por pedido.
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Módulos</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => {
            const disabled = module.code === "BASE";
            const on = disabled ? true : Boolean(modules[module.code]);
            return (
              <div
                key={module.code}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-btn border border-border px-3 py-2.5",
                  !module.available && "bg-secondary/40"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{module.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {module.available ? (on ? "Ligado" : "Desligado") : "Em breve"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={module.name}
                  disabled={disabled}
                  onClick={() => setModules({ ...modules, [module.code]: !on })}
                  className={cn(
                    "relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors",
                    on ? "bg-success" : "bg-border",
                    disabled && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all",
                      on ? "left-[21px]" : "left-[3px]"
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Pedix Base não pode ser desligado. Desligar Delivery ou suspender a assinatura preserva pedidos, clientes e
          catálogo.
        </p>
      </section>

      {error && (
        <p className="mt-3 rounded-btn border border-brand/30 bg-brand/[0.06] px-3.5 py-2.5 text-[12.5px] font-medium text-brand">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-[48px] rounded-btn bg-brand px-6 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Salvando..." : "Salvar alterações"}
        </button>
        {saved && <span className="text-[12px] font-semibold text-success">Salvo.</span>}
      </div>
    </div>
  );
}