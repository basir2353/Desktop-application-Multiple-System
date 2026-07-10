import { Button } from "@platform/ui";
import { useEffect } from "react";
import { PAYMENT_METHOD_LABELS } from "@platform/contracts";
import type { Bill, KitchenTicket } from "@platform/contracts";
import { billChannelLabel } from "../lib/orderSales";
import {
  canChangeOrderTable,
  unifiedOrderRef,
  unifiedOrderStatusLabel,
  unifiedOrderStatusTone,
  unifiedOrderTable,
  unifiedOrderWaiter,
  type UnifiedOrder,
} from "../lib/orderHistory";
import { parseItemsSummary, formatOrderDateTime } from "../lib/recentOrders";
import { Badge } from "../ui/Badge";

type Props = {
  order: UnifiedOrder;
  branchName: string;
  canChangeTable?: boolean;
  onClose: () => void;
  onReprint?: (bill: Bill) => void;
  onCompletePayment?: () => void;
  onChangeTable?: (order: UnifiedOrder) => void;
  onDeleteBill?: () => void;
};

export function OrderDetailModal({
  order,
  branchName,
  canChangeTable = false,
  onClose,
  onReprint,
  onCompletePayment,
  onChangeTable,
  onDeleteBill,
}: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ref = unifiedOrderRef(order);
  const orderMode = billChannelLabel(
    order.source === "bill" ? order.bill.tableLabel : order.ticket.stationLabel,
  );
  const statusTone = unifiedOrderStatusTone(order);
  const statusLabel = unifiedOrderStatusLabel(order);

  const lines =
    order.source === "bill"
      ? order.bill.lines.map((line) => ({
          label: line.label,
          qty: line.qty,
          unitPrice: line.unitPrice as number | null,
        }))
      : kitchenItemLines(order.ticket);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="order-detail-title" className="font-mono text-base font-semibold text-white">
              {ref}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone}>{statusLabel}</Badge>
              <Badge tone="neutral">{orderMode}</Badge>
              <span className="text-xs text-slate-500">
                {order.source === "bill" ? order.bill.billRef : order.ticket.ticketRef}
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
            <Meta label="Branch" value={branchName} />
            <Meta label="Order type" value={orderMode} />
            <Meta label="Table / station" value={unifiedOrderTable(order)} />
            <Meta label="Waiter" value={unifiedOrderWaiter(order)} />
            <Meta label="Placed" value={formatOrderDateTime(order.createdAt)} className="col-span-2" />
            {order.source === "kitchen" ? (
              <>
                <Meta label="Ticket ref" value={order.ticket.ticketRef} />
                {order.ticket.orderRef ? <Meta label="Order ref" value={order.ticket.orderRef} /> : null}
                <Meta label="Wait time" value={`${order.ticket.mins} min`} />
                <Meta
                  label="Priority"
                  value={order.ticket.priority === "priority" ? "Priority" : "Normal"}
                />
              </>
            ) : (
              <>
                <Meta label="Bill ref" value={order.bill.billRef} />
                {order.bill.orderRef ? <Meta label="Order ref" value={order.bill.orderRef} /> : null}
                {order.bill.notes ? (
                  <Meta label="Notes" value={order.bill.notes} className="col-span-2" />
                ) : null}
              </>
            )}
          </dl>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Items</div>
            <ul className="mt-2 divide-y divide-slate-800 rounded-lg border border-slate-800">
              {lines.map((line, i) => (
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

          {order.source === "bill" ? (
            <div className="mt-4 space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs">
              <Row label="Subtotal" value={order.bill.subtotal} />
              {order.bill.discount > 0 ? <Row label="Discount" value={-order.bill.discount} /> : null}
              <Row label="Service" value={order.bill.service} suffix={`${order.bill.servicePct}%`} />
              <Row label="Tax" value={order.bill.tax} suffix={`${order.bill.taxPct}%`} />
              {order.bill.payments.length > 0 ? (
                <div className="col-span-2 pt-1">
                  <div className="text-slate-500">Payments</div>
                  <ul className="mt-1 space-y-0.5">
                    {order.bill.payments.map((p, i) => (
                      <li key={i} className="flex justify-between text-slate-300">
                        <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                        <span>Rs {p.amount.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {order.bill.splitGroupRef ? (
                <Meta label="Split" value={order.bill.splitGroupRef} className="col-span-2" />
              ) : null}
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-semibold text-white">
                <span>Total</span>
                <span>Rs {order.bill.total.toLocaleString()}</span>
              </div>
            </div>
          ) : null}
        </div>

        {order.source === "bill" && order.bill.status === "held" && onCompletePayment ? (
          <div className="border-t border-slate-800 px-4 py-3">
            <Button type="button" className="h-8 w-full text-xs" onClick={() => onCompletePayment()}>
              Complete payment
            </Button>
          </div>
        ) : null}

        {order.source === "bill" && onReprint && order.bill.status === "completed" ? (
          <div className="border-t border-slate-800 px-4 py-3">
            <Button type="button" className="h-8 w-full text-xs" onClick={() => onReprint(order.bill)}>
              Reprint invoice
            </Button>
          </div>
        ) : null}

        {canChangeTable && onChangeTable && canChangeOrderTable(order) ? (
          <div className="border-t border-slate-800 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full border border-slate-700 text-xs text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200"
              onClick={() => onChangeTable(order)}
            >
              Change table
            </Button>
          </div>
        ) : null}

        {order.source === "bill" && onDeleteBill ? (
          <div className="border-t border-slate-800 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full border border-red-500/30 text-xs text-red-400 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
              onClick={onDeleteBill}
            >
              Delete order
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function kitchenItemLines(ticket: KitchenTicket) {
  let summary = ticket.itemsSummary;
  const deliveryIdx = summary.indexOf(" · Delivery");
  if (deliveryIdx >= 0) summary = summary.slice(0, deliveryIdx);
  return parseItemsSummary(summary);
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

function Row({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}): JSX.Element {
  return (
    <div className="flex justify-between text-slate-400">
      <span>
        {label}
        {suffix ? <span className="text-slate-600"> ({suffix})</span> : null}
      </span>
      <span className={value < 0 ? "text-red-300" : ""}>
        {value < 0 ? "− " : ""}Rs {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
