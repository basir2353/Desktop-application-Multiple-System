import { useEffect, useState } from "react";

export type PosDiscountType = "percent" | "currency";

type Props = {
  open: boolean;
  initialType?: PosDiscountType;
  initialValue?: number;
  maxAmount?: number;
  onClose: () => void;
  onApply: (type: PosDiscountType, value: number) => void;
};

export function PosDiscountModal({
  open,
  initialType = "percent",
  initialValue = 0,
  maxAmount = 0,
  onClose,
  onApply,
}: Props): JSX.Element | null {
  const [discountType, setDiscountType] = useState<PosDiscountType>(initialType);
  const [value, setValue] = useState(String(initialValue || ""));

  useEffect(() => {
    if (!open) return;
    setDiscountType(initialType);
    setValue(String(initialValue || ""));
  }, [open, initialType, initialValue]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = Math.max(0, Number(value) || 0);
  const clamped =
    discountType === "percent"
      ? Math.min(100, parsed)
      : Math.min(Math.max(0, maxAmount), parsed);

  function apply(): void {
    onApply(discountType, clamped);
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/30 p-4 dark:bg-black/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-discount-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="pos-discount-title"
          className="text-sm font-semibold text-slate-900 dark:text-white"
        >
          Discount
        </h2>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Discount Type
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setDiscountType("percent")}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                discountType === "percent"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Percent
            </button>
            <button
              type="button"
              onClick={() => setDiscountType("currency")}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                discountType === "currency"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Currency
            </button>
          </div>
        </label>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Discount
          <input
            autoFocus
            type="number"
            min={0}
            max={discountType === "percent" ? 100 : maxAmount}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50"}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <div className="mt-2 flex flex-wrap gap-1">
          {(discountType === "percent" ? [5, 10, 15, 20] : [50, 100, 200, 500]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setValue(String(preset))}
              className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-200"
            >
              {discountType === "percent" ? `${preset}%` : `Rs ${preset}`}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
          >
            Choose Discount
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
