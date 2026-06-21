import { Button } from "@platform/ui";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_VALUES, type BillPayment, type PaymentMethod } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import type { PosCartLine } from "../lib/posCart";
import {
  allocateDiscountAcrossSplits,
  computeCheckoutTotals,
  paymentSummary,
  paymentsCoverTotal,
} from "../lib/posCheckout";

export type SplitBillPart = {
  label: string;
  lines: PosCartLine[];
  payments: BillPayment[];
  servicePct: number;
  taxPct: number;
};

type Props = {
  cart: PosCartLine[];
  discount: number;
  servicePct: number;
  taxPct: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (splits: SplitBillPart[]) => void;
};

export function PosSplitBillModal({
  cart,
  discount,
  servicePct,
  taxPct,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props): JSX.Element {
  const [assignments, setAssignments] = useState<Record<string, number>>(() =>
    Object.fromEntries(cart.map((line) => [line.key, 0])),
  );
  const [splitCount, setSplitCount] = useState(2);
  const [paymentsBySplit, setPaymentsBySplit] = useState<Record<number, BillPayment[]>>({
    0: [{ method: "cash", amount: 0 }],
    1: [{ method: "cash", amount: 0 }],
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const splits = useMemo(() => {
    const parts: PosCartLine[][] = Array.from({ length: splitCount }, () => []);
    for (const line of cart) {
      const idx = Math.min(assignments[line.key] ?? 0, splitCount - 1);
      parts[idx].push(line);
    }
    const subtotals = parts.map((lines) =>
      lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    );
    const discountShares = allocateDiscountAcrossSplits(discount, subtotals);
    return parts.map((lines, index) => {
      const totals = computeCheckoutTotals(lines, discountShares[index], servicePct, taxPct);
      return { lines, totals, index };
    });
  }, [cart, assignments, splitCount, discount, servicePct, taxPct]);

  useEffect(() => {
    setPaymentsBySplit((prev) => {
      const next = { ...prev };
      for (const split of splits) {
        if (!next[split.index]) {
          next[split.index] = [{ method: "cash", amount: split.totals.total }];
        } else if (next[split.index].length === 1 && next[split.index][0].amount === 0) {
          next[split.index] = [{ ...next[split.index][0], amount: split.totals.total }];
        }
      }
      return next;
    });
  }, [splits]);

  const allValid = splits.every((split) => {
    if (split.lines.length === 0) return false;
    const payments = paymentsBySplit[split.index] ?? [];
    return paymentsCoverTotal(payments, split.totals.total);
  });

  function updateSplitCount(count: number): void {
    const next = Math.max(2, Math.min(4, count));
    setSplitCount(next);
    setPaymentsBySplit((prev) => {
      const out = { ...prev };
      for (let i = 0; i < next; i++) {
        if (!out[i]) out[i] = [{ method: "cash", amount: 0 }];
      }
      return out;
    });
  }

  function updatePayment(splitIndex: number, paymentIndex: number, patch: Partial<BillPayment>): void {
    setPaymentsBySplit((prev) => ({
      ...prev,
      [splitIndex]: (prev[splitIndex] ?? []).map((row, i) =>
        i === paymentIndex ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addPaymentRow(splitIndex: number): void {
    setPaymentsBySplit((prev) => ({
      ...prev,
      [splitIndex]: [...(prev[splitIndex] ?? []), { method: "card", amount: 0 }],
    }));
  }

  function handleConfirm(): void {
    const payload: SplitBillPart[] = splits
      .filter((s) => s.lines.length > 0)
      .map((split) => ({
        label: `Split ${split.index + 1}`,
        lines: split.lines,
        payments: (paymentsBySplit[split.index] ?? []).filter((p) => p.amount > 0),
        servicePct,
        taxPct,
      }));
    onConfirm(payload);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Split billing</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Assign each item to a split, then set payment method(s) per split.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="text-slate-400">Splits</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateSplitCount(n)}
                className={`rounded-full px-2.5 py-1 ${
                  splitCount === n
                    ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <ul className="mb-4 space-y-1 rounded-lg border border-slate-800 p-2">
            {cart.map((line) => (
              <li key={line.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-200">
                  {line.lineLabel} × {line.qty}
                </span>
                <select
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white"
                  value={assignments[line.key] ?? 0}
                  onChange={(e) =>
                    setAssignments((prev) => ({ ...prev, [line.key]: Number(e.target.value) }))
                  }
                >
                  {Array.from({ length: splitCount }, (_, i) => (
                    <option key={i} value={i}>
                      Split {i + 1}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            {splits.map((split) => (
              <div
                key={split.index}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs"
              >
                <div className="font-medium text-white">Split {split.index + 1}</div>
                {split.lines.length === 0 ? (
                  <p className="mt-2 text-slate-500">No items assigned</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-0.5 text-slate-400">
                      {split.lines.map((line) => (
                        <li key={line.key}>
                          {line.lineLabel} · Rs {(line.unitPrice * line.qty).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 space-y-0.5 border-t border-slate-800 pt-2">
                      <div className="flex justify-between text-slate-500">
                        <span>Service ({servicePct}%)</span>
                        <span>Rs {split.totals.service.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-white">
                        <span>Total</span>
                        <span>Rs {split.totals.total.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(paymentsBySplit[split.index] ?? []).map((row, pi) => (
                        <div key={pi} className="grid grid-cols-12 gap-1">
                          <select
                            className="col-span-5 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] text-white"
                            value={row.method}
                            onChange={(e) =>
                              updatePayment(split.index, pi, {
                                method: e.target.value as PaymentMethod,
                              })
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
                            className="col-span-5 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-right text-[10px] text-white"
                            value={row.amount || ""}
                            onChange={(e) =>
                              updatePayment(split.index, pi, { amount: Number(e.target.value) || 0 })
                            }
                          />
                          {(paymentsBySplit[split.index] ?? []).length > 1 ? (
                            <button
                              type="button"
                              className="col-span-2 text-red-300"
                              onClick={() =>
                                setPaymentsBySplit((prev) => ({
                                  ...prev,
                                  [split.index]: (prev[split.index] ?? []).filter((_, i) => i !== pi),
                                }))
                              }
                            >
                              ✕
                            </button>
                          ) : (
                            <span className="col-span-2" />
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-[10px] text-amber-300"
                        onClick={() => addPaymentRow(split.index)}
                      >
                        + Payment
                      </button>
                      <p className="text-[10px] text-slate-600">
                        {paymentSummary(paymentsBySplit[split.index] ?? [])}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3">
          <Button type="button" variant="ghost" className="h-9 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 text-xs"
            disabled={!allValid || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "…" : `Create ${splits.filter((s) => s.lines.length > 0).length} bills`}
          </Button>
        </div>
      </div>
    </div>
  );
}
