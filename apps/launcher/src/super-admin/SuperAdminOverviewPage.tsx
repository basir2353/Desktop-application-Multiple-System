import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS, type Business } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchPlatformAnalytics,
  fetchPlatformBusinesses,
  grantPlatformLicence,
  updatePlatformBusiness,
} from "../lib/platformApi";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";
import { exportBusinessesCsv } from "./superAdminHelpers";

export function SuperAdminOverviewPage(): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["platform", "analytics"],
    queryFn: fetchPlatformAnalytics,
  });
  const businesses = useQuery({
    queryKey: ["platform", "businesses"],
    queryFn: fetchPlatformBusinesses,
  });

  const [selectedId, setSelectedId] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const selected = useMemo(
    () => (businesses.data ?? []).find((b) => b.id === selectedId) ?? null,
    [businesses.data, selectedId],
  );

  const taxCounts = useMemo(() => {
    const list = businesses.data ?? [];
    return {
      fbr: list.filter((b) => b.fbrEnabled).length,
      pra: list.filter((b) => b.praEnabled).length,
      both: list.filter((b) => b.fbrEnabled && b.praEnabled).length,
      neither: list.filter((b) => !b.fbrEnabled && !b.praEnabled).length,
    };
  }, [businesses.data]);

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) =>
      updatePlatformBusiness(id, { status }),
    onSuccess: async (saved) => {
      setActionMsg(`${saved.name} is now ${saved.status}.`);
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (err) => setActionMsg(err instanceof Error ? err.message : "Status update failed"),
  });

  const grantMut = useMutation({
    mutationFn: (id: string) =>
      grantPlatformLicence(id, {
        days: 5,
        recordPayment: false,
        note: "Quick +5 days from Overview",
      }),
    onSuccess: async (saved) => {
      setActionMsg(`Granted 5 days to ${saved.name}.`);
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (err) => setActionMsg(err instanceof Error ? err.message : "Grant failed"),
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
  const busy = statusMut.isPending || grantMut.isPending;

  function requireSelected(): Business | null {
    if (!selected) {
      setActionMsg("Select a business first.");
      return null;
    }
    return selected;
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`text-lg font-semibold ${headingClass}`}>Cross-business overview</h2>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              Live counts across every installed client system.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={!businesses.data?.length}
            onClick={() => {
              if (businesses.data?.length) exportBusinessesCsv(businesses.data);
            }}
          >
            Export businesses CSV
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total businesses" value={data.totalBusinesses} />
          <Stat label="Active" value={data.activeBusinesses} />
          <Stat label="Suspended" value={data.suspendedBusinesses} />
          <Stat label="Inactive" value={data.inactiveBusinesses} />
          <Stat label="Users" value={data.totalUsers} />
          <Stat label="Expired licences" value={data.expiredLicences} warn={data.expiredLicences > 0} />
          <Stat
            label="Expiring in 30 days"
            value={data.expiringSoonLicences}
            warn={data.expiringSoonLicences > 0}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className={`text-base font-semibold ${headingClass}`}>Tax summary</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>FBR / PRA flags across all businesses.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="FBR on" value={taxCounts.fbr} />
          <Stat label="PRA on" value={taxCounts.pra} />
          <Stat label="Both on" value={taxCounts.both} />
          <Stat label="Neither" value={taxCounts.neither} />
        </div>
        <Link
          to="/super-admin/tax"
          className="mt-3 inline-block text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          Open tax map →
        </Link>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <h2 className={`text-base font-semibold ${headingClass}`}>Quick actions</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Suspend, activate, grant 5 days, or jump to detail for one business.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block text-xs text-slate-500">Business</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setActionMsg(null);
              }}
            >
              <option value="">Select…</option>
              {(businesses.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.status})
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              const b = requireSelected();
              if (!b) return;
              if (!window.confirm(`Suspend “${b.name}”?`)) return;
              statusMut.mutate({ id: b.id, status: "suspended" });
            }}
          >
            Suspend
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              const b = requireSelected();
              if (!b) return;
              if (!window.confirm(`Activate “${b.name}”?`)) return;
              statusMut.mutate({ id: b.id, status: "active" });
            }}
          >
            Activate
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              const b = requireSelected();
              if (!b) return;
              if (!window.confirm(`Grant 5 licence days to “${b.name}”?`)) return;
              grantMut.mutate(b.id);
            }}
          >
            Grant 5 days
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) navigate(`/super-admin/businesses/${selectedId}`);
            }}
          >
            Open detail
          </Button>
        </div>
        {actionMsg ? (
          <p
            className={`mt-3 text-sm ${
              /fail|error|Select/i.test(actionMsg)
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {actionMsg}
          </p>
        ) : null}
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

      {data.licenceAlerts.length > 0 ? (
        <section>
          <h2 className={`text-lg font-semibold ${headingClass}`}>Licence alerts</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>Expired or expiring within 30 days.</p>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-amber-200 bg-amber-50/60 dark:divide-slate-800 dark:border-amber-900/50 dark:bg-amber-950/20">
            {data.licenceAlerts.map((b) => {
              const expired =
                b.licenceExpiresAt && new Date(b.licenceExpiresAt).getTime() < Date.now();
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link
                      to={`/super-admin/businesses/${b.id}`}
                      className="font-medium text-amber-800 hover:underline dark:text-amber-300"
                    >
                      {b.name}
                    </Link>
                    <p className={`text-sm ${mutedClass}`}>
                      {SYSTEM_TYPE_LABELS[b.systemType]} · {b.licencePlan ?? "—"} ·{" "}
                      {expired ? "Expired" : "Expiring"}{" "}
                      {b.licenceExpiresAt
                        ? new Date(b.licenceExpiresAt).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  <Link
                    to="/super-admin/licences"
                    className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                  >
                    Manage
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className={`text-lg font-semibold ${headingClass}`}>Recent businesses</h2>
          <Link
            to="/super-admin/businesses"
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            View all
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60">
          {data.recentBusinesses.length === 0 ? (
            <li className={`px-4 py-6 text-sm ${mutedClass}`}>No businesses yet.</li>
          ) : (
            data.recentBusinesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    to={`/super-admin/businesses/${b.id}`}
                    className="font-medium text-amber-700 hover:underline dark:text-amber-400"
                  >
                    {b.name}
                  </Link>
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

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}): JSX.Element {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn
          ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
      }`}
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
