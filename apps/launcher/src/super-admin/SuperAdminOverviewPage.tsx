import { useQuery } from "@tanstack/react-query";
import { SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { fetchPlatformAnalytics } from "../lib/platformApi";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";

export function SuperAdminOverviewPage(): JSX.Element {
  const query = useQuery({
    queryKey: ["platform", "analytics"],
    queryFn: fetchPlatformAnalytics,
  });

  if (query.isLoading) {
    return <p className={mutedClass}>Loading analytics…</p>;
  }
  if (query.error) {
    return (
      <p className="text-sm text-red-600">
        {query.error instanceof Error ? query.error.message : "Failed to load analytics"}
      </p>
    );
  }

  const data = query.data!;

  return (
    <div className="space-y-8">
      <section>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Cross-business overview</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Live counts across every installed client system.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total businesses" value={data.totalBusinesses} />
          <Stat label="Active" value={data.activeBusinesses} />
          <Stat label="Suspended" value={data.suspendedBusinesses} />
          <Stat label="Users" value={data.totalUsers} />
        </div>
      </section>

      <section>
        <h2 className={`text-lg font-semibold ${headingClass}`}>By system type</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.bySystemType.map((row) => (
            <div
              key={row.systemType}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {SYSTEM_TYPE_LABELS[row.systemType]}
              </p>
              <p className="mt-1 text-2xl font-semibold">{row.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Recent businesses</h2>
        <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60">
          {data.recentBusinesses.length === 0 ? (
            <li className={`px-4 py-6 text-sm ${mutedClass}`}>No businesses yet.</li>
          ) : (
            data.recentBusinesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className={`text-sm ${mutedClass}`}>
                    {SYSTEM_TYPE_LABELS[b.systemType]} · {b.status}
                  </p>
                </div>
                <p className={`text-xs ${mutedClass}`}>{new Date(b.createdAt).toLocaleDateString()}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
