import { STORE_PAYMENT_METHODS, type StorePaymentLine, type StorePaymentMethod } from "@platform/contracts";
import { useEffect, useState } from "react";
import { formatPkr } from "../hooks/useStore";
import { PharmacyField, PharmacyInput, PharmacySelect } from "../../pharmacy/ui/PharmacyUi";

type Props = {
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  promotionDiscount: number;
  loyaltyRedeem: number;
  customerLoyaltyPoints: number;
  isSubmitting?: boolean;
  mode?: "complete" | "hold";
  onClose: () => void;
  onConfirm: (payload: {
    paymentMethod: StorePaymentMethod;
    payments: StorePaymentLine[];
    loyaltyPointsRedeem: number;
    isCredit: boolean;
  }) => void;
};

function defaultRow(method: StorePaymentMethod, amount: number): StorePaymentLine {
  return { method, amount };
}

export function StoreCheckoutModal({
  total,
  subtotal,
  tax,
  discount,
  promotionDiscount,
  loyaltyRedeem: initialLoyalty,
  customerLoyaltyPoints,
  isSubmitting = false,
  mode = "complete",
  onClose,
  onConfirm,
}: Props): JSX.Element {
  const [payments, setPayments] = useState<StorePaymentLine[]>([defaultRow("Cash", total)]);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(initialLoyalty);
  const [isCredit, setIsCredit] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loyaltyValue = loyaltyRedeem;
  const netTotal = Math.max(0, total - loyaltyValue);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const change = Math.max(0, paid - netTotal);

  useEffect(() => {
    setPayments([defaultRow("Cash", netTotal)]);
  }, [netTotal]);

  function updatePayment(index: number, patch: Partial<StorePaymentLine>): void {
    setPayments((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleConfirm(): void {
    const method: StorePaymentMethod = payments.length > 1 ? "Cash" : payments[0]?.method ?? "Cash";
    onConfirm({
      paymentMethod: method,
      payments: payments.filter((p) => p.amount > 0),
      loyaltyPointsRedeem: loyaltyRedeem,
      isCredit,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose} role="presentation">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {mode === "hold" ? "Suspend bill" : "Checkout"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "hold" ? "Bill will be held — stock is not deducted until completion." : "Split payments across cash, card, wallet, or credit."}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Subtotal</span><span>{formatPkr(subtotal)}</span></div>
            {tax > 0 ? <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-400"><span>Tax</span><span>{formatPkr(tax)}</span></div> : null}
            {discount > 0 ? <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-400"><span>Manual discount</span><span>-{formatPkr(discount)}</span></div> : null}
            {promotionDiscount > 0 ? <div className="mt-1 flex justify-between text-emerald-600"><span>Promotions</span><span>-{formatPkr(promotionDiscount)}</span></div> : null}
            {loyaltyValue > 0 ? <div className="mt-1 flex justify-between text-amber-600"><span>Loyalty redeemed</span><span>-{formatPkr(loyaltyValue)}</span></div> : null}
            <div className="mt-2 flex justify-between text-base font-bold text-slate-900 dark:text-white"><span>Total</span><span>{formatPkr(netTotal)}</span></div>
          </div>

          {customerLoyaltyPoints > 0 && mode === "complete" ? (
            <PharmacyField label={`Redeem loyalty points (max ${customerLoyaltyPoints})`}>
              <PharmacyInput
                type="number"
                min={0}
                max={Math.min(customerLoyaltyPoints, total)}
                value={loyaltyRedeem || ""}
                onChange={(e) => setLoyaltyRedeem(Math.min(customerLoyaltyPoints, Math.max(0, Number(e.target.value) || 0)))}
              />
            </PharmacyField>
          ) : null}

          {mode === "complete" ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</span>
                  <button type="button" className="text-xs font-medium text-sky-600 hover:underline" onClick={() => setPayments((p) => [...p, defaultRow("Card", 0)])}>
                    + Add payment
                  </button>
                </div>
                {payments.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <PharmacySelect value={row.method} onChange={(e) => updatePayment(i, { method: e.target.value as StorePaymentMethod })} className="flex-1">
                      {STORE_PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </PharmacySelect>
                    <PharmacyInput type="number" min={0} value={row.amount || ""} onChange={(e) => updatePayment(i, { amount: Number(e.target.value) || 0 })} className="w-28" />
                  </div>
                ))}
                {change > 0 ? <p className="text-xs text-emerald-600">Change due: {formatPkr(change)}</p> : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} className="rounded" />
                Credit sale (add to customer balance)
              </label>
            </>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium dark:border-slate-700">Cancel</button>
          <button
            type="button"
            disabled={isSubmitting || (mode === "complete" && paid < netTotal && !isCredit)}
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : mode === "hold" ? "Suspend bill" : `Pay ${formatPkr(netTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
