import { Button } from "@platform/ui";
import {
  LICENCE_PLANS,
  LICENCE_PLAN_META,
  LICENCE_PLAN_META_SETTINGS_KEY,
  resolveLicencePlanMeta,
  serializeLicencePlanMeta,
  type LicencePlan,
  type LicencePlanMeta,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchPlatformSettings, updatePlatformSettings } from "../lib/platformApi";
import {
  DEFAULT_RECEIPT_POWERED_BY,
  loadReceiptPoweredBy,
  saveReceiptBranding,
} from "../pops/lib/receiptBranding";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

const DEFAULT_KEYS = [
  {
    key: "support_email",
    label: "Support email",
    placeholder: "support@example.com",
    help: "Shown on login screens when maintenance mode is on.",
  },
  {
    key: "maintenance_message",
    label: "Maintenance message",
    placeholder: "Optional banner text shown on all login screens",
    help: "Leave empty to hide the banner. Non-empty text is shown globally.",
  },
  {
    key: "default_licence_plan",
    label: "Default licence plan",
    placeholder: "standard",
    help: "Applied when creating a new business if no plan is chosen.",
  },
  {
    key: "session_policy",
    label: "Session policy note",
    placeholder: "e.g. 15m access tokens",
    help: "Internal note for operators (not enforced automatically).",
  },
] as const;

