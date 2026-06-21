import type { ReactNode } from "react";
import {
  countBadgeClass,
  filterBarClass,
  moduleSearchClass,
  pageTitleClass,
} from "../lib/themeClasses";

export function ModuleToolbar({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className={pageTitleClass}>{title}</h1>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

export function ModuleFilterBar({ children }: { children: ReactNode }): JSX.Element {
  return <div className={filterBarClass}>{children}</div>;
}

export function ModuleSearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}): JSX.Element {
  return (
    <input
      className={[moduleSearchClass, className ?? ""].join(" ")}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ModuleSegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; accent?: boolean }[];
}): JSX.Element {
  return (
    <div data-ui="segmented-control" role="tablist">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={[
              "segmented-btn",
              active ? "is-active" : "",
              active && opt.accent ? "is-accent" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ModuleCountBadge({ shown, total }: { shown: number; total: number }): JSX.Element {
  return (
    <span className={countBadgeClass}>
      <span className="font-medium text-slate-700 dark:text-slate-200">{shown}</span>
      <span className="text-slate-400"> / </span>
      {total}
    </span>
  );
}
