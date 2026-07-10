import { Button } from "@platform/ui";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_VALUES,
  type BillPayment,
  type PaymentMethod,
} from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import {
  PKR_CASH_DENOMINATIONS,
  emptyDenominationQty,
  parseDenominationQty,
  rowTotalForDenomination,
  sumDenominationCash,
} from "../lib/cashDenominations";
import {
  balanceDue,
  computeCheckoutTotals,
  isPartialPayment,
  paymentSummary,
  paymentsShortfallMessage,
  taxPctForPayments,
} from "../lib/posCheckout";
import { loadPosSettings } from "../lib/posSettings";
import { usePopsStore } from "../../stores/popsStore";

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
  deliveryCharge?: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onValidationError?: (message: string) => void;
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
  deliveryCharge = 0,
  isSubmitting = false,
  onClose,
  onValidationError,
  onConfirm,
}: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const posSettings = useMemo(() => loadPosSettings(branch?.code), [branch?.code]);
  const [taxPctInput, setTaxPctInput] = useState(initialTaxPct);
  const [payments, setPayments] = useState<BillPayment[]>([
    { method: "cash", amount: 0 },
  ]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [showDenominations, setShowDenominations] = useState(false);
  const [denomQty, setDenomQty] = useState<Record<number, string>>(() => emptyDenominationQty());

  const effectiveTaxPct = useMemo(() => {
    if (posSettings.taxByPaymentMethod) {
      return taxPctForPayments(posSettings, payments);
    }
    return posSettings.taxEnabled ? taxPctInput : 0;
  }, [posSettings, payments, taxPctInput]);

  const totals = useMemo(
    () =>
      computeCheckoutTotals(
        [{ qty: 1, unitPrice: subtotal }],
        discount,
        initialServicePct,
        effectiveTaxPct,
        deliveryCharge,
      ),
    [subtotal, discount, initialServicePct, effectiveTaxPct, deliveryCharge],
  );

  useEffect(() => {
    setPayments((prev) => {
      if (prev.length !== 1 || prev[0].amount > 0) return prev;
      return [{ ...prev[0], amount: totals.total }];
    });
  }, [totals.total]);

  useEffect(() => {
    if (posSettings.taxByPaymentMethod) {
      setTaxPctInput(effectiveTaxPct);
    }
  }, [effectiveTaxPct, posSettings.taxByPaymentMethod]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isHold = mode === "hold";
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const change = paid - totals.total;
  const due = balanceDue(totals.total, payments);
  const checkoutMode = allowPartial ? ("partial" as const) : ("full" as const);
  const shortfallMessage = !isHold
    ? paymentsShortfallMessage(payments, totals.total, checkoutMode)
    : null;
  const cashDenomTotal = sumDenominationCash(denomQty);
  const primaryMethod = payments[0]?.method ?? "cash";

  function updatePayment(index: number, patch: Partial<BillPayment>): void {
    setPaymentError(null);
    setPayments((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addPaymentRow(): void {
    setPayments((prev) => {
      const usedMethods = new Set(prev.map((row) => row.method));
      const nextMethod = PAYMENT_METHOD_VALUES.find((method) => !usedMethods.has(method)) ?? "card";
      const paidSoFar = prev.reduce((sum, row) => sum + row.amount, 0);
      const remaining = Math.max(0, totals.total - paidSoFar);
      return [...prev, { method: nextMethod, amount: remaining }];
    });
  }

  function applyDenominationToCash(): void {
    setPayments((prev) => {
      const next = [...prev];
      const cashIndex = next.findIndex((p) => p.method === "cash");
      if (cashIndex >= 0) {
        next[cashIndex] = { ...next[cashIndex], amount: cashDenomTotal };
      } else {
        next.unshift({ method: "cash", amount: cashDenomTotal });
      }
      return next;
    });
    setPaymentError(null);
  }

  function handleConfirm(): void {
    if (isHold) {
      onConfirm({
        servicePct: initialServicePct,
        taxPct: effectiveTaxPct,
        payments: [],
        status: "held",
      });
      return;
    }

    const err = paymentsShortfallMessage(payments, totals.total, checkoutMode);
    if (err) {
      setPaymentError(err);
      onValidationError?.(err);
      return;
    }

    const partial = isPartialPayment(payments, totals.total);
    setPaymentError(null);
    onConfirm({
      servicePct: initialServicePct,
      taxPct: effectiveTaxPct,
      payments: payments.filter((p) => p.amount > 0),
      status: partial || allowPartial ? "held" : "completed",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isHold
              ? "Save this ticket as on hold — pay later from Orders."
              : "Record payment methods, denominations, or partial payment."}
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
                value={effectiveTaxPct}
                onChange={(e) => setTaxPctInput(Number(e.target.value) || 0)}
                disabled={posSettings.taxByPaymentMethod || !posSettings.taxEnabled}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white disabled:opacity-60"
              />
            </label>
          </div>

          {posSettings.taxByPaymentMethod ? (
            <p className="text-[10px] text-slate-500">
              Tax auto-applied: cash {posSettings.cashTaxPct}% · card {posSettings.cardTaxPct}%
            </p>
          ) : null}

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
            {posSettings.taxEnabled ? (
              <div className="flex justify-between text-slate-500">
                <span>Tax ({effectiveTaxPct}%)</span>
                <span>Rs {totals.tax.toLocaleString()}</span>
              </div>
            ) : null}
            {deliveryCharge > 0 ? (
              <div className="flex justify-between text-slate-500">
                <span>Delivery</span>
                <span>Rs {deliveryCharge.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-semibold text-white">
              <span>Total</span>
              <span>Rs {totals.total.toLocaleString()}</span>
            </div>
          </div>

          {!isHold ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-medium text-slate-300">Payment methods</div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={allowPartial}
                    onChange={(e) => setAllowPartial(e.target.checked)}
                  />
                  Partial payment
                </label>
              </div>
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

              {primaryMethod === "cash" ? (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-amber-300"
                    onClick={() => setShowDenominations((v) => !v)}
                  >
                    {showDenominations ? "Hide" : "Show"} cash denominations
                  </button>
                  {showDenominations ? (
                    <div className="mt-2 space-y-1">
                      {PKR_CASH_DENOMINATIONS.map((d) => (
                        <div key={d.value} className="grid grid-cols-12 items-center gap-2">
                          <span className="col-span-3 text-[10px] text-slate-400">Rs {d.label}</span>
                          <input
                            type="number"
                            min={0}
                            className="col-span-4 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-[10px] text-white"
                            value={denomQty[d.value] ?? ""}
                            onChange={(e) =>
                              setDenomQty((prev) => ({ ...prev, [d.value]: e.target.value }))
                            }
                            placeholder="Qty"
                          />
                          <span className="col-span-5 text-right text-[10px] tabular-nums text-slate-500">
                            Rs {rowTotalForDenomination(d.value, denomQty[d.value] ?? "").toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                        <span className="text-[10px] text-slate-400">
                          Total: Rs {cashDenomTotal.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          className="text-[10px] text-emerald-300"
                          onClick={applyDenominationToCash}
                        >
                          Apply to cash
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {paid > 0 ? (
                <p className={`mt-2 text-[10px] ${change < 0 && !allowPartial ? "text-red-300" : "text-slate-500"}`}>
                  {paymentSummary(payments)} · Paid Rs {paid.toLocaleString()}
                  {change > 0 ? ` · Change Rs ${change.toLocaleString()}` : ""}
                  {due > 0 && allowPartial ? ` · Balance due Rs ${due.toLocaleString()}` : ""}
                  {change < 0 && !allowPartial ? ` · Short Rs ${Math.abs(change).toLocaleString()}` : ""}
                </p>
              ) : null}
              {paymentError || shortfallMessage ? (
                <p className="mt-2 text-[11px] font-medium text-amber-300">
                  {paymentError ?? shortfallMessage}
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
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting
              ? "…"
              : isHold
                ? "Hold bill"
                : allowPartial && due > 0
                  ? "Save partial payment"
                  : mode === "invoice"
                    ? "Print invoice"
                    : "Complete payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
