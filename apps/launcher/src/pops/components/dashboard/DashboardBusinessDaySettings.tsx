import { useEffect, useState } from "react";
import { Button } from "@platform/ui";
import {
  DEFAULT_BUSINESS_DAY,
  formatBusinessDayRange,
  loadBusinessDaySettings,
  normalizeBusinessDaySettings,
  saveBusinessDaySettings,
  type BusinessDaySettings,
} from "../../lib/businessDay";

type Props = {
  branchCode: string | undefined;
  onChange?: (settings: BusinessDaySettings) => void;
};

export function DashboardBusinessDaySettings({ branchCode, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BusinessDaySettings>(DEFAULT_BUSINESS_DAY);
  const [saved, setSaved] = useState<BusinessDaySettings>(DEFAULT_BUSINESS_DAY);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadBusinessDaySettings(branchCode);
    setSaved(loaded);
    setDraft(loaded);
    onChange?.(loaded);
  }, [branchCode]);

  function apply(): void {
    if (!branchCode) return;
    const next = normalizeBusinessDaySettings(draft);
    saveBusinessDaySettings(branchCode, next);
    setSaved(next);
    setDraft(next);
    onChange?.(next);
    setNotice("Business day hours saved.");
    setOpen(false);
  }

  function reset(): void {
    setDraft(DEFAULT_BUSINESS_DAY);
  }

  if (!branchCode) return <></>;

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Business day</h2>
          <p className="mt-1 text-xs text-slate-500">
            Sales and charts use this window instead of midnight. Current:{" "}
            <span className="text-slate-300">{formatBusinessDayRange(saved)}</span>
          </p>
        </div>
        <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Configure"}
        </Button>
      </div>

      {notice && !open ? (
        <p className="mt-2 text-xs text-emerald-300/90">{notice}</p>
      ) : null}

      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Day start
            <input
              type="time"
              value={draft.dayStart}
              onChange={(e) => setDraft((prev) => ({ ...prev, dayStart: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Day end
            <input
              type="time"
              value={draft.dayEnd}
              onChange={(e) => setDraft((prev) => ({ ...prev, dayEnd: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </label>
          <p className="sm:col-span-2 text-xs text-slate-500">
            Example: start <strong className="text-slate-400">06:00</strong> and end{" "}
            <strong className="text-slate-400">05:00</strong> for overnight service — orders after midnight
            count toward the previous business day until 05:00.
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" className="h-8 text-xs" onClick={() => apply()}>
              Save business day
            </Button>
            <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => reset()}>
              Reset to midnight
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
