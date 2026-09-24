import type { ReactNode } from "react";
import { formatPkr } from "../../../hooks/useInventory";
import { summarizeIngredientStock, type StockLeftPart } from "../../../lib/stockLeftTotal";
import { mutedClass, noticeErrorClass, panelClass, panelTitleClass } from "../../../lib/themeClasses";

export { summarizeIngredientStock, type StockLeftPart };

export function InventoryLoading({ label = "Loading inventory…" }: { label?: string }): JSX.Element {
  return <div className={`text-sm ${mutedClass}`}>{label}</div>;
}

export function InventoryError({ message }: { message: string }): JSX.Element {
  return <div className={noticeErrorClass}>{message}</div>;
}

export function InventoryFormPanel({
  title,
  children,
  onSubmit,
  submitLabel,
  disabled,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <form
      className={panelClass + " p-4"}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className={panelTitleClass}>{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
      <button
        type="submit"
        disabled={disabled}
        className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export function StockLeftTotal({
  title,
  hint,
  total,
  parts = [],
  highlightId = null,
}: {
  title: string;
  hint: string;
  total: number;
  parts?: StockLeftPart[];
  highlightId?: string | null;
}): JSX.Element {
  const visibleParts = parts.filter((part) => part.id === "store" || part.value > 0);
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200/80">{title}</div>
          <p className="mt-0.5 max-w-2xl text-xs text-amber-900/70 dark:text-slate-400">{hint}</p>
        </div>
        <div className="text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-200">{formatPkr(total)}</div>
      </div>
      {visibleParts.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {visibleParts.map((part) => {
            const active = highlightId != null && highlightId === part.id;
            return (
              <div
                key={part.id}
                className={`rounded-lg border px-3 py-2 ${
                  active
                    ? "border-amber-400 bg-amber-500/20"
                    : "border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-950/40"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{part.label}</div>
                <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatPkr(part.value)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