export function SuperAdminSettingsPage(): JSX.Element {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["platform", "settings"], queryFn: fetchPlatformSettings });
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [planMeta, setPlanMeta] = useState<Record<LicencePlan, LicencePlanMeta>>(() => ({
    ...LICENCE_PLAN_META,
  }));
  const [poweredBy, setPoweredBy] = useState(DEFAULT_RECEIPT_POWERED_BY);
  const [message, setMessage] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);

  useEffect(() => {
    setPoweredBy(loadReceiptPoweredBy());
  }, []);

  useEffect(() => {
    if (!settings.data) return;
    const next: Record<string, string> = {};
    for (const row of DEFAULT_KEYS) {
      const value = settings.data.entries[row.key];
      next[row.key] = typeof value === "string" ? value : value != null ? String(value) : "";
    }
    setEntries(next);
    setPlanMeta(resolveLicencePlanMeta(settings.data.entries));
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () => updatePlatformSettings({ entries }),
    onSuccess: async () => {
      setMessage("Global settings saved. Maintenance banner and default plan take effect immediately.");
      await qc.invalidateQueries({ queryKey: ["platform", "settings"] });
      await qc.invalidateQueries({ queryKey: ["platform", "public-info"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Save failed"),
  });

  const savePlansMut = useMutation({
    mutationFn: () =>
      updatePlatformSettings({
        entries: {
          [LICENCE_PLAN_META_SETTINGS_KEY]: serializeLicencePlanMeta(planMeta),
        },
      }),
    onSuccess: async () => {
      setPlanMessage("Licence packages saved. New business form will use these labels, days, and prices.");
      await qc.invalidateQueries({ queryKey: ["platform", "settings"] });
    },
    onError: (err) => setPlanMessage(err instanceof Error ? err.message : "Save failed"),
  });

  function savePoweredBy(): void {
    const next = saveReceiptBranding({ poweredBy });
    setPoweredBy(next.poweredBy);
    setBrandingMessage("Receipt powered-by line saved. Prints above Thank you on every bill.");
  }

  function updatePlan(plan: LicencePlan, patch: Partial<LicencePlanMeta>): void {
    setPlanMeta((prev) => ({
      ...prev,
      [plan]: {
        ...prev[plan],
        ...patch,
        days: plan === "custom" ? null : patch.days !== undefined ? patch.days : prev[plan].days,
      },
    }));
    setPlanMessage(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Global settings</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Platform-wide configuration applied to every installation.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div>
          <h3 className={`text-sm font-semibold ${headingClass}`}>Receipt powered-by line</h3>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Prints above “Thank you — visit again” on every receipt. Restaurant admins cannot edit this —
            only Super Admin.
          </p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">Text</span>
          <input
            className={fieldInputClass}
            value={poweredBy}
            onChange={(e) => setPoweredBy(e.target.value)}
            placeholder={DEFAULT_RECEIPT_POWERED_BY}
          />
        </label>
        {brandingMessage ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{brandingMessage}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={savePoweredBy}>
            Save powered-by
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPoweredBy(DEFAULT_RECEIPT_POWERED_BY);
              saveReceiptBranding({ poweredBy: DEFAULT_RECEIPT_POWERED_BY });
              setBrandingMessage("Reset to default powered-by line.");
            }}
          >
            Reset default
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <h3 className={`text-sm font-semibold ${headingClass}`}>Licence packages (editable)</h3>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Edit what Super Admin sees on “New business” plan cards: name, days, suggested PKR, and
            description. Plan ids stay the same (trial_5, monthly_30, …). Suggested PKR is display-only.
          </p>
        </div>
        {settings.isLoading ? (
          <p className={mutedClass}>Loading…</p>
        ) : (
          <div className="space-y-4">
            {LICENCE_PLANS.map((plan) => {
              const row = planMeta[plan];
              return (
                <div
                  key={plan}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {plan}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">Label</span>
                      <input
                        className={fieldInputClass}
                        value={row.label}
                        onChange={(e) => updatePlan(plan, { label: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        Days {plan === "custom" ? "(fixed: pick on create)" : ""}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={3660}
                        className={fieldInputClass}
                        disabled={plan === "custom"}
                        value={plan === "custom" ? "" : row.days ?? ""}
                        placeholder={plan === "custom" ? "—" : "30"}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          updatePlan(plan, {
                            days: Number.isFinite(n) && n > 0 ? Math.floor(n) : null,
                          });
                        }}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        Suggested PKR (empty = “Set yourself”)
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={fieldInputClass}
                        value={row.suggestedPkr ?? ""}
                        placeholder="e.g. 15000"
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === "") {
                            updatePlan(plan, { suggestedPkr: null });
                            return;
                          }
                          const n = Number(raw);
                          updatePlan(plan, {
                            suggestedPkr: Number.isFinite(n) && n >= 0 ? Math.floor(n) : null,
                          });
                        }}
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">Description</span>
                      <textarea
                        className={`${fieldInputClass} min-h-[4rem]`}
                        value={row.blurb}
                        onChange={(e) => updatePlan(plan, { blurb: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            {planMessage ? (
              <p
                className={`text-sm ${
                  /fail|error/i.test(planMessage)
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {planMessage}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={savePlansMut.isPending}
                onClick={() => savePlansMut.mutate()}
              >
                {savePlansMut.isPending ? "Saving…" : "Save licence packages"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPlanMeta({ ...LICENCE_PLAN_META });
                  setPlanMessage("Reset to built-in defaults (click Save to persist).");
                }}
              >
                Reset defaults
              </Button>
            </div>
          </div>
        )}
      </section>

      {settings.isLoading ? (
        <p className={mutedClass}>Loading…</p>
      ) : (
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            saveMut.mutate();
          }}
        >
          {DEFAULT_KEYS.map((row) => (
            <label key={row.key} className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">{row.label}</span>
              {row.key === "default_licence_plan" ? (
                <select
                  className={fieldInputClass}
                  value={entries[row.key] || "standard"}
                  onChange={(e) => setEntries((prev) => ({ ...prev, [row.key]: e.target.value }))}
                >
                  {LICENCE_PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {planMeta[plan].label} ({plan})
                    </option>
                  ))}
                  {entries[row.key] &&
                  !LICENCE_PLANS.includes(entries[row.key] as (typeof LICENCE_PLANS)[number]) ? (
                    <option value={entries[row.key]}>{entries[row.key]}</option>
                  ) : null}
                </select>
              ) : row.key === "maintenance_message" ? (
                <textarea
                  className={`${fieldInputClass} min-h-[5rem]`}
                  placeholder={row.placeholder}
                  value={entries[row.key] ?? ""}
                  onChange={(e) => setEntries((prev) => ({ ...prev, [row.key]: e.target.value }))}
                />
              ) : (
                <input
                  className={fieldInputClass}
                  placeholder={row.placeholder}
                  value={entries[row.key] ?? ""}
                  onChange={(e) => setEntries((prev) => ({ ...prev, [row.key]: e.target.value }))}
                />
              )}
              <span className={`mt-1 block text-xs ${mutedClass}`}>{row.help}</span>
            </label>
          ))}
          {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
          <Button type="submit" disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      )}
    </div>
  );
}
