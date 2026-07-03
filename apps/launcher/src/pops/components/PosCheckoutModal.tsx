import { Button } from "@platform/ui";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_VALUES,
  type BillPayment,
  type PaymentMethod,
} from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import {
  computeCheckoutTotals,
  paymentSummary,
  paymentsCoverTotal,
} from "../lib/posCheckout";

export type CheckoutModalMode = "pay" | "hold" | "invoice";

type Props = {
  mode: CheckoutModalMode;
  title: string;
  subtotal: number;
  discount: number;
  servicePct: number;
  taxPct: number;
  total: number;
  service: number;
  tax: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    servicePct: number;
    taxPct: number;
    payments: BillPayment[];
    status: "completed" | "held";
  }) => void;
};

export function PosCheckoutModal({
  mode,
  title,
  subtotal,
  discount,
  servicePct: initialServicePct,
  taxPct: initialTaxPct,
  total: initialTotal,
  service: initialService,
  tax: initialTax,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props): JSX.Element {
  const [taxPctInput, setTaxPctInput] = useState(initialTaxPct);
  const [payments, setPayments] = useState<BillPayment[]>([
    { method: "cash", amount: initialTotal },
  ]);

  const totals = useMemo(
    () => computeCheckoutTotals([{ qty: 1, unitPrice: subtotal }], discount, initialServicePct, taxPctInput),
    [subtotal, discount, initialServicePct, taxPctInput],
  );

  useEffect(() => {
    setPayments((prev) => {
      if (prev.length !== 1) return prev;
      if (prev[0].amount === totals.total) return prev;
      return [{ ...prev[0], amount: totals.total }];
    });
  }, [totals.total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isHold = mode === "hold";
  const canSubmit = isHold || paymentsCoverTotal(payments, totals.total);

  function updatePayment(index: number, patch: Partial<BillPayment>): void {
    setPayments((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addPaymentRow(): void {
    setPayments((prev) => {
      const usedMethods = new Set(prev.map((row) => row.method));
      const nextMethod = PAYMENT_METHOD_VALUES.find((method) => !usedMethods.has(method)) ?? "card";
      const paid = prev.reduce((sum, row) => sum + row.amount, 0);
      const remaining = Math.max(0, totals.total - paid);

      if (prev.length === 1 && prev[0].amount >= totals.total) {
        return [prev[0], { method: nextMethod, amount: remaining }];
      }

      return [...prev, { method: nextMethod, amount: remaining }];
    });
  }

  function handleConfirm(): void {
    onConfirm({
      servicePct: initialServicePct,
      taxPct: taxPctInput,
      payments: isHold ? [] : payments.filter((p) => p.amount > 0),
      status: isHold ? "held" : "completed",
    });
  }

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const change = paid - totals.total;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isHold
              ? "Save this ticket as on hold — pay later from Orders."
              : "Record one or more payment methods."}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="block text-slate-400">
              <span className="text-[11px]">Service charge</span>
              <div className="mt-1 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-300">
                {initialServicePct}%
              </div>
            </div>
            <label className="block text-slate-400">
              Sales tax (%)
              <input
                type="number"
                min={0}
                max={30}
                value={taxPctInput}
                onChange={(e) => setTaxPctInput(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              />
            </label>
          </div>

          <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>Rs {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-slate-500">
                <span>Discount</span>
                <span>− Rs {discount.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-slate-500">
              <span>Service ({initialServicePct}%)</span>
              <span>Rs {totals.service.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax ({taxPctInput}%)</span>
              <span>Rs {totals.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-semibold text-white">
              <span>Total</span>
              <span>Rs {totals.total.toLocaleString()}</span>
            </div>
          </div>

          {!isHold ? (
            <div>
              <div className="mb-2 text-[11px] font-medium text-slate-300">Payment methods</div>
              <ul className="space-y-2">
                {payments.map((row, index) => (
                  <li key={index} className="grid grid-cols-12 gap-2">
                    <select
                      className="col-span-5 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                      value={row.method}
                      onChange={(e) =>
                        updatePayment(index, { method: e.target.value as PaymentMethod })
                      }
                    >
                      {PAYMENT_METHOD_VALUES.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      className="col-span-5 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-right text-xs text-white"
                      value={row.amount || ""}
                      onChange={(e) => updatePayment(index, { amount: Number(e.target.value) || 0 })}
                      placeholder="Amount"
                    />
                    {payments.length > 1 ? (
                      <button
                        type="button"
                        className="col-span-2 text-[10px] text-red-300"
                        onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="col-span-2" />
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-[11px] text-amber-300 hover:text-amber-200"
                onClick={addPaymentRow}
              >
                + Add payment method
              </button>
              {paid > 0 ? (
                <p className={`mt-2 text-[10px] ${change < 0 ? "text-red-300" : "text-slate-500"}`}>
                  {paymentSummary(payments)} · Paid Rs {paid.toLocaleString()}
                  {change > 0 ? ` · Change Rs ${change.toLocaleString()}` : ""}
                  {change < 0 ? ` · Short Rs ${Math.abs(change).toLocaleString()}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3">
          <Button type="button" variant="ghost" className="h-9 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 text-xs"
            disabled={!canSubmit || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "…" : isHold ? "Hold bill" : mode === "invoice" ? "Print invoice" : "Complete payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
