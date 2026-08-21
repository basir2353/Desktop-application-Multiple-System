import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchSyncStatus, formatSyncDuration, triggerManualSync } from "../lib/syncAgent";
import { getApiBaseUrl } from "../lib/apiBase";
import { authFetch } from "../lib/authFetch";
import { useSuperAdminEnvStore } from "../stores/superAdminEnvStore";
import { selectedEnvMeta, SuperAdminEnvCards } from "./SuperAdminEnvSwitch";
import { SuperAdminAutoUpdates } from "./SuperAdminAutoUpdates";
import {
  saBadgeActiveClass,
  saBtnGhostClass,
  saBtnPrimaryClass,
  saCardClass,
  saDangerPanelClass,
  saHeadingClass,
  saMutedClass,
  saSuccessPanelClass,
  saTableBodyClass,
  saTableHeadClass,
  saTableWrapClass,
} from "./superAdminTheme";

type Probe = {
  id: string;
  app: string;
  path: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
  error: string | null;
  dbOn?: boolean;
};

const PUBLIC_APPS: { app: string; path: string }[] = [
  { app: "API process", path: "/health" },
  { app: "Database", path: "/health/db" },
  { app: "Platform public-info", path: "/v1/platform/public-info" },
];

const AUTH_APPS: { app: string; path: string }[] = [
  { app: "Platform analytics", path: "/v1/platform/analytics" },
  { app: "Businesses", path: "/v1/platform/businesses" },
  { app: "Users", path: "/v1/platform/users" },
  { app: "Settings", path: "/v1/platform/settings" },
  { app: "Catalog modules", path: "/v1/catalog/modules" },
];

function OnOff({ on, loading }: { on: boolean | undefined; loading?: boolean }): JSX.Element {
  if (loading || on === undefined) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15">
        CHECKING
      </span>
    );
  }
  return on ? (
    <span className={saBadgeActiveClass}>ON</span>
  ) : (
    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">
      OFF
    </span>
  );
}

async function pingPublic(baseUrl: string, app: string, path: string): Promise<Probe> {
  const started = performance.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { method: "GET" });
    const text = await res.text();
    const ms = Math.round(performance.now() - started);
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }
    const db = parseDb(parsed);
    const error = res.ok
      ? db.error
      : `HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`;
    return {
      id: path,
      app,
      path,
      ok: res.ok && !db.error && db.status !== "degraded",
      status: res.status,
      ms,
      detail: summarizeBody(parsed, db),
      error,
      dbOn: db.connected,
    };
  } catch (err) {
    return {
      id: path,
      app,
      path,
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      detail: "No response",
      error: err instanceof Error ? err.message : "Request failed",
      dbOn: false,
    };
  }
}

