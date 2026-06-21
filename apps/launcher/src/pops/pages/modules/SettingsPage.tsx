import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import {
  DEFAULT_POS_SETTINGS,
  loadPosSettings,
  normalizePosSettings,
  savePosSettings,
  type PosSettings,
} from "../../lib/posSettings";
import { computeTicketTotals } from "../../lib/posDiscount";
import { DashboardBusinessDaySettings } from "../../components/dashboard/DashboardBusinessDaySettings";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useThemeStore } from "../../../stores/themeStore";
import { PageHeader } from "../../ui/PageHeader";

export function SettingsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const themeMode = useThemeStore((s) => s.mode);
  const [saved, setSaved] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [draft, setDraft] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPosSettings(branch?.code);
    setSaved(loaded);
    setDraft(loaded);
  }, [branch?.code]);

  const preview = useMemo(() => {
    const sampleSubtotal = 10_000;
    return computeTicketTotals(sampleSubtotal, 0, draft.servicePct, draft.taxPct);
  }, [draft.servicePct, draft.taxPct]);

  function apply(): void {
    if (!branch?.code) return;
    const next = normalizePosSettings(draft);
    savePosSettings(branch.code, next);
    setSaved(next);
    setDraft(next);
    setNotice("POS charges saved. They apply to new tickets immediately.");
  }

  function reset(): void {
    setDraft(DEFAULT_POS_SETTINGS);
  }

  if (!branch?.code) {
    return <PageHeader title="Settings" subtitle="Select a branch to configure POS charges." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle={`Branch configuration for ${branch.name} (${branch.code}) — POS charges and business day hours.`}
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </p>
      ) : null}

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</div>
        <p className="mt-1 text-xs text-slate-500">
          Choose light or dark mode for the restaurant ERP interface. Current: {themeMode}.
        </p>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">POS charges</div>
        <p className="mt-1 text-xs text-slate-500">
          Current: service {saved.servicePct}%, sales tax {saved.taxPct}%.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Service charge (%)
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={draft.servicePct}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, servicePct: Number(e.target.value) || 0 }))
              }
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Sales tax (%)
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={draft.taxPct}
              onChange={(e) => setDraft((prev) => ({ ...prev, taxPct: Number(e.target.value) || 0 }))}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Tax is calculated on subtotal after discount, plus service charge. Example on Rs 10,000
          subtotal: service Rs {preview.service.toLocaleString()}, tax Rs {preview.tax.toLocaleString()},
          total Rs {preview.total.toLocaleString()}.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" className="text-xs" onClick={() => apply()}>
            Save settings
          </Button>
          <Button type="button" variant="ghost" className="text-xs" onClick={() => reset()}>
            Reset to defaults
          </Button>
        </div>
      </div>

      <div className="max-w-xl">
        <DashboardBusinessDaySettings branchCode={branch.code} />
      </div>
    </div>
  );
}
