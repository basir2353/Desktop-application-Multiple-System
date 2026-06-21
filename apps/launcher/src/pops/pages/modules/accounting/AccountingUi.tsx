import type { ReactNode } from "react";
import { mutedClass, noticeErrorClass, panelClass, panelTitleClass } from "../../../lib/themeClasses";

export function AccountingLoading({ label = "Loading accounting…" }: { label?: string }): JSX.Element {
  return <div className={`text-sm ${mutedClass}`}>{label}</div>;
}

export function AccountingError({ message }: { message: string }): JSX.Element {
  return <div className={noticeErrorClass}>{message}</div>;
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div className={panelClass + " p-4"}>
      <div className={`text-xs font-medium uppercase tracking-wider ${mutedClass}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      {hint ? <div className={`mt-1 text-xs ${mutedClass}`}>{hint}</div> : null}
    </div>
  );
}

export function AccountingFormPanel({
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
        className="mt-3 inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
