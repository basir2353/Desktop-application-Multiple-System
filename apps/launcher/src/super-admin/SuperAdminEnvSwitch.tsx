import { useQueryClient } from "@tanstack/react-query";
import { NEW_RAILWAY_API_URL, OLD_RAILWAY_API_URL } from "../lib/apiBase";
import { type SuperAdminEnv, useSuperAdminEnvStore } from "../stores/superAdminEnvStore";
import { saBadgeActiveClass, saBtnGhostClass, saCardClass, saMutedClass } from "./superAdminTheme";

const SERVERS: {
  id: SuperAdminEnv;
  label: string;
  url: string;
  dbName: string;
}[] = [
  {
    id: "old",
    label: "OLD",
    url: OLD_RAILWAY_API_URL,
    dbName: "OLD Postgres (hayabusa)",
  },
  {
    id: "new",
    label: "NEW",
    url: NEW_RAILWAY_API_URL,
    dbName: "NEW Postgres (acela)",
  },
];

export function selectedEnvMeta(env: SuperAdminEnv): {
  id: "OLD" | "NEW";
  label: string;
  url: string;
  dbName: string;
} {
  const row = SERVERS.find((s) => s.id === env) ?? SERVERS[0]!;
  return {
    id: row.id === "old" ? "OLD" : "NEW",
    label: row.label,
    url: row.url,
    dbName: row.dbName,
  };
}

function useActivateLive() {
  const env = useSuperAdminEnvStore((s) => s.env);
  const setEnv = useSuperAdminEnvStore((s) => s.setEnv);
  const queryClient = useQueryClient();

  function activate(next: SuperAdminEnv): void {
    if (next === env) return;
    setEnv(next);
    void queryClient.invalidateQueries();
  }

  return { env, activate };
}

/** Compact header control: OLD / NEW with Active on the live one. */
export function SuperAdminEnvSwitch(): JSX.Element {
  const { env, activate } = useActivateLive();

  return (
    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/5">
      {SERVERS.map((opt) => {
        const active = env === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            title={`Make ${opt.label} Active for the whole system`}
            onClick={() => activate(opt.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {opt.label} · {active ? "Active" : "Inactive"}
          </button>
        );
      })}
    </div>
  );
}

/** Full Active / Inactive cards — Health page. One Active server for the whole app. */
export function SuperAdminEnvCards(): JSX.Element {
  const { env, activate } = useActivateLive();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SERVERS.map((opt) => {
        const active = env === opt.id;
        return (
          <div
            key={opt.id}
            className={`${saCardClass} ${
              active ? "ring-2 ring-teal-600 dark:ring-teal-400" : "opacity-90"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {opt.label} server
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{opt.url}</p>
                <p className={`mt-2 text-xs ${saMutedClass}`}>{opt.dbName}</p>
              </div>
              {active ? (
                <span className={saBadgeActiveClass}>Active</span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15">
                  Inactive
                </span>
              )}
            </div>
            <button
              type="button"
              className={`${saBtnGhostClass} mt-4 w-full`}
              disabled={active}
              onClick={() => activate(opt.id)}
            >
              {active ? "Active — whole system is here" : `Make ${opt.label} Active`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
