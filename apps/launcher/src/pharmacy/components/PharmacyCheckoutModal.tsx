import {
  PHARMACY_PAYMENT_METHODS,
  type Medicine,
  type PharmacyPaymentLine,
  type PharmacyPaymentMethod,
} from "@platform/contracts";
import { useEffect, useState } from "react";
import { formatPkr } from "../hooks/usePharmacy";
import { PharmacyField, PharmacyInput, PharmacySelect } from "../ui/PharmacyUi";

type Props = {
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  patientOutstanding: number;
  creditLimit: number;
  hasControlled: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    paymentMethod: PharmacyPaymentMethod;
    payments: PharmacyPaymentLine[];
    controlledApproved: boolean;
  }) => void;
};

function defaultRow(method: PharmacyPaymentMethod, amount: number): PharmacyPaymentLine {
  return { method, amount };
}

export function PharmacyCheckoutModal({
  total,
  subtotal,
  tax,
  discount,
  patientOutstanding,
  creditLimit,
  hasControlled,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props): JSX.Element {
  const [payments, setPayments] = useState<PharmacyPaymentLine[]>([defaultRow("Cash", total)]);
  const [controlledApproved, setControlledApproved] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const amountDue = Math.max(total - paid, 0);
  const canSubmit = (!hasControlled || controlledApproved) && paid <= total + (creditLimit - patientOutstanding);

  function updatePayment(index: number, patch: Partial<PharmacyPaymentLine>): void {
    setPayments((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleConfirm(): void {
    const method: PharmacyPaymentMethod = payments.length > 1 ? "Mixed" : payments[0]?.method ?? "Cash";
    onConfirm({
      paymentMethod: amountDue > 0 && payments.some((p) => p.method === "Khata") ? "Khata" : method,
      payments: payments.filter((p) => p.amount > 0),
      controlledApproved,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Checkout</h2>
          <p className="mt-1 text-xs text-slate-500">Cash, card, EasyPaisa, JazzCash, bank transfer, mixed, or Khata credit.</p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span>{formatPkr(subtotal)}</span>
            </div>
            {tax > 0 ? (
              <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-400">
                <span>Tax</span>
                <span>{formatPkr(tax)}</span>
              </div>
            ) : null}
            {discount > 0 ? (
              <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-400">
                <span>Discount</span>
                <span>-{formatPkr(discount)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between text-base font-bold text-slate-900 dark:text-white">
              <span>Total</span>
              <span>{formatPkr(total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</span>
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:underline"
                onClick={() => setPayments((prev) => [...prev, defaultRow("Card", 0)])}
              >
                Add payment row
              </button>
            </div>
            {payments.map((row, index) => (
              <div key={index} className="grid grid-cols-2 gap-2">
                <PharmacySelect
                  value={row.method}
                  onChange={(e) => updatePayment(index, { method: e.target.value as PharmacyPaymentMethod })}
                >
                  {PHARMACY_PAYMENT_METHODS.filter((m) => m !== "Mixed").map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </PharmacySelect>
                <PharmacyInput
                  type="number"
                  min={0}
                  value={row.amount}
                  onChange={(e) => updatePayment(index, { amount: Number(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
              <span className="text-slate-500">Paid</span>
              <div className="font-semibold text-emerald-600">{formatPkr(paid)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
              <span className="text-slate-500">Balance / Khata</span>
              <div className={`font-semibold ${amountDue > 0 ? "text-amber-600" : "text-slate-900 dark:text-white"}`}>
                {formatPkr(amountDue)}
              </div>
            </div>
          </div>

          {hasControlled ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
              <input
                type="checkbox"
                checked={controlledApproved}
                onChange={(e) => setControlledApproved(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Pharmacist approval</strong> — this sale includes controlled substances. Confirm prescription
                and regulatory compliance before completing.
              </span>
            </label>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : "Complete sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MedicineWarningsPanel({ medicine }: { medicine: Medicine }): JSX.Element | null {
  const warnings = [...medicine.warnings, ...medicine.instructions];
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
      <p className="font-semibold text-amber-800 dark:text-amber-300">Dosage & warnings</p>
      <ul className="mt-1 list-inside list-disc text-amber-900 dark:text-amber-200">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
