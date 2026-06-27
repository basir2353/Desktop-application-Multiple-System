import { StoreField, StoreInput } from "./StoreUi";
import type { ReportDatePreset } from "../lib/reportDateFilter";

const PRESETS: { id: ReportDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function StoreReportDateFilter({
  title = "Date & time filter",
  description = "Select a period for this report.",
  fromLocal,
  toLocal,
  periodLabel,
  onFromChange,
  onToChange,
  onApply,
  onPreset,
}: {
  title?: string;
  description?: string;
  fromLocal: string;
  toLocal: string;
  periodLabel: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  onPreset: (preset: ReportDatePreset) => void;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPreset(id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:text-sky-400"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreField label="From">
          <StoreInput type="datetime-local" value={fromLocal} onChange={(e) => onFromChange(e.target.value)} />
        </StoreField>
        <StoreField label="To">
          <StoreInput type="datetime-local" value={toLocal} onChange={(e) => onToChange(e.target.value)} />
        </StoreField>
        <div className="flex items-end sm:col-span-2">
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 sm:w-auto"
          >
            Apply filter
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Showing: <span className="font-medium text-slate-700 dark:text-slate-300">{periodLabel}</span>
      </p>
    </div>
  );
}
