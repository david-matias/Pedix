import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { useLojista } from "@/components/lojista/LojistaProvider";
import TablesSettings from "@/components/salao/TablesSettings";
import { base44 } from "@/api/base44Client";
import {
  asList,
  brl,
  centsToInput,
  formatPhone,
  parseMoneyToCents,
  RESERVED_SLUG_MESSAGE,
  RESERVED_SLUGS,
  WEEKDAYS,
} from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/minha-loja")({ component: StoreSettingsPage });

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputClass =
  "mt-1.5 min-h-[46px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand";

function StoreSettingsPage() {
  const { data: context, refetch } = useLojista();
  const establishment = context?.establishment;
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["loja-settings", establishment?.id],
    enabled: Boolean(establishment?.id),
    queryFn: async () => {
      const [hours, zones, payments] = await Promise.all([
        base44.entities.OpeningHour.filter({ establishment_id: establishment.id }),
        base44.entities.DeliveryZone.filter({ establishment_id: establishment.id }),
        base44.entities.PaymentMethod.filter({ establishment_id: establishment.id }),
      ]);
      return { hours: asList(hours), zones: asList(zones), payments: asList(payments) };
    },
  });

  const [form, setForm] = useState(null);
  const [hours, setHours] = useState([]);
  const [zones, setZones] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!establishment || form) return;
    setForm({
      name: establishment.name ?? "",
      slug: establishment.slug ?? "",
      description: establishment.description ?? "",
      whatsapp: establishment.whatsapp ?? "",
      street: establishment.street ?? "",
      neighborhood: establishment.neighborhood ?? "",
      logo_url: establishment.logo_url ?? "",
      cover_url: establishment.cover_url ?? "",
      delivery_enabled: establishment.delivery_enabled !== false,
      pickup_enabled: establishment.pickup_enabled !== false,
      min_order: centsToInput(establishment.min_order_cents ?? 0),
      eta_delivery_min: String(establishment.eta_delivery_min ?? 40),
      eta_pickup_min: String(establishment.eta_pickup_min ?? 20),
    });
  }, [establishment, form]);

  useEffect(() => {
    if (!data) return;
    setHours(
      WEEKDAYS.map((day) => {
        const found = data.hours.find((entry) => Number(entry.weekday) === day.value);
        return {
          weekday: day.value,
          opens_at: found?.opens_at ?? "18:00",
          closes_at: found?.closes_at ?? "23:00",
          closed: found?.closed ?? false,
        };
      })
    );
    setZones(data.zones.map((zone) => ({ ...zone, fee: centsToInput(zone.fee_cents) })));
    setPayments(data.payments);
  }, [data]);

  if (isPending || !form) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function save() {
    const slug = form.slug.trim().toLowerCase();
    if (RESERVED_SLUGS.includes(slug)) {
      setError(RESERVED_SLUG_MESSAGE);
      return;
    }
    if (!form.delivery_enabled && !form.pickup_enabled) {
      setError("O cliente não terá como pedir. Ligue a entrega ou a retirada.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await base44.entities.Establishment.update(establishment.id, {
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        whatsapp: form.whatsapp.trim(),
        street: form.street.trim(),
        neighborhood: form.neighborhood.trim(),
        logo_url: form.logo_url.trim(),
        cover_url: form.cover_url.trim(),
        delivery_enabled: form.delivery_enabled,
        pickup_enabled: form.pickup_enabled,
        min_order_cents: parseMoneyToCents(form.min_order),
        eta_delivery_min: Number(form.eta_delivery_min) || 40,
        eta_pickup_min: Number(form.eta_pickup_min) || 20,
      });

      for (const entry of hours) {
        const existing = asList(data.hours).find((item) => Number(item.weekday) === entry.weekday);
        const payload = {
          establishment_id: establishment.id,
          weekday: entry.weekday,
          opens_at: entry.opens_at,
          closes_at: entry.closes_at,
          closed: entry.closed,
        };
        if (existing) await base44.entities.OpeningHour.update(existing.id, payload);
        else await base44.entities.OpeningHour.create(payload);
      }

      for (const zone of zones) await base44.entities.DeliveryZone.delete(zone.id);
      if (zones.length > 0) {
        await base44.entities.DeliveryZone.bulkCreate(
          zones
            .filter((zone) => zone.neighborhood.trim())
            .map((zone) => ({
              establishment_id: establishment.id,
              neighborhood: zone.neighborhood.trim(),
              fee_cents: parseMoneyToCents(zone.fee),
              active: zone.active !== false,
            }))
        );
      }

      for (const payment of payments) {
        await base44.entities.PaymentMethod.update(payment.id, { active: payment.active !== false });
      }

      await queryClient.invalidateQueries({ queryKey: ["loja-settings", establishment.id] });
      await refetch();
      setSaved(true);
    } catch {
      setError("Não foi possível salvar as configurações.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-28 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Loja</h1>
          <p className="mt-1 text-[11.5px] text-muted-foreground">Tudo o que o cliente vê no link da loja.</p>
        </div>
        <Link
          to="/loja/$slug"
          params={{ slug: form.slug || establishment.slug }}
          target="_blank"
          className="flex min-h-[40px] items-center gap-1.5 rounded-btn border border-border bg-card px-3 text-[12px] font-semibold text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Pré-visualizar
        </Link>
      </div>

      <section className="mt-4 space-y-3 rounded-card border border-border bg-card p-4">
        <Field label="Nome da loja">
          <input value={form.name} onChange={(event) => update({ name: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Endereço no Pedix" hint={`Link público: /loja/${form.slug || "sua-loja"}`}>
          <input value={form.slug} onChange={(event) => update({ slug: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Descrição">
          <input
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="WhatsApp" hint={form.whatsapp ? formatPhone(form.whatsapp) : "(85) 9xxxx-xxxx"}>
          <input value={form.whatsapp} onChange={(event) => update({ whatsapp: event.target.value })} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rua e número">
            <input value={form.street} onChange={(event) => update({ street: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Bairro">
            <input
              value={form.neighborhood}
              onChange={(event) => update({ neighborhood: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Capa (URL)">
          <input value={form.cover_url} onChange={(event) => update({ cover_url: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Logo (URL)">
          <input value={form.logo_url} onChange={(event) => update({ logo_url: event.target.value })} className={inputClass} />
        </Field>
      </section>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Horários</h2>
        <div className="mt-2 space-y-2">
          {hours.map((entry, index) => (
            <div key={entry.weekday} className="flex items-center gap-2">
              <span className="w-[68px] shrink-0 text-[12.5px] text-foreground">
                {WEEKDAYS.find((day) => day.value === entry.weekday)?.label}
              </span>
              <input
                type="time"
                value={entry.opens_at}
                disabled={entry.closed}
                onChange={(event) =>
                  setHours(hours.map((hour, position) => (position === index ? { ...hour, opens_at: event.target.value } : hour)))
                }
                className="h-[38px] rounded-btn border border-input px-2 text-[12.5px] disabled:opacity-40"
              />
              <span className="text-[11px] text-muted-foreground">às</span>
              <input
                type="time"
                value={entry.closes_at}
                disabled={entry.closed}
                onChange={(event) =>
                  setHours(hours.map((hour, position) => (position === index ? { ...hour, closes_at: event.target.value } : hour)))
                }
                className="h-[38px] rounded-btn border border-input px-2 text-[12.5px] disabled:opacity-40"
              />
              <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={entry.closed}
                  onChange={(event) =>
                    setHours(hours.map((hour, position) => (position === index ? { ...hour, closed: event.target.checked } : hour)))
                  }
                  className="h-4 w-4 accent-[#D0121A]"
                />
                fechado
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-card border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pedidos</h2>
        <label className="flex min-h-[46px] items-center justify-between rounded-btn border border-border px-3.5">
          <span className="text-[13.5px] text-foreground">Entrega</span>
          <input
            type="checkbox"
            checked={form.delivery_enabled}
            onChange={(event) => update({ delivery_enabled: event.target.checked })}
            className="h-5 w-5 accent-[#D0121A]"
          />
        </label>
        <label className="flex min-h-[46px] items-center justify-between rounded-btn border border-border px-3.5">
          <span className="text-[13.5px] text-foreground">Retirada</span>
          <input
            type="checkbox"
            checked={form.pickup_enabled}
            onChange={(event) => update({ pickup_enabled: event.target.checked })}
            className="h-5 w-5 accent-[#D0121A]"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Mínimo (R$)">
            <input value={form.min_order} onChange={(event) => update({ min_order: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Entrega (min)">
            <input
              type="number"
              value={form.eta_delivery_min}
              onChange={(event) => update({ eta_delivery_min: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Retirada (min)">
            <input
              type="number"
              value={form.eta_pickup_min}
              onChange={(event) => update({ eta_pickup_min: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Zonas de entrega</h2>
          <button
            type="button"
            onClick={() => setZones([...zones, { id: `new-${Date.now()}`, neighborhood: "", fee: "0,00", active: true }])}
            className="flex min-h-[34px] items-center gap-1 text-[12px] font-semibold text-brand"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Bairro
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {zones.map((zone, index) => (
            <div key={zone.id} className="flex items-center gap-1.5">
              <input
                value={zone.neighborhood}
                onChange={(event) =>
                  setZones(zones.map((entry, position) => (position === index ? { ...entry, neighborhood: event.target.value } : entry)))
                }
                placeholder="Bairro"
                className="min-h-[40px] flex-1 rounded-btn border border-input px-2.5 text-[13px]"
              />
              <div className="flex items-center gap-1 rounded-btn border border-input px-2">
                <span className="text-[11px] text-muted-foreground">R$</span>
                <input
                  value={zone.fee}
                  onChange={(event) =>
                    setZones(zones.map((entry, position) => (position === index ? { ...entry, fee: event.target.value } : entry)))
                  }
                  className="h-[38px] w-16 text-[13px] outline-none"
                />
              </div>
              <label className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={zone.active !== false}
                  onChange={(event) =>
                    setZones(zones.map((entry, position) => (position === index ? { ...entry, active: event.target.checked } : entry)))
                  }
                  className="h-4 w-4 accent-[#D0121A]"
                />
                ativa
              </label>
              <button
                type="button"
                aria-label="Remover bairro"
                onClick={() => setZones(zones.filter((_, position) => position !== index))}
                className="grid h-9 w-7 place-items-center text-muted-foreground hover:text-brand"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {zones.length === 0 && (
            <p className="text-[11.5px] text-muted-foreground">Nenhum bairro cadastrado. Sem zona ativa não há entrega.</p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pagamento</h2>
        <div className="mt-2 space-y-2">
          {payments.map((payment, index) => (
            <label key={payment.id} className="flex min-h-[44px] items-center justify-between">
              <span className="text-[13.5px] text-foreground">{payment.label}</span>
              <input
                type="checkbox"
                checked={payment.active !== false}
                onChange={(event) =>
                  setPayments(
                    payments.map((entry, position) =>
                      position === index ? { ...entry, active: event.target.checked } : entry
                    )
                  )
                }
                className="h-5 w-5 accent-[#D0121A]"
              />
            </label>
          ))}
        </div>
        {payments.find((payment) => payment.code === "CASH")?.active !== false && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Dinheiro pede “troco para quanto?” ao cliente; o campo pode ficar vazio.
          </p>
        )}
      </section>

      {(context?.enabled_modules ?? []).includes("MESAS") && <TablesSettings establishmentId={establishment.id} />}

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Demonstração</h2>
        <label className="mt-2 flex min-h-[44px] items-center justify-between">
          <span className="text-[13.5px] text-foreground">Simular falha no WhatsApp</span>
          <input
            type="checkbox"
            checked={Boolean(context?.establishment?.whatsapp_fail_simulated)}
            onChange={async (event) => {
              await base44.entities.Establishment.update(establishment.id, {
                whatsapp_fail_simulated: event.target.checked,
              });
              await refetch();
            }}
            className="h-5 w-5 accent-[#D0121A]"
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          Ligado, o pedido continua gravado e o registro de aviso fica como falha.
        </p>
      </section>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Pedido mínimo atual: {brl(parseMoneyToCents(form.min_order))} · Trairi · CE
      </p>

      {error && (
        <p className="mt-3 rounded-btn border border-brand/30 bg-brand/[0.06] px-3.5 py-2.5 text-[12.5px] font-medium text-brand">
          {error}
        </p>
      )}

      <div className={cn("fixed inset-x-0 bottom-[70px] z-20 mx-auto w-full max-w-[520px] border-t border-border bg-card/95 px-4 py-3 backdrop-blur")}>
        {saved && <p className="mb-2 text-center text-[12px] font-semibold text-success">Alterações salvas.</p>}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-[48px] w-full rounded-btn bg-brand text-[14.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}