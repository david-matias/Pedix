import { brl, PAYMENT_LABELS } from "@/lib/pedix";
import { cn } from "@/lib/utils";

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={cn("tabular-nums", strong ? "text-[15px] font-semibold text-foreground" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

export default function CashSummaryCard({ summary, countedCents, differenceCents }) {
  if (!summary) return null;

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Row label="Fundo inicial" value={brl(summary.opening_float_cents)} />
        {summary.by_payment.length === 0 ? (
          <Row label="Vendas do turno" value={brl(0)} />
        ) : (
          summary.by_payment.map((entry) => (
            <Row
              key={entry.code}
              label={`Vendas · ${PAYMENT_LABELS[entry.code] ?? entry.code}`}
              value={brl(entry.total_cents)}
            />
          ))
        )}
        <Row label="Suprimentos" value={brl(summary.supplies_cents)} />
        <Row label="Sangrias" value={`- ${brl(summary.withdrawals_cents)}`} />
        <div className="mt-2 border-t border-border pt-2">
          <Row label="Saldo esperado em dinheiro" value={brl(summary.expected_cash_cents)} strong />
        </div>
        {countedCents != null && (
          <>
            <Row label="Contado" value={brl(countedCents)} />
            <Row
              label="Diferença"
              value={brl(differenceCents ?? 0)}
              strong
            />
          </>
        )}
      </div>
    </section>
  );
}