import { useEffect, useState } from "react";
import { fieldInputClass } from "../lib/themeClasses";

type Props = {
  open: boolean;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

const MIN_REASON_LEN = 3;

/** Strict cancel/void reason prompt — confirm stays disabled until a real reason is typed. */
export function CancelOrderReasonModal({
  open,
  title = "Cancel order",
  subtitle = "Reason is required before this order can be canceled.",
  confirmLabel = "Cancel order",
  loading = false,
  onClose,
  onConfirm,
}: Props): JSX.Element | null {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTouched(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON_LEN;
  const showError = touched && !valid;

  function submit(): void {
    setTouched(true);
    if (!valid || loading) return;
    onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 p-4 dark:bg-black/70"
      onClick={() => {
        if (!loading) onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-reason-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="cancel-order-reason-title"
          className="text-sm font-semibold text-slate-900 dark:text-white"
        >
          {title}
        </h2>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>

        <label className="mt-3 block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Reason <span className="text-rose-500">*</span>
          </span>
          <textarea
            autoFocus
            rows={3}
            value={reason}
            disabled={loading}
            maxLength={300}
            placeholder="e.g. Customer left, wrong table, duplicate order…"
            className={`${fieldInputClass} mt-1 min-h-[4.5rem] resize-y`}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </label>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
          {showError ? (
            <span className="text-rose-600 dark:text-rose-400">
              Enter at least {MIN_REASON_LEN} characters.
            </span>
          ) : (
            <span className="text-slate-400">Required — min {MIN_REASON_LEN} characters</span>
          )}
          <span className="tabular-nums text-slate-400">{trimmed.length}/300</span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!valid || loading}
            onClick={submit}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Canceling…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
