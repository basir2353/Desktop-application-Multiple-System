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
import { exportBusinessesCsv, resolvePraFlags } from "./superAdminHelpers";
import {
  saBtnGhostClass,
  saBtnPrimaryClass,
  saCardClass,
  saHeadingClass,
  saLinkClass,
  saWarnLinkClass,
  saMutedClass,
  saPageSubClass,
  saPageTitleClass,
  saStatClass,
  saWarnPanelClass,
} from "./superAdminTheme";

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
    const flags = list.map((b) => ({ fbr: Boolean(b.fbrEnabled), ...resolvePraFlags(b) }));
    return {
      fbr: flags.filter((b) => b.fbr).length,
      praFake: flags.filter((b) => b.praFakeEnabled).length,
      praReal: flags.filter((b) => b.praRealEnabled).length,
      praBoth: flags.filter((b) => b.praFakeEnabled && b.praRealEnabled).length,
      neither: flags.filter((b) => !b.fbr && !b.praEnabled).length,
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
    return <p className={saMutedClass}>Loading analytics…</p>;
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
            <h2 className={saPageTitleClass}>Platform overview</h2>
            <p className={saPageSubClass}>Live counts across every installed client system.</p>
          </div>
          <button
            type="button"
            className={saBtnGhostClass}
            disabled={!businesses.data?.length}
            onClick={() => {
              if (businesses.data?.length) exportBusinessesCsv(businesses.data);
            }}
          >
            Export CSV
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className={saCardClass}>
        <h2 className={saHeadingClass}>Tax summary</h2>
        <p className={`mt-1 text-sm ${saMutedClass}`}>FBR / FPRA / Real PRA across all businesses.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="FBR on" value={taxCounts.fbr} />
          <Stat label="FPRA on" value={taxCounts.praFake} />
          <Stat label="Real PRA on" value={taxCounts.praReal} />
          <Stat label="Both PRA" value={taxCounts.praBoth} />
          <Stat label="Neither" value={taxCounts.neither} />
        </div>
        <Link to="/super-admin/tax" className={`mt-4 inline-block text-xs ${saLinkClass}`}>
          Open tax map →
        </Link>
      </section>

      <section className={saCardClass}>
        <h2 className={saHeadingClass}>Quick actions</h2>
        <p className={`mt-1 text-sm ${saMutedClass}`}>
          Suspend, activate, grant 5 days, or jump to detail for one business.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className={`mb-1 block text-xs ${saMutedClass}`}>Business</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
          <button
            type="button"
            className={saBtnPrimaryClass}
            disabled={busy}
            onClick={() => {
              const b = requireSelected();
              if (!b) return;
              if (!window.confirm(`Activate “${b.name}”?`)) return;
              statusMut.mutate({ id: b.id, status: "active" });
            }}
          >
            Activate
          </button>
          <button
            type="button"
            className={saBtnPrimaryClass}
            disabled={busy}
            onClick={() => {
              const b = requireSelected();
              if (!b) return;
              if (!window.confirm(`Grant 5 licence days to “${b.name}”?`)) return;
              grantMut.mutate(b.id);
            }}
          >
            Grant 5 days
          </button>
          <button
            type="button"
            className={saBtnGhostClass}
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) navigate(`/super-admin/businesses/${selectedId}`);
            }}
          >
            Open detail
          </button>
        </div>
        {actionMsg ? (
          <p
            className={`mt-3 text-sm ${
              /fail|error|Select/i.test(actionMsg) ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {actionMsg}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className={saPageTitleClass}>By system type</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.bySystemType.map((row) => (
            <div key={row.systemType} className={saStatClass}>
              <p className={`text-sm ${saMutedClass}`}>{SYSTEM_TYPE_LABELS[row.systemType]}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{row.count}</p>
            </div>
          ))}
        </div>
      </section>

      {data.licenceAlerts.length > 0 ? (
        <section>
          <h2 className={saPageTitleClass}>Licence alerts</h2>
          <p className={saPageSubClass}>Expired or expiring within 30 days.</p>
          <ul className={`mt-4 divide-y divide-amber-200/80 overflow-hidden dark:divide-amber-500/20 ${saWarnPanelClass} !p-0`}>
            {data.licenceAlerts.map((b) => {
              const expired =
                b.licenceExpiresAt && new Date(b.licenceExpiresAt).getTime() < Date.now();
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link to={`/super-admin/businesses/${b.id}`} className={saWarnLinkClass}>
                      {b.name}
                    </Link>
                    <p className={`text-sm ${saMutedClass}`}>
                      {SYSTEM_TYPE_LABELS[b.systemType]} · {b.licencePlan ?? "—"} ·{" "}
                      {expired ? "Expired" : "Expiring"}{" "}
                      {b.licenceExpiresAt ? new Date(b.licenceExpiresAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <Link to="/super-admin/licences" className={`text-xs font-semibold ${saWarnLinkClass}`}>
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
          <h2 className={saPageTitleClass}>Recent businesses</h2>
          <Link to="/super-admin/businesses" className={`text-xs ${saLinkClass}`}>
            View all
          </Link>
        </div>
        <ul className={`mt-4 divide-y divide-slate-100 overflow-hidden ${saCardClass} !p-0`}>
          {data.recentBusinesses.length === 0 ? (
            <li className={`px-4 py-6 text-sm ${saMutedClass}`}>No businesses yet.</li>
          ) : (
            data.recentBusinesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link to={`/super-admin/businesses/${b.id}`} className={saLinkClass}>
                    {b.name}
                  </Link>
                  <p className={`text-sm ${saMutedClass}`}>
                    {SYSTEM_TYPE_LABELS[b.systemType]} · {b.status}
                  </p>
                </div>
                <p className={`text-xs ${saMutedClass}`}>{new Date(b.createdAt).toLocaleDateString()}</p>
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
    <div className={warn ? "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-500/30 dark:bg-amber-500/10" : saStatClass}>
      <p className={`text-xs font-medium uppercase tracking-wide ${saMutedClass}`}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
