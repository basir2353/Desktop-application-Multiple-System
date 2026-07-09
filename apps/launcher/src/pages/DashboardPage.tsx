import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { registerShellHost } from "@platform/shell-sdk";
import { catalogModuleSchema, type CatalogModule } from "@platform/contracts";
import { platformFetch } from "@platform/auth-client";
import { ThemeToggle } from "../components/ThemeToggle";
import { getApiBaseUrl } from "../lib/apiBase";
import { headingClass, mutedClass, subtleClass } from "../pops/lib/themeClasses";
import { useSessionStore } from "../stores/sessionStore";

const SampleApp = lazy(async () => {
  try {
    const m = await import("sample/App");
    return { default: m.App };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load federated remote";
    return {
      default: function SampleRemoteFallback(): JSX.Element {
        return (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-medium">Sample module could not be loaded</p>
            <p className="mt-2 text-amber-200/80">{msg}</p>
            <p className="mt-2 text-xs text-slate-400">
              From the repo root run{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5 text-indigo-200">pnpm dev:module:sample</code> then
              refresh. The rest of this page still works without it.
            </p>
          </div>
        );
      },
    };
  }
});

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const accessToken = useSessionStore((s) => s.accessToken);
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const claims = useSessionStore((s) => s.claims);
  const clear = useSessionStore((s) => s.clear);

  useEffect(() => {
    if (!claims) return;
    registerShellHost({
      getSession: () => ({
        userId: claims.sub,
        organizationId: claims.organizationId,
        permissions: claims.permissions,
      }),
      getConfig: () => ({ apiBaseUrl: getApiBaseUrl() }),
      navigate: (path: string) => navigate(path),
      trackEvent: () => undefined,
    });
  }, [claims, navigate]);

  const modulesQuery = useQuery({
    queryKey: ["catalog", "modules", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async (): Promise<CatalogModule[]> => {
      const res = await platformFetch(`${getApiBaseUrl()}/v1/catalog/modules`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Catalog failed: ${res.status}`);
      const json: unknown = await res.json();
      if (!Array.isArray(json)) throw new Error("Invalid catalog response");
      return json.map((row) => catalogModuleSchema.parse(row));
    },
  });

  const canUseSample = useMemo(() => {
    if (!claims) return false;
    return claims.permissions.includes("modules.sample.use") || claims.permissions.includes("*");
  }, [claims]);

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-slate-50 px-6 py-8 dark:bg-slate-950">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className={headingClass}>Module runtime</h1>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Organization <span className={subtleClass}>{claims?.organizationId}</span> · Local SQLite + outbox
            scaffold is active in this shell.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Button
            variant="ghost"
            onClick={() => {
              clear();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Marketplace catalog</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Module</th>
                <th className="px-4 py-2 font-medium">Latest</th>
                <th className="px-4 py-2 font-medium">Publisher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950/40">
              {modulesQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={3}>
                    Loading…
                  </td>
                </tr>
              ) : modulesQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-400" colSpan={3}>
                    {(modulesQuery.error as Error).message}
                  </td>
                </tr>
              ) : (
                modulesQuery.data?.map((m) => (
                  <tr key={m.slug}>
                    <td className="px-4 py-3 text-slate-100">{m.displayName}</td>
                    <td className="px-4 py-3 text-slate-300">{m.latestVersion}</td>
                    <td className="px-4 py-3 text-slate-400">{m.publisher ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Federated module host</h2>
        <p className="mt-2 text-sm text-slate-400">
          Start the sample remote with{" "}
          <code className="rounded bg-slate-900 px-2 py-1 text-xs text-indigo-200">pnpm dev:module:sample</code> from the
          monorepo root. The launcher resolves <code className="rounded bg-slate-900 px-2 py-1 text-xs">sample/App</code>{" "}
          via Module Federation.
        </p>
        {!canUseSample ? (
          <p className="mt-3 text-sm text-amber-300">Your user is missing the `modules.sample.use` permission.</p>
        ) : (
          <div className="mt-4">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading remote…</div>}>
              <SampleApp />
            </Suspense>
          </div>
        )}
      </section>

      <footer className="mt-10 text-xs text-slate-600">
        Refresh token is stored in memory for this scaffold ({refreshToken ? "present" : "missing"}).
      </footer>
    </div>
  );
}
