import { useEffect, useMemo, useState } from "react";
import type { CartLine } from "../lib/storePosSync";
import { cartLineUnitPrice } from "../lib/storePosSync";
import { formatPkr } from "../hooks/useStore";

const QUICK_DISCOUNTS = [10, 15, 25, 50];

type Props = {
  line: CartLine;
  onClose: () => void;
  onSave: (patch: {
    qty: number;
    unitPrice: number;
    lineDiscountAmount: number;
    lineDiscountPct: number;
    discountName: string;
  }) => void;
};

export function StorePriceDiscountModal({ line, onClose, onSave }: Props): JSX.Element {
  const [qty, setQty] = useState(line.qty);
  const [unitPrice, setUnitPrice] = useState(cartLineUnitPrice(line));
  const [discountAmount, setDiscountAmount] = useState(line.lineDiscountAmount ?? 0);
  const [discountPct, setDiscountPct] = useState(line.lineDiscountPct ?? 0);
  const [discountName, setDiscountName] = useState(line.discountName ?? "");

  const gross = useMemo(() => {
    if (line.product.isWeighed) {
      const grams = Math.round(qty * 1000);
      return Math.round((unitPrice * grams) / 1000);
    }
    return Math.round(unitPrice * Math.max(0, qty));
  }, [line.product.isWeighed, qty, unitPrice]);

  const appliedDiscount = useMemo(() => {
    if (discountAmount > 0) return Math.min(gross, Math.round(discountAmount));
    if (discountPct > 0) return Math.min(gross, Math.round((gross * discountPct) / 100));
    return 0;
  }, [discountAmount, discountPct, gross]);

  const extended = Math.max(0, gross - appliedDiscount);

  function applyQuick(pct: number): void {
    setDiscountPct(pct);
    setDiscountAmount(0);
  }

  function commit(): void {
    onSave({
      qty: line.product.isWeighed ? qty : Math.max(1, Math.round(qty)),
      unitPrice: Math.max(0, Math.round(unitPrice)),
      lineDiscountAmount: discountAmount > 0 ? Math.max(0, Math.round(discountAmount)) : 0,
      lineDiscountPct: discountAmount > 0 ? 0 : Math.max(0, discountPct),
      discountName,
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Price & Discount"
      >
        <div className="flex items-center justify-between bg-sky-600 px-4 py-3 text-white">
          <h3 className="text-base font-semibold">Price &amp; Discount</h3>
          <button type="button" onClick={onClose} className="rounded px-2 text-lg leading-none hover:bg-white/15" aria-label="Close">
            ×
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Choose Quick Discount</p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_DISCOUNTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyQuick(pct)}
                  className={`rounded-lg border py-3 text-sm font-bold ${
                    discountPct === pct && discountAmount <= 0
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-200 hover:border-sky-400 dark:border-slate-700"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center py-1">
            <div className="absolute inset-x-0 top-1/2 border-t border-slate-200 dark:border-slate-700" />
            <span className="relative bg-white px-3 text-xs font-semibold text-slate-400 dark:bg-slate-900">OR</span>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit Price or Discount Amount</p>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Quantity
                <input
                  type="number"
                  min={line.product.isWeighed ? 0.001 : 1}
                  step={line.product.isWeighed ? 0.001 : 1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <span className="pb-2 text-sm font-bold text-slate-400">×</span>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Unit Price
                <input
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <span className="pb-2 text-sm font-bold text-slate-400">=</span>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Extended Price
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                  {formatPkr(extended)}
                </div>
              </label>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Discount
                <input
                  type="number"
                  min={0}
                  value={discountAmount || ""}
                  placeholder="Amount"
                  onChange={(e) => {
                    setDiscountAmount(Math.max(0, Number(e.target.value) || 0));
                    setDiscountPct(0);
                  }}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Discount %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct || ""}
                  placeholder="%"
                  onChange={(e) => {
                    setDiscountPct(Math.max(0, Number(e.target.value) || 0));
                    setDiscountAmount(0);
                  }}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Discount Name
                <select
                  value={discountName}
                  onChange={(e) => setDiscountName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">—</option>
                  <option value="Promo">Promo</option>
                  <option value="Manager">Manager</option>
                  <option value="Damage">Damage</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>
            {appliedDiscount > 0 ? (
              <p className="mt-2 text-xs text-emerald-700">
                Line discount {formatPkr(appliedDiscount)}
                {discountName ? ` (${discountName})` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold text-sky-700">
            Cancel
          </button>
          <button type="button" onClick={commit} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
