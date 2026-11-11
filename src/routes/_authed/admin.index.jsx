import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { adminOverview } from "@/lib/admin-fns";
import NewStoreDialog from "@/components/admin/NewStoreDialog";
import { brl, MODULES, SUBSCRIPTION_LABELS } from "@/lib/pedix";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authed/admin/")({ component: AdminHome });

const STATUS_STYLES = {
  ACTIVE: "bg-success/10 text-success",
  TRIAL: "bg-secondary text-foreground",
  PAST_DUE: "bg-warning/10 text-warning",
  SUSPENDED: "bg-brand/10 text-brand",
};

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[24px] font-semibold leading-none text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AdminHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => adminOverview(),
  });

  const stores = (data?.stores ?? []).filter((store) =>
    store.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-foreground">Estabelecimentos</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Assinaturas, módulos e pedidos das lojas do Pedix.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex min-h-[44px] items-center gap-1.5 rounded-btn bg-brand px-4 text-[13px] font-semibold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Nova loja
        </button>
      </div>

      {isPending ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Lojas ativas" value={data.stats.active_stores} hint={`${data.stats.total_stores} no total`} />
            <Stat
              label="MRR de demonstração"
              value={brl(data.stats.mrr_cents)}
              hint="Mensalidades ativas e em demonstração"
            />
            <Stat label="Pedidos hoje" value={data.stats.orders_today} hint="Somando todas as lojas" />
            <Stat label="Avisos com falha" value={data.stats.whatsapp_failures} hint="WhatsApp não saiu" />
          </div>

          <div className="mt-6 flex items-center gap-2">
            <div className="relative w-full max-w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome"
                className="min-h-[44px] w-full rounded-btn border border-input bg-card pl-9 pr-3 text-[13px] outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-card border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Módulos ligados</TableHead>
                  <TableHead className="text-right">Pedidos hoje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-[13px] text-muted-foreground">
                      Nenhuma loja encontrada. Use “Nova loja” para cadastrar a primeira.
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((store) => (
                    <TableRow
                      key={store.id}
                      onClick={() =>
                        navigate({ to: "/admin/lojas/$establishmentId", params: { establishmentId: store.id } })
                      }
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium text-foreground">{store.name}</TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">/loja/{store.slug}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
                            STATUS_STYLES[store.subscription_status] ?? "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {SUBSCRIPTION_LABELS[store.subscription_status] ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">
                        {store.modules
                          .map((code) => MODULES.find((module) => module.code === code)?.name.replace("Pedix ", "") ?? code)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{store.orders_today}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <NewStoreDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(store) => {
          queryClient.invalidateQueries({ queryKey: ["admin"] });
          navigate({ to: "/admin/lojas/$establishmentId", params: { establishmentId: store.id } });
        }}
      />
    </div>
  );
}