import { useEffect } from "react";
import type { PosRecentOrder } from "../lib/recentOrders";
import { formatOrderDateTime } from "../lib/recentOrders";
import { Badge } from "../ui/Badge";

type Props = {
  order: PosRecentOrder;
  onClose: () => void;
};

export function PosOrderDetailModal({ order, onClose }: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { detail } = order;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-order-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="pos-order-detail-title" className="font-mono text-base font-semibold text-white">
              {order.ref}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={order.statusTone}>{order.statusLabel}</Badge>
              <Badge tone="neutral">{order.orderMode}</Badge>
              <span className="text-xs text-slate-500">
                {order.kind === "pending" ? "Kitchen order" : "Paid bill"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 hover:text-white"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Meta label="Order type" value={order.orderMode} />
            <Meta label="Station / table" value={order.stationLabel} />
            <Meta label="Placed" value={formatOrderDateTime(order.createdAt)} />
            {detail.kind === "pending" ? (
              <>
                <Meta label="Ticket ref" value={detail.ticketRef} />
                {detail.orderRef ? <Meta label="Order ref" value={detail.orderRef} /> : null}
                <Meta label="Priority" value={detail.priority === "priority" ? "Priority" : "Normal"} />
                <Meta label="Elapsed" value={`${detail.mins} min`} />
                {detail.startedAt ? (
                  <Meta label="Started cooking" value={formatOrderDateTime(detail.startedAt)} className="col-span-2" />
                ) : null}
              </>
            ) : (
              <>
                <Meta label="Bill ref" value={detail.billRef} />
                {detail.orderRef ? <Meta label="Order ref" value={detail.orderRef} /> : null}
                <Meta label="Waiter" value={detail.waiterName} />
                <Meta label="Status" value={detail.status} />
                {detail.notes ? (
                  <Meta label="Notes" value={detail.notes} className="col-span-2" />
                ) : null}
              </>
            )}
          </dl>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Items</div>
            <ul className="mt-2 divide-y divide-slate-800 rounded-lg border border-slate-800">
              {detail.lines.map((line, i) => (
                <li key={`${line.label}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-100">{line.label}</div>
                    {line.unitPrice != null ? (
                      <div className="text-xs text-slate-500">Rs {line.unitPrice.toLocaleString()} each</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-400">× {line.qty}</div>
                    {line.unitPrice != null ? (
                      <div className="text-xs font-medium text-slate-300">
                        Rs {(line.unitPrice * line.qty).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {detail.kind === "paid" ? (
            <div className="mt-4 space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs">
              <Row label="Subtotal" value={detail.subtotal} />
              {detail.discount > 0 ? <Row label="Discount" value={-detail.discount} /> : null}
              <Row label="Service" value={detail.service} />
              <Row label="Tax" value={detail.tax} />
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-semibold text-white">
                <span>Total</span>
                <span>Rs {detail.total.toLocaleString()}</span>
              </div>
            </div>
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
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="flex justify-between text-slate-400">
      <span>{label}</span>
      <span className={value < 0 ? "text-red-300" : ""}>
        {value < 0 ? "− " : ""}Rs {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
