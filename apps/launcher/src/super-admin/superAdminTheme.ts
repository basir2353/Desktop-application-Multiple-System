/**
 * POPS Super Admin — consistent light + dark tokens (teal brand).
 * All SA pages should prefer these over ad-hoc slate/amber/dark: mixes.
 */

/** Root: light cool canvas / dark ink canvas */
export const saRootClass =
  "sa-root min-h-screen bg-[#F4F6F9] font-[family-name:var(--sa-font)] text-slate-900 antialiased dark:bg-[#0B1220] dark:text-slate-100";

export const saSidebarClass =
  "flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white text-slate-900 dark:border-white/5 dark:bg-[#070D18] dark:text-slate-100";

export const saNavActiveClass =
  "relative flex items-center gap-2 rounded-lg bg-teal-500/15 px-3 py-2 text-sm font-semibold text-teal-800 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-teal-600 dark:bg-teal-500/15 dark:text-teal-300 dark:before:bg-teal-400";

export const saNavIdleClass =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100";

export const saHeaderClass =
  "sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-[#0B1220]/90";

export const saMainClass = "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8";

export const saPageTitleClass =
  "text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white";

export const saPageSubClass = "mt-1 text-sm text-slate-500 dark:text-slate-400";

export const saCardClass =
  "rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 dark:border-white/10 dark:bg-[#111827] dark:shadow-none";

export const saStatClass =
  "rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none";

export const saTableWrapClass =
  "overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none";

export const saTableHeadClass =
  "border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400";

export const saTableBodyClass = "divide-y divide-slate-100 dark:divide-white/10";

export const saInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/15 dark:bg-[#070D18] dark:text-slate-100 dark:placeholder:text-slate-500";

export const saBtnPrimaryClass =
  "inline-flex items-center justify-center rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500";

export const saBtnGhostClass =
  "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5";

export const saBtnAccentClass =
  "inline-flex items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 transition hover:bg-teal-100 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-200 dark:hover:bg-teal-500/25";

export const saBtnDangerClass =
  "inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10";

export const saBadgeActiveClass =
  "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30";

export const saLinkClass =
  "font-medium text-teal-700 transition hover:text-teal-800 hover:underline dark:text-teal-300 dark:hover:text-teal-200";

export const saWarnPanelClass =
  "rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10";

/** Text/links inside warn panels — amber stays semantic, dual-mode readable */
export const saWarnTextClass = "text-amber-950 dark:text-amber-100";
export const saWarnLinkClass =
  "font-medium text-amber-900 hover:underline dark:text-amber-200 dark:hover:text-amber-100";

export const saSuccessPanelClass =
  "rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";

export const saDangerPanelClass =
  "rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";

export const saMutedClass = "text-slate-500 dark:text-slate-400";

export const saHeadingClass =
  "text-base font-semibold tracking-tight text-slate-900 dark:text-white";

export const saLabelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300";

export const saDividerClass = "border-slate-200 dark:border-white/10";

export const saMobileNavActiveClass =
  "shrink-0 rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white dark:bg-teal-600";

export const saMobileNavIdleClass =
  "shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15";
