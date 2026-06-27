import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { pharmacyInputClass, pharmacySelectClass } from "../hooks/usePharmacy";

export function PharmacyField({
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
        {required ? <span className="text-emerald-600 dark:text-emerald-400">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function PharmacyInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input className={[pharmacyInputClass, className].filter(Boolean).join(" ")} {...props} />;
}

export function PharmacySelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return <select className={[pharmacySelectClass, className].filter(Boolean).join(" ")} {...props} />;
}

export function PharmacyFormSection({
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

export function PharmacyStatCard({
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
      ? "border-emerald-500/25 bg-emerald-500/5"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/5"
        : tone === "danger"
          ? "border-red-500/25 bg-red-500/5"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/30";
  const valueClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "text-red-700 dark:text-red-300"
          : "text-slate-900 dark:text-white";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
