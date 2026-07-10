import { Button } from "@platform/ui";
import { PAYMENT_METHOD_LABELS, type Bill } from "@platform/contracts";
import { useEffect } from "react";
import { billChannelLabel } from "../lib/orderSales";
import { Badge } from "../ui/Badge";
import { linkActionClass, linkDangerClass, linkWarningClass } from "../lib/themeClasses";

type Props = {
  bill: Bill;
  branchName: string;
  onClose: () => void;
  onReprint?: () => void;
  onEdit?: () => void;
  onPay?: () => void;
  onVoid?: () => void;
  onDelete?: () => void;
};

function billStatusTone(status: Bill["status"]): "success" | "warning" | "neutral" | "danger" {
  if (status === "completed") return "success";
  if (status === "held") return "warning";
  if (status === "void") return "danger";
  return "neutral";
}

function billStatusLabel(status: Bill["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "held") return "Held";
  if (status === "void") return "Void";
  return status;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

export function BillDetailModal({
  bill,
  branchName,
  onClose,
  onReprint,
  onEdit,
  onPay,
  onVoid,
  onDelete,
}: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="bill-detail-title" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {bill.billRef}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={billStatusTone(bill.status)}>{billStatusLabel(bill.status)}</Badge>
              <Badge tone="neutral">{billChannelLabel(bill.tableLabel)}</Badge>
              {bill.orderRef ? (
                <span className="font-mono text-xs text-slate-500">{bill.orderRef}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <Meta label="Branch" value={branchName} />
            <Meta label="Table / station" value={bill.tableLabel} />
            <Meta label="Waiter" value={bill.waiterName} />
            <Meta label="Created" value={formatWhen(bill.createdAt)} />
            {bill.notes ? <Meta label="Notes" value={bill.notes} className="col-span-2" /> : null}
            {bill.riderName ? <Meta label="Rider" value={bill.riderName} /> : null}
            {bill.splitGroupRef ? <Meta label="Split group" value={bill.splitGroupRef} /> : null}
          </dl>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-center">Qty</th>
                  <th className="px-3 py-2 text-right">Unit</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map((line, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800/80">
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{line.label}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">{line.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      Rs {line.unitPrice.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      Rs {(line.qty * line.unitPrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
            <TotalRow label="Subtotal" value={bill.subtotal} />
            {bill.discount > 0 ? (
              <TotalRow label="Discount" value={-bill.discount} accent="danger" />
            ) : null}
            <TotalRow label={`Service (${bill.servicePct}%)`} value={bill.service} />
            <TotalRow label={`Tax (${bill.taxPct}%)`} value={bill.tax} />
            {bill.deliveryChargePkr > 0 ? (
              <TotalRow label="Delivery" value={bill.deliveryChargePkr} />
            ) : null}
            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
              <span>Total</span>
              <span className="tabular-nums">Rs {bill.total.toLocaleString()}</span>
            </div>
          </div>

          {bill.status === "completed" && bill.payments.length > 0 ? (
            <div className="mt-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payments</div>
              <ul className="mt-1.5 space-y-1">
                {bill.payments.map((p, i) => (
                  <li key={i} className="flex justify-between text-xs text-slate-700 dark:text-slate-300">
                    <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                    <span className="tabular-nums">Rs {p.amount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          {onReprint ? (
            <Button variant="ghost" className="text-xs" onClick={onReprint}>
              Reprint invoice
            </Button>
          ) : null}
          {onEdit ? (
            <button type="button" className={`text-xs ${linkActionClass}`} onClick={onEdit}>
              Edit bill
            </button>
          ) : null}
          {onPay ? (
            <button type="button" className={`text-xs ${linkWarningClass}`} onClick={onPay}>
              Complete payment
            </button>
          ) : null}
          {onVoid ? (
            <button type="button" className={`text-xs ${linkDangerClass}`} onClick={onVoid}>
              Void bill
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" className={`text-xs ${linkDangerClass}`} onClick={onDelete}>
              Delete order
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function TotalRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "danger";
}): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span
        className={[
          "tabular-nums font-medium",
          accent === "danger" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100",
        ].join(" ")}
      >
        {value < 0 ? "− " : ""}Rs {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
