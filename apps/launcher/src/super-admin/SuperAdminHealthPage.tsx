import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl, describeLiveServer } from "../lib/apiBase";
import { authFetch } from "../lib/authFetch";
import { SuperAdminAutoUpdates } from "./SuperAdminAutoUpdates";
import {
  saBadgeActiveClass,
  saBtnGhostClass,
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
  const live = describeLiveServer();
  const liveQuery = useQuery({
    queryKey: ["platform", "live-tests"],
    queryFn: runLiveTests,
    refetchInterval: 20_000,
  });

  const probes = liveQuery.data ?? [];
  const api = probes.find((p) => p.path === "/health");
  const db = probes.find((p) => p.path === "/health/db");
  const errors = probes.filter((p) => !p.ok || p.error);
  const loading = liveQuery.isLoading && probes.length === 0;
  const apiOn = api?.ok === true;
  const dbOn = db?.dbOn === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${saHeadingClass}`}>Health & API</h2>
          <p className={`mt-1 text-sm ${saMutedClass}`}>
            Live Railway server status — API and database probes run every 20 seconds.
          </p>
        </div>
        <button type="button" className={saBtnGhostClass} onClick={() => void liveQuery.refetch()}>
          {liveQuery.isFetching ? "Testing…" : "Run live tests"}
        </button>
      </div>

      <SuperAdminAutoUpdates />

      <div className={saCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live server</p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{live.url}</p>
            <p className={`mt-2 text-xs ${saMutedClass}`}>{live.dbLabel}</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Database</p>
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
          <p className="font-semibold">Live errors ({errors.length})</p>
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
        <div className={saSuccessPanelClass}>All live tests passed — API and database are ON.</div>
      ) : null}

      <div>
        <h3 className={`mb-2 text-sm font-semibold ${saHeadingClass}`}>Live tests</h3>
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
                    Running live tests…
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
