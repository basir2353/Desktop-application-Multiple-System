import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}): JSX.Element {
  const cls =
    tone === "success"
      ? "bg-emerald-200 text-emerald-950 ring-emerald-600/45 dark:bg-emerald-500/20 dark:text-emerald-50 dark:ring-emerald-500/35"
      : tone === "warning"
        ? "bg-amber-200 text-amber-950 ring-amber-600/50 dark:bg-amber-500/20 dark:text-amber-50 dark:ring-amber-500/40"
        : tone === "danger"
          ? "bg-red-200 text-red-950 ring-red-600/45 dark:bg-red-500/20 dark:text-red-50 dark:ring-red-500/35"
          : tone === "info"
            ? "bg-sky-200 text-sky-950 ring-sky-600/45 dark:bg-sky-500/20 dark:text-sky-50 dark:ring-sky-500/35"
            : "bg-slate-200 text-slate-800 ring-slate-400/60 dark:bg-slate-700/50 dark:text-slate-200 dark:ring-slate-600/50";
  return (
    <span
      data-badge-tone={tone}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}
