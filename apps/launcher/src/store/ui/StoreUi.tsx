import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { storeInputClass, storeSelectClass } from "../hooks/useStore";

export function StoreField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
        {required ? <span className="text-sky-600 dark:text-sky-400">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function StoreInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input className={[storeInputClass, className].filter(Boolean).join(" ")} {...props} />;
}

export function StoreSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return <select className={[storeSelectClass, className].filter(Boolean).join(" ")} {...props} />;
}

export function StoreFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export function StoreStatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}): JSX.Element {
  const toneClass =
    tone === "success"
      ? "border-sky-500/25 bg-sky-500/5"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/5"
        : tone === "danger"
          ? "border-red-500/25 bg-red-500/5"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/30";
  const valueClass =
    tone === "success"
      ? "text-sky-700 dark:text-sky-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "text-red-700 dark:text-red-300"
          : "text-slate-900 dark:text-white";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export function StoreWorkflowStep({
  step,
  title,
  description,
  active,
  done,
}: {
  step: number;
  title: string;
  description: string;
  active?: boolean;
  done?: boolean;
}): JSX.Element {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${active ? "border-sky-400 bg-sky-50/50 dark:bg-sky-950/20" : done ? "border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-slate-200 dark:border-slate-800"}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : active ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
        {done ? "✓" : step}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function StoreDataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number | ReactNode | null)[][];
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800/70 dark:bg-slate-900/20">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">No records</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
