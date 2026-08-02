import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "../lib/apiBase";
import { fetchPlatformPublicInfo } from "../lib/platformApi";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";

async function pingHealth(baseUrl: string): Promise<{ ok: boolean; status: number; body: string; ms: number }> {
  const started = performance.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { method: "GET" });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body: text.slice(0, 400),
      ms: Math.round(performance.now() - started),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: err instanceof Error ? err.message : "Request failed",
      ms: Math.round(performance.now() - started),
    };
  }
}

export function SuperAdminHealthPage(): JSX.Element {
  const apiBase = getApiBaseUrl();
  const health = useQuery({
    queryKey: ["platform", "health", apiBase],
    queryFn: () => pingHealth(apiBase),
    refetchInterval: 30_000,
  });
  const publicInfo = useQuery({
    queryKey: ["platform", "public-info"],
    queryFn: fetchPlatformPublicInfo,
  });

  const h = health.data;
  const banner =
    typeof publicInfo.data?.maintenanceMessage === "string"
      ? publicInfo.data.maintenanceMessage
      : typeof (publicInfo.data as { maintenance_message?: string } | undefined)?.maintenance_message ===
          "string"
        ? (publicInfo.data as { maintenance_message?: string }).maintenance_message
        : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Health & API</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Live connectivity to the hosted Nest API used by desktop and APKs.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 border-slate-200 bg-white">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">API base URL</p>
          <p className="mt-2 break-all font-mono text-sm">{apiBase}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            h?.ok
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">/health</p>
          {health.isLoading ? (
            <p className="mt-2 text-sm">Checking…</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-semibold">{h?.ok ? "OK" : "DOWN"}</p>
              <p className={`mt-1 text-xs ${mutedClass}`}>
                HTTP {h?.status || "—"} · {h?.ms ?? "—"} ms
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 border-slate-200 bg-white">
        <p className="text-sm font-semibold">Maintenance banner (public-info)</p>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          {banner?.trim()
            ? banner
            : "No maintenance message — login screens are clear."}
        </p>
        {typeof publicInfo.data?.supportEmail === "string" && publicInfo.data.supportEmail ? (
          <p className="mt-2 text-sm">Support: {publicInfo.data.supportEmail}</p>
        ) : null}
      </div>

      {h?.body ? (
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100 dark:border-white/10 dark:bg-[#070D18]">
          {h.body}
        </pre>
      ) : null}
    </div>
  );
}
