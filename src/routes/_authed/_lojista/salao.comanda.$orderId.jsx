import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRightLeft, ChefHat, Loader2, Plus, XCircle } from "lucide-react";
import CancelComandaDialog from "@/components/salao/CancelComandaDialog";
import ComandaHeader from "@/components/salao/ComandaHeader";
import ComandaItems from "@/components/salao/ComandaItems";
import PaymentDialog from "@/components/salao/PaymentDialog";
import ProductPickerSheet from "@/components/salao/ProductPickerSheet";
import TransferDialog from "@/components/salao/TransferDialog";
import { useSalao } from "@/components/salao/useSalao";
import { sendComandaToKitchen } from "@/lib/cozinha-fns";
import { brl, dateTimeBR } from "@/lib/pedix";
import {
  addComandaItem,
  cancelComanda,
  changeItemQuantity,
  closeComanda,
  getComanda,
  removeComandaItem,
  requestBill,
  resumeComanda,
  transferComanda,
} from "@/lib/salao-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/salao/comanda/$orderId")({
  head: () => ({ meta: [{ title: "Comanda · Pedix" }] }),
  component: ComandaPage,
});

const EMPTY_CATALOG = { categories: [], products: [], option_groups: [], options: [], combos: [], combo_items: [] };

function ComandaPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const addItem = useServerFn(addComandaItem);
  const changeQty = useServerFn(changeItemQuantity);
  const removeItem = useServerFn(removeComandaItem);
  const askBill = useServerFn(requestBill);
  const resume = useServerFn(resumeComanda);
  const close = useServerFn(closeComanda);
  const cancel = useServerFn(cancelComanda);
  const transfer = useServerFn(transferComanda);
  const sendKitchen = useServerFn(sendComandaToKitchen);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const query = useQuery({
    queryKey: ["salao", "comanda", orderId],
    queryFn: () => getComanda({ data: { order_id: orderId } }),
    refetchInterval: 15000,
  });

  const { data: salao } = useSalao();

  const data = query.data;
  const order = data?.order;
  const isTable = order?.order_channel === "TABLE";
  const back = isTable ? "/salao" : "/salao/balcao";

  async function act(fn, payload, onOk) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await fn({ data: payload });
      if (result?.status === "ok") {
        await queryClient.invalidateQueries({ queryKey: ["salao"] });
        onOk?.(result);
      } else if (result?.status === "price_changed") {
        setPickerOpen(false);
        setMessage({
          tone: "warn",
          text: `O preço de ${result.product_name} mudou para ${brl(result.unit_price_cents)}. Confira o valor novo e lance de novo.`,
        });
      } else {
        setPickerOpen(false);
        setDialogError(result?.message ?? "Não foi possível concluir.");
        setMessage({ tone: "error", text: result?.message ?? "Não foi possível concluir." });
      }
    } catch (error) {
      setMessage({ tone: "error", text: error.message ?? "Não foi possível concluir." });
    } finally {
      setBusy(false);
    }
  }

  if (query.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (!data || data.status !== "ok") {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[15px] font-semibold text-foreground">Comanda não encontrada.</p>
        <Link to="/salao" className="mt-4 inline-block text-[13px] font-semibold text-brand">
          Voltar ao salão
        </Link>
      </div>
    );
  }

  const items = data.items ?? [];
  const subtotal = items
    .filter((item) => item.removed !== true)
    .reduce((sum, item) => sum + Number(item.line_total_cents ?? 0), 0);
  const moduleOn = data.module_enabled;
  const open = order.status === "ABERTA" || order.status === "CONTA";
  const canLaunch = moduleOn && order.status === "ABERTA";
  const kitchen = data.kitchen ?? { enabled: false, pending: 0, sent: 0 };

  return (
    <div className="px-4 pb-8 pt-4">
      <Link to={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {isTable ? "Mapa do salão" : "Balcão"}
      </Link>

      <div className="mt-3">
        <ComandaHeader order={order} table={data.table} />
      </div>

      {!moduleOn && (
        <p className="mt-3 rounded-btn bg-secondary px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          O Pedix Mesas está desligado nesta loja. Esta comanda fica só de leitura, com os itens e o total gravados.
        </p>
      )}

      {order.status === "COMPLETED" && (
        <p className="mt-3 rounded-btn bg-success/10 px-3 py-2 text-[11.5px] leading-relaxed text-success">
          Comanda encerrada{order.closed_at ? ` em ${dateTimeBR(order.closed_at)}` : ""}.
          {order.payment_code ? " A forma de pagamento ficou gravada no pedido." : ""}
        </p>
      )}

      {order.status === "CONTA" && moduleOn && (
        <p className="mt-3 rounded-btn bg-warning/10 px-3 py-2 text-[11.5px] leading-relaxed text-warning">
          Conta pedida. Nenhum item novo entra até você tocar em “Voltar a lançar”.
        </p>
      )}

      {order.status === "CANCELLED" && (
        <p className="mt-3 rounded-btn bg-secondary px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Comanda cancelada{order.cancel_reason ? `: ${order.cancel_reason}` : ""}. Os itens ficam no histórico.
        </p>
      )}

      {message && (
        <p
          className={cn(
            "mt-3 rounded-btn px-3 py-2 text-[12px] leading-relaxed",
            message.tone === "warn" ? "bg-warning/10 text-warning" : "bg-brand/[0.06] text-brand"
          )}
        >
          {message.text}
        </p>
      )}

      <ComandaItems
        items={items}
        options={data.options ?? []}
        editable={canLaunch}
        busy={busy}
        onQuantity={(item, quantity) => act(changeQty, { item_id: item.id, quantity })}
        onRemove={(item) => act(removeItem, { item_id: item.id })}
      />

      {open && (
        <div className="mt-3 flex items-center justify-between rounded-card border border-border bg-card px-3.5 py-3">
          <p className="text-[12.5px] font-medium text-muted-foreground">Subtotal</p>
          <p className="text-[17px] font-semibold text-foreground">{brl(subtotal)}</p>
        </div>
      )}

      {open && moduleOn && (
        <div className="mt-3 space-y-2">
          {canLaunch && (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setPickerOpen(true);
              }}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-btn bg-brand px-4 text-[14.5px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Lançar item
            </button>
          )}

          {kitchen.enabled && (kitchen.pending > 0 || kitchen.sent > 0) && (
            <div className="rounded-card border border-border bg-card px-3.5 py-3">
              <p className="text-[11.5px] text-muted-foreground">
                Cozinha: {kitchen.sent} {kitchen.sent === 1 ? "item enviado" : "itens enviados"}
                {kitchen.pending > 0 ? ` · ${kitchen.pending} a enviar` : " · tudo enviado"}
              </p>
              <button
                type="button"
                disabled={busy || kitchen.pending === 0}
                onClick={() =>
                  act(sendKitchen, { order_id: order.id }, (result) =>
                    setMessage({
                      tone: "ok",
                      text: `${result.created} ${result.created === 1 ? "ficha enviada" : "fichas enviadas"} para a cozinha. A comanda continua aberta.`,
                    })
                  )
                }
                className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-btn border border-border bg-card text-[13px] font-semibold text-foreground disabled:opacity-50"
              >
                <ChefHat className="h-3.5 w-3.5" aria-hidden="true" />
                Enviar para a cozinha
              </button>
            </div>
          )}

          {order.status === "ABERTA" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act(askBill, { order_id: order.id })}
              className="flex min-h-[48px] w-full items-center justify-center rounded-btn border border-border bg-card px-4 text-[14px] font-semibold text-foreground"
            >
              Pedir a conta
            </button>
          )}

          {order.status === "CONTA" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act(resume, { order_id: order.id })}
              className="flex min-h-[48px] w-full items-center justify-center rounded-btn border border-border bg-card px-4 text-[14px] font-semibold text-foreground"
            >
              Voltar a lançar
            </button>
          )}

          <button
            type="button"
            disabled={busy || subtotal <= 0}
            onClick={() => {
              setDialogError("");
              setPaymentOpen(true);
            }}
            className="flex min-h-[50px] w-full items-center justify-center rounded-btn bg-brand px-4 text-[14.5px] font-semibold text-white disabled:opacity-50"
          >
            {isTable ? "Fechar comanda" : "Receber e concluir"}
          </button>

          {!isTable && (
            <Link
              to="/salao/balcao"
              className="flex min-h-[46px] w-full items-center justify-center rounded-btn border border-dashed border-border px-4 text-[13px] font-medium text-muted-foreground"
            >
              Deixar em aberto
            </Link>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            {isTable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDialogError("");
                  setTransferOpen(true);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-btn border border-border bg-card text-[12.5px] font-medium text-foreground"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Transferir
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDialogError("");
                setCancelOpen(true);
              }}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-btn border border-border bg-card text-[12.5px] font-medium text-brand"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar comanda
            </button>
          </div>
        </div>
      )}

      <ProductPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        catalog={data.catalog ?? EMPTY_CATALOG}
        onAdd={(payload, expectedUnit) =>
          act(
            addItem,
            { order_id: order.id, ...payload, expected_unit_price_cents: expectedUnit },
            () => setPickerOpen(false)
          )
        }
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        payments={data.payments ?? []}
        totalCents={subtotal}
        busy={busy}
        error={dialogError}
        allowCoupon={data.growth === true}
        onConfirm={({ payment_code, change_for_cents, coupon_code }) =>
          act(
            close,
            { order_id: order.id, payment_code, change_for_cents, coupon_code },
            () => {
              setPaymentOpen(false);
              navigate({ to: isTable ? "/salao" : "/salao/balcao" });
            }
          )
        }
      />

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        tables={salao?.tables ?? []}
        currentTableId={order.table_id}
        busy={busy}
        onConfirm={(tableId) =>
          act(transfer, { order_id: order.id, table_id: tableId }, () => setTransferOpen(false))
        }
      />

      <CancelComandaDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        busy={busy}
        error={dialogError}
        onConfirm={(reason) =>
          act(cancel, { order_id: order.id, reason }, () => {
            setCancelOpen(false);
            navigate({ to: isTable ? "/salao" : "/salao/balcao" });
          })
        }
      />
    </div>
  );
}