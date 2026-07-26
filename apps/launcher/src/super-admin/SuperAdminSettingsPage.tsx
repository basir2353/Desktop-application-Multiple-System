import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchPlatformSettings, updatePlatformSettings } from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

const DEFAULT_KEYS = [
  { key: "support_email", label: "Support email", placeholder: "support@example.com" },
  { key: "maintenance_message", label: "Maintenance message", placeholder: "Optional banner text" },
  { key: "default_licence_plan", label: "Default licence plan", placeholder: "standard" },
  { key: "session_policy", label: "Session policy note", placeholder: "e.g. 15m access tokens" },
] as const;

export function SuperAdminSettingsPage(): JSX.Element {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["platform", "settings"], queryFn: fetchPlatformSettings });
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    const next: Record<string, string> = {};
    for (const row of DEFAULT_KEYS) {
      const value = settings.data.entries[row.key];
      next[row.key] = typeof value === "string" ? value : value != null ? String(value) : "";
    }
    setEntries(next);
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () => updatePlatformSettings({ entries }),
    onSuccess: async () => {
      setMessage("Global settings saved.");
      await qc.invalidateQueries({ queryKey: ["platform", "settings"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Save failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Global settings</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Platform-wide configuration that can apply to every installation.
        </p>
      </div>

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
              <input
                className={fieldInputClass}
                placeholder={row.placeholder}
                value={entries[row.key] ?? ""}
                onChange={(e) => setEntries((prev) => ({ ...prev, [row.key]: e.target.value }))}
              />
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
