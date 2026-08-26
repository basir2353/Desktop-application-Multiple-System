import { useState } from "react";
import { getApiBaseUrl, LOCAL_API_URL } from "../lib/apiBase";
import { useDataModeStore, type ApiPreset } from "../stores/dataModeStore";

type Props = {
  compact?: boolean;
};

const PRESETS: { id: ApiPreset; label: string; hint: string }[] = [
  { id: "live", label: "Live (Railway)", hint: "Active OLD or NEW server" },
  { id: "local", label: "Local API", hint: LOCAL_API_URL },
];

export function ApiEndpointSelector({ compact = false }: Props): JSX.Element {
  const apiPreset = useDataModeStore((s) => s.apiPreset);
  const cloudApiUrl = useDataModeStore((s) => s.cloudApiUrl);
  const setApiPreset = useDataModeStore((s) => s.setApiPreset);
  const setCloudApiUrl = useDataModeStore((s) => s.setCloudApiUrl);

  const [customDraft, setCustomDraft] = useState(cloudApiUrl);
  const activeUrl = getApiBaseUrl();

  function selectPreset(preset: ApiPreset): void {
    setApiPreset(preset);
  }

  function saveCustom(): void {
    setCloudApiUrl(customDraft);
    setApiPreset("custom");
  }

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">API server</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                apiPreset === p.id
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 truncate text-[10px] text-slate-500" title={activeUrl}>
          Using: {activeUrl}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-white">API server</div>
      <p className="text-xs text-slate-400">
        Choose where this app connects. Use <span className="text-slate-200">Local API</span> after
        running <span className="font-mono text-slate-300">local\start-local.bat</span> (API at{" "}
        <span className="font-mono text-slate-300">127.0.0.1:3000</span>). Use{" "}
        <span className="text-slate-200">Live</span> for the hosted Railway database.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPreset(p.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              apiPreset === p.id
                ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600"
            }`}
          >
            <span className="block font-semibold">{p.label}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{p.hint}</span>
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2">
        <div className="text-xs font-medium text-slate-300">Custom URL (optional)</div>
        <input
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          placeholder="https://backend-desktop-production-600b.up.railway.app"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
            onClick={saveCustom}
          >
            Save custom URL
          </button>
          <span className="text-xs text-slate-500">Active: {activeUrl}</span>
        </div>
      </div>
    </div>
  );
}