async function pingAuth(app: string, path: string): Promise<Probe> {
  const started = performance.now();
  try {
    const res = await authFetch(path);
    const text = await res.text();
    const ms = Math.round(performance.now() - started);
    const error = res.ok ? null : `HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`;
    return {
      id: path,
      app,
      path,
      ok: res.ok,
      status: res.status,
      ms,
      detail: res.ok ? summarizeAuth(text) : "Failed",
      error,
    };
  } catch (err) {
    return {
      id: path,
      app,
      path,
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      detail: "No response",
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

function parseDb(body: unknown): {
  connected?: boolean;
  userCount?: number;
  status?: string;
  error: string | null;
} {
  if (!body || typeof body !== "object") return { error: null };
  const rec = body as { status?: unknown; checks?: Record<string, unknown> };
  const checks = rec.checks ?? {};
  const connected = typeof checks.connected === "boolean" ? checks.connected : undefined;
  const userCount = typeof checks.userCount === "number" ? checks.userCount : undefined;
  const status = typeof rec.status === "string" ? rec.status : undefined;
  const error =
    typeof checks.error === "string"
      ? checks.error
      : typeof checks.userCountError === "string"
        ? checks.userCountError
        : status === "degraded"
          ? "Database degraded"
          : null;
  return { connected, userCount, status, error };
}

function summarizeBody(
  body: unknown,
  db: { connected?: boolean; userCount?: number; status?: string },
): string {
  if (db.connected !== undefined) {
    const users = db.userCount != null ? ` · ${db.userCount} users` : "";
    return `Postgres ${db.connected ? "connected" : "down"}${users}`;
  }
  if (body && typeof body === "object" && "status" in body) {
    return `status ${(body as { status?: string }).status ?? "ok"}`;
  }
  return "OK";
}

function summarizeAuth(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return `${parsed.length} records`;
    if (parsed && typeof parsed === "object") return "OK";
  } catch {
    /* ignore */
  }
  return "OK";
}

async function runLiveTests(): Promise<Probe[]> {
  const baseUrl = getApiBaseUrl();
  const publicProbes = PUBLIC_APPS.map((app) => pingPublic(baseUrl, app.app, app.path));
  const authProbes = AUTH_APPS.map((app) => pingAuth(app.app, app.path));
  return Promise.all([...publicProbes, ...authProbes]);
}

export function SuperAdminHealthPage(): JSX.Element {
  const queryClient = useQueryClient();
  const env = useSuperAdminEnvStore((s) => s.env);
  const meta = selectedEnvMeta(env);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const live = useQuery({
    queryKey: ["platform", "live-tests", env],
    queryFn: runLiveTests,
    refetchInterval: 20_000,
  });
  const sync = useQuery({
    queryKey: ["platform", "sync-status"],
    queryFn: fetchSyncStatus,
    refetchInterval: (query) => (query.state.data?.running ? 1_000 : 2_000),
  });
  const manualSync = useMutation({
    mutationFn: triggerManualSync,
    onSuccess: (result) => {
      if (!result.ok) {
        setSyncHint("Sync agent offline — start local/sync-old-to-new.mjs");
        return;
      }
      setSyncHint(result.queued ? "Sync already running — queued another check" : "Manual check started");
      void queryClient.invalidateQueries({ queryKey: ["platform", "sync-status"] });
    },
  });

  const probes = live.data ?? [];
  const api = probes.find((p) => p.path === "/health");
  const db = probes.find((p) => p.path === "/health/db");
  const errors = probes.filter((p) => !p.ok || p.error);
  const loading = live.isLoading && probes.length === 0;
  const apiOn = api?.ok === true;
  const dbOn = db?.dbOn === true;
  const elapsedMs =
    sync.data?.running && sync.data.startedAt
      ? Math.max(0, Date.now() - new Date(sync.data.startedAt).getTime())
      : (sync.data?.elapsedMs ?? sync.data?.ms ?? 0);
  const connecting = sync.data?.phase === "connecting" || (sync.data?.currentTable ?? "").startsWith("Connecting");
  const movedRows = (sync.data?.details ?? []).filter(
    (row) => (row.inserted ?? 0) > 0 || (row.updated ?? 0) > 0 || row.error,
  );
  const tablesDone = sync.data?.tablesDone ?? 0;
  const tablesTotal = sync.data?.tablesTotal ?? 0;
  const progressPct =
    tablesTotal > 0 ? Math.min(100, Math.round((tablesDone / tablesTotal) * 100)) : sync.data?.running ? 0 : 100;
  const liveChecks = [...(sync.data?.details ?? [])].reverse().slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
          <h2 className={`text-lg font-semibold ${saHeadingClass}`}>Health & API</h2>
          <p className={`mt-1 text-sm ${saMutedClass}`}>
            Sirf ek server Active. Jo pehle se Active par hai woh dobara copy nahi hota — sirf
            nayi ya changed rows move hoti hain. Neeche copied / skipped / estimated time dikhta
            hai.
          </p>
        </div>
        <button type="button" className={saBtnGhostClass} onClick={() => void live.refetch()}>
          {live.isFetching ? "Testing…" : "Run live tests"}
        </button>
      </div>

      <SuperAdminEnvCards />

      <SuperAdminAutoUpdates />

      {sync.data ? (
        <div className={saCardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data moved into Active
              </p>
              <p className="mt-1 text-sm font-semibold">
                {sync.data.direction || "Waiting for first sync"}
              </p>
              <p className={`mt-1 text-xs ${saMutedClass}`}>
                {sync.data.running
                  ? connecting
                    ? `${sync.data.currentTable ?? "Connecting databases…"}`
                    : `Checking ${sync.data.currentTable ?? "tables"} · ${sync.data.tablesDone ?? 0}/${sync.data.tablesTotal ?? 0} tables`
                  : sync.data.finishedAt
                    ? `Last sync ${new Date(sync.data.finishedAt).toLocaleString()}`
                    : "No completed cycle yet"}
              </p>
        </div>
            <div className="text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className={saBtnPrimaryClass}
                  disabled={!sync.data || manualSync.isPending}
                  onClick={() => {
                    setSyncHint(null);
                    manualSync.mutate();
                  }}
                >
                  {sync.data?.running
                    ? "Checking…"
                    : manualSync.isPending
                      ? "Starting…"
                      : "Check again now"}
                </button>
                {sync.data?.running ? (
                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                    {connecting ? "Connecting" : "Moving data"}
                  </span>
                ) : (
                  <span className={saBadgeActiveClass}>Idle</span>
                )}
              </div>
              <p className="mt-2 text-lg font-semibold tabular-nums">
                {sync.data.running
                  ? connecting
                    ? `Elapsed ${formatSyncDuration(elapsedMs)}`
                    : `Est. ${formatSyncDuration(sync.data.etaMs)} left`
                  : `Last cycle ${formatSyncDuration(sync.data.lastCycleMs ?? sync.data.ms)}`}
              </p>
              {sync.data.running ? (
                <p className={`text-xs ${saMutedClass}`}>
                  {connecting
                    ? "Waiting for Postgres…"
                    : `Elapsed ${formatSyncDuration(elapsedMs)}`}
                </p>
              ) : (
                <p className={`text-xs ${saMutedClass}`}>Auto check ~60s · only new/changed rows</p>
              )}
              {syncHint ? <p className={`mt-1 text-xs text-teal-700 dark:text-teal-300`}>{syncHint}</p> : null}
            </div>
          </div>
          {(sync.data.running || tablesTotal > 0) && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={saMutedClass}>
                  {sync.data.running
                    ? connecting
                      ? "Connecting to databases…"
                      : `Checking tables ${tablesDone}/${tablesTotal || "?"}`
                    : "Last check complete"}
                </span>
                <span className="font-semibold tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sync.data.running
                      ? "animate-pulse bg-teal-600 dark:bg-teal-500"
                      : sync.data.ok
                        ? "bg-teal-600 dark:bg-teal-500"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${sync.data.running && tablesTotal === 0 ? 8 : progressPct}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
            {[
              ["Tables", sync.data.tables],
              ["Columns", sync.data.columns],
              ["Copied", sync.data.rows],
              ["New", sync.data.inserted],
              ["Changed", sync.data.updated],
              ["Already there", sync.data.skipped ?? 0],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {sync.data.errors.length > 0 ? (
            <div className={`${saDangerPanelClass} mt-4`}>
              <p className="font-semibold">Sync errors ({sync.data.errors.length})</p>
              <ul className="mt-2 space-y-1 text-xs">
                {sync.data.errors.slice(0, 8).map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {sync.data.running && liveChecks.length > 0 ? (
            <div className={`${saTableWrapClass} mt-4`}>
              <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10">
                Live — tables being checked
              </p>
              <table className="min-w-full text-sm">
                <thead className={saTableHeadClass}>
                  <tr>
                    <th className="px-4 py-2">Table</th>
                    <th className="px-4 py-2">New</th>
                    <th className="px-4 py-2">Changed</th>
                    <th className="px-4 py-2">Already there</th>
                  </tr>
                </thead>
                <tbody className={saTableBodyClass}>
                  {liveChecks.map((row) => (
                    <tr key={row.table}>
                      <td className="px-4 py-2 font-mono text-xs">{row.table}</td>
                      <td className="px-4 py-2">{row.inserted ?? 0}</td>
                      <td className="px-4 py-2">{row.updated ?? 0}</td>
                      <td className="px-4 py-2">{row.skipped ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {!sync.data.running && movedRows.length > 0 ? (
            <div className={`${saTableWrapClass} mt-4`}>
              <table className="min-w-full text-sm">
                <thead className={saTableHeadClass}>
                  <tr>
                    <th className="px-4 py-2">Table</th>
                    <th className="px-4 py-2">Columns</th>
                    <th className="px-4 py-2">New</th>
                    <th className="px-4 py-2">Changed</th>
                    <th className="px-4 py-2">Already there</th>
                  </tr>
                </thead>
                <tbody className={saTableBodyClass}>
                  {movedRows.slice(0, 40).map((row) => (
                    <tr key={row.table}>
                      <td className="px-4 py-2 font-mono text-xs">{row.table}</td>
                      <td className="px-4 py-2">{row.columns ?? "—"}</td>
                      <td className="px-4 py-2">{row.inserted ?? 0}</td>
                      <td className="px-4 py-2">{row.updated ?? 0}</td>
                      <td className="px-4 py-2">
                        {row.error ? (
                          <span className="text-rose-600 dark:text-rose-300">{row.error}</span>
                        ) : (
                          row.skipped ?? 0
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !sync.data.running && (sync.data.skipped ?? 0) > 0 ? (
            <p className={`mt-4 text-sm ${saMutedClass}`}>
              Verified — {sync.data.skipped} rows already on Active. Nothing new left to copy. Press
              &quot;Check again now&quot; anytime to re-scan.
            </p>
          ) : null}
        </div>
      ) : (
        <div className={saCardClass}>
          <p className="text-sm font-semibold">Data sync agent</p>
          <p className={`mt-1 text-sm ${saMutedClass}`}>
            Local sync agent is offline. Active still switches the whole app, but database copy
            will not run until the agent is started.
          </p>
          <p className={`mt-2 text-xs ${saMutedClass}`}>
            Start:{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              local\start-sync-agent.bat
            </code>{" "}
            (requires <code className="font-mono">local\.env.sync.local</code>)
          </p>
        </div>
      )}

      <div className={saCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Running on {meta.label}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{meta.url}</p>
            <p className={`mt-2 text-xs ${saMutedClass}`}>{meta.dbName}</p>
          </div>
          <OnOff on={loading ? undefined : apiOn} loading={loading} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">API</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{loading ? "…" : apiOn ? "ON" : "OFF"}</span>
              <span className={`text-xs ${saMutedClass}`}>{api?.ms ? `${api.ms} ms` : "—"}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Database
            </p>
            <div className="mt-2">
              <OnOff on={loading ? undefined : dbOn} loading={loading} />
            </div>
            <p className={`mt-2 text-xs ${dbOn || loading ? saMutedClass : "text-rose-600 dark:text-rose-300"}`}>
              {loading ? "Checking Postgres…" : db?.error ?? db?.detail ?? "Not checked"}
            </p>
          </div>
        </div>
      </div>

      {errors.length > 0 ? (
        <div className={saDangerPanelClass}>
          <p className="font-semibold">Live errors on {meta.label} ({errors.length})</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {errors.map((err) => (
              <li key={err.id}>
                <span className="font-semibold">{err.app}</span>{" "}
                <span className="font-mono text-xs">{err.path}</span>
                <div className="mt-0.5 break-all text-xs opacity-90">{err.error ?? "Failed"}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : probes.length > 0 ? (
        <div className={saSuccessPanelClass}>
          All live tests passed on {meta.label} — API and database are ON.
      </div>
      ) : null}

      <div>
        <h3 className={`mb-2 text-sm font-semibold ${saHeadingClass}`}>
          Live tests · {meta.label} only
        </h3>
        <div className={saTableWrapClass}>
          <table className="min-w-full text-sm">
            <thead className={saTableHeadClass}>
              <tr>
                <th className="px-4 py-2">App</th>
                <th className="px-4 py-2">Path</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody className={saTableBodyClass}>
              {loading ? (
                <tr>
                  <td className={`px-4 py-4 ${saMutedClass}`} colSpan={5}>
                    Running live tests on {meta.label}…
                  </td>
                </tr>
              ) : (
                probes.map((probe) => (
                  <tr key={probe.id}>
                    <td className="px-4 py-2">{probe.app}</td>
                    <td className="px-4 py-2 font-mono text-xs">{probe.path}</td>
                    <td className="px-4 py-2">
                      <OnOff on={probe.ok} />
                    </td>
                    <td className={`px-4 py-2 ${saMutedClass}`}>{probe.ms} ms</td>
                    <td className="px-4 py-2">
                      <span className={probe.ok ? saMutedClass : "text-rose-600 dark:text-rose-300"}>
                        {probe.ok ? probe.detail : probe.error ?? probe.detail}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
