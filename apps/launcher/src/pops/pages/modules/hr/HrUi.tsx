import type { ReactNode } from "react";
import { mutedClass, noticeErrorClass, panelClass, panelTitleClass } from "../../../lib/themeClasses";

export function HrLoading({ label = "Loading…" }: { label?: string }): JSX.Element {
  return <p className={`text-sm ${mutedClass}`}>{label}</p>;
}

export function HrError({ message }: { message: string }): JSX.Element {
  return <p className={noticeErrorClass}>{message}</p>;
}

export function HrFormPanel({
  title,
  submitLabel,
  disabled,
  onSubmit,
  children,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: () => void;
  children: ReactNode;
  secondaryLabel?: string;
  onSecondary?: () => void;
}): JSX.Element {
  return (
    <div className={panelClass + " p-4"}>
      <div className={panelTitleClass}>{title}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-400 hover:text-white"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
