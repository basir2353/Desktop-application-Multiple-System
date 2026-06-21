/** Shared Tailwind classes with light + dark support across POPS. */

export const fieldInputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-amber-500/50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

export const fieldSelectClass = fieldInputClass;

export const panelClass =
  "rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40";

export const cardClass =
  "rounded-xl border border-slate-200 bg-white dark:border-slate-800/70 dark:bg-slate-900/30";

export const panelTitleClass = "text-sm font-medium text-slate-900 dark:text-white";

export const pageTitleClass = "text-base font-semibold tracking-tight text-slate-900 dark:text-white";

export const headingClass = "text-xl font-semibold tracking-tight text-slate-900 dark:text-white";

export const mutedClass = "text-slate-600 dark:text-slate-400";

export const tableOrderRefClass = "table-order-ref font-mono text-sm font-semibold";

export const tableCellPrimaryClass = "font-medium text-slate-900 dark:text-slate-100";

export const tableCellAmountClass =
  "tabular-nums font-semibold text-slate-900 dark:text-slate-100";

export const emptyStateBoxClass =
  "rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400";

export const linkActionClass =
  "font-medium text-sky-800 underline-offset-2 hover:text-sky-900 hover:underline dark:font-normal dark:text-sky-300 dark:no-underline dark:hover:text-sky-200";

export const linkDangerClass =
  "font-medium text-red-700 underline-offset-2 hover:text-red-800 hover:underline dark:font-normal dark:text-red-300 dark:no-underline dark:hover:text-red-200";

export const linkWarningClass =
  "font-medium text-amber-800 underline-offset-2 hover:text-amber-900 hover:underline dark:font-normal dark:text-amber-300 dark:no-underline dark:hover:text-amber-200";

export const linkSuccessClass =
  "font-medium text-emerald-800 underline-offset-2 hover:text-emerald-900 hover:underline dark:font-normal dark:text-emerald-300 dark:no-underline dark:hover:text-emerald-200";

export const accentValueClass = "font-medium text-amber-800 dark:text-amber-200";

/** Active amber pill / chip (Featured, category selected, etc.) */
export const amberPillActiveClass =
  "bg-amber-200 font-medium text-amber-950 ring-1 ring-amber-600/45 dark:bg-amber-500/20 dark:text-amber-50 dark:ring-amber-500/40";

/** Inactive pill on light or dark surfaces */
export const pillInactiveClass =
  "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-200";

export const subtleClass = "text-slate-600 dark:text-slate-300";

export const modalBackdropClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65";

export const modalBackdropRaisedClass =
  "fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65";

export const modalPanelClass =
  "flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900";

export const modalHeaderClass =
  "flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800";

export const modalTitleClass = "text-base font-semibold text-slate-900 dark:text-white";

export const modalSubtitleClass = "mt-0.5 text-xs text-slate-600 dark:text-slate-400";

export const modalCloseBtnClass =
  "shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";

export const modalBackBtnClass =
  "mb-3 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";

export const modalSectionCardClass =
  "rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-amber-500/50 hover:bg-amber-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-amber-500/40 dark:hover:bg-slate-700";

export const modalSectionCardDisabledClass =
  "cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800/50";

export const modalSectionTitleClass = "text-sm font-semibold text-slate-900 dark:text-white";

export const modalSectionTitleDisabledClass = "text-sm font-semibold text-slate-500 dark:text-slate-400";

export const modalSectionMetaClass = "mt-1 text-xs text-slate-600 dark:text-slate-400";

export const modalSectionMetaDisabledClass = "mt-1 text-xs text-slate-500 dark:text-slate-500";

export const modalTableBtnClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-slate-900 shadow-sm transition hover:border-amber-500/50 hover:bg-amber-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-amber-500/40 dark:hover:bg-slate-700";

export const modalBodyTextClass = "text-sm text-slate-600 dark:text-slate-400";

export const filterBarClass =
  "flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/50";

export const moduleSearchClass =
  "h-8 min-w-[10rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 sm:max-w-xs";

export const countBadgeClass =
  "rounded-full bg-slate-100 px-2.5 py-1 text-[11px] tabular-nums text-slate-500 dark:bg-slate-800/80 dark:text-slate-400";

export const noticeSuccessClass =
  "rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200";

export const noticeWarningClass =
  "rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200";

export const noticeErrorClass =
  "rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300";

export const screenCenterClass =
  "flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400";

export const loginCardClass =
  "rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/60";
