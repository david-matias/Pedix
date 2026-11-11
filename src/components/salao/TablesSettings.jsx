import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asList } from "@/lib/pedix";
import { AREA_LABELS } from "@/components/salao/minutes";
import { cn } from "@/lib/utils";

const AREAS = Object.entries(AREA_LABELS);

const inputClass =
  "mt-1.5 min-h-[46px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand";

function TableDialog({ open, onOpenChange, table, onSave, busy, error }) {
  const [form, setForm] = useState({ number: "", name: "", seats: "4", area: "SALAO" });

  useEffect(() => {
    if (!open) return;
    setForm({
      number: table ? String(table.number ?? "") : "",
      name: table?.name ?? "",
      seats: String(table?.seats ?? 4),
      area: table?.area ?? "SALAO",
    });
  }, [open, table]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">{table ? "Editar mesa" : "Nova mesa"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="table-number" className="text-[12px] font-semibold">
              Número
            </Label>
            <Input
              id="table-number"
              value={form.number}
              onChange={(event) => setForm({ ...form, number: event.target.value.replace(/\D/g, "") })}
              inputMode="numeric"
              className="mt-1.5 h-[46px]"
            />
          </div>
          <div>
            <Label htmlFor="table-seats" className="text-[12px] font-semibold">
              Lugares
            </Label>
            <Input
              id="table-seats"
              value={form.seats}
              onChange={(event) => setForm({ ...form, seats: event.target.value.replace(/\D/g, "") })}
              inputMode="numeric"
              className="mt-1.5 h-[46px]"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="table-name" className="text-[12px] font-semibold">
            Nome (opcional)
          </Label>
          <Input
            id="table-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={40}
            placeholder="Ex.: Varanda 1"
            className="mt-1.5 h-[46px]"
          />
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Área</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {AREAS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm({ ...form, area: value })}
                className={cn(
                  "min-h-[44px] rounded-btn border text-[13px] font-medium",
                  form.area === value ? "border-brand bg-brand/[0.04] text-foreground" : "border-border bg-card text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="rounded-btn bg-brand/[0.06] px-3 py-2 text-[12px] text-brand">{error}</p>}

        <Button
          type="button"
          disabled={busy || !form.number}
          onClick={() =>
            onSave({
              number: Number(form.number),
              name: form.name.trim(),
              seats: Math.max(1, Number(form.seats || 4)),
              area: form.area,
            })
          }
          className="h-12 w-full rounded-btn bg-brand text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          Salvar mesa
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Mesas da loja: criar, renomear, lugares, área, ordenar e desativar. */
export default function TablesSettings({ establishmentId }) {
  const queryClient = useQueryClient();
  const queryKey = ["mesas", establishmentId];

  const { data, isPending } = useQuery({
    queryKey,
    enabled: Boolean(establishmentId),
    queryFn: async () => {
      const [tables, orders] = await Promise.all([
        base44.entities.Table.filter({ establishment_id: establishmentId }),
        base44.entities.Order.filter({
          establishment_id: establishmentId,
          status: { $in: ["ABERTA", "CONTA"] },
        }),
      ]);
      return {
        tables: asList(tables).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.number ?? 0) - (b.number ?? 0)
        ),
        occupied: asList(orders)
          .map((order) => order.table_id)
          .filter(Boolean),
      };
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState("");

  const tables = data?.tables ?? [];
  const occupied = new Set(data?.occupied ?? []);
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  async function saveTable(values) {
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await base44.entities.Table.update(editing.id, values);
      } else {
        await base44.entities.Table.create({
          establishment_id: establishmentId,
          ...values,
          active: true,
          sort_order: tables.length + 1,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err.message ?? "Não foi possível salvar a mesa.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(table) {
    if (table.active !== false && occupied.has(table.id)) {
      setBlocked(`A mesa ${table.number} está ocupada. Feche a comanda antes de desativar.`);
      return;
    }
    setBlocked("");
    await base44.entities.Table.update(table.id, { active: table.active === false });
    await refresh();
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= tables.length) return;
    const reordered = Array.from(tables);
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    queryClient.setQueryData(queryKey, { tables: reordered, occupied: data?.occupied ?? [] });
    await base44.entities.Table.bulkUpdate(
      reordered.map((table, position) => ({ id: table.id, sort_order: position + 1 }))
    );
    await refresh();
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Mesas</h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setError("");
            setDialogOpen(true);
          }}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nova mesa
        </button>
      </div>

      {blocked && <p className="mt-2 rounded-btn bg-brand/[0.06] px-3 py-2 text-[11.5px] text-brand">{blocked}</p>}

      {isPending ? (
        <div className="mt-3 grid place-items-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : tables.length === 0 ? (
        <p className="mt-2 rounded-card border border-dashed border-border px-3.5 py-6 text-center text-[12px] text-muted-foreground">
          Nenhuma mesa cadastrada ainda.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
          {tables.map((table, index) => {
            const isOccupied = occupied.has(table.id);
            const inactive = table.active === false;
            return (
              <li key={table.id} className="flex items-center gap-2 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13.5px] font-semibold text-foreground", inactive && "opacity-50")}>
                    {table.name?.trim() || `Mesa ${table.number}`}
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                      {table.seats ?? 4} lugares · {AREA_LABELS[table.area] ?? "Salão"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {inactive ? "Desativada" : isOccupied ? "Ocupada agora" : "Livre"}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={`Subir ${table.number}`}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="grid h-8 w-8 place-items-center rounded-btn border border-border text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${table.number}`}
                  onClick={() => move(index, 1)}
                  disabled={index === tables.length - 1}
                  className="grid h-8 w-8 place-items-center rounded-btn border border-border text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Editar ${table.number}`}
                  onClick={() => {
                    setEditing(table);
                    setError("");
                    setDialogOpen(true);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-btn border border-border text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(table)}
                  className={cn(
                    "min-h-[32px] shrink-0 rounded-btn border px-2.5 text-[11.5px] font-semibold",
                    inactive ? "border-border text-foreground" : "border-border text-brand"
                  )}
                >
                  {inactive ? "Ativar" : "Desativar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <TableDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
        table={editing}
        onSave={saveTable}
        busy={busy}
        error={error}
      />

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Mesa ocupada não pode ser desativada. O total da comanda continua no pedido.
      </p>
    </section>
  );
}