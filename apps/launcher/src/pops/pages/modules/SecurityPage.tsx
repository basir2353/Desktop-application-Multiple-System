import type { SecurityAuditEntry, SecurityDevice } from "@platform/contracts";
import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { exportAuditCsv, fetchSecurityOverview } from "../../api/security";
import { usePopsStore } from "../../../stores/popsStore";
import { accentValueClass, linkDangerClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

export function SecurityPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const [showDevices, setShowDevices] = useState(false);
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["security", "overview", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 60_000,
    queryFn: () => fetchSecurityOverview(branch!.code),
  });

  const filteredAudit = useMemo(() => {
    const rows = query.data?.auditTrail ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.user.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q),
    );
  }, [query.data?.auditTrail, search]);

  const metrics = query.data?.metrics;
  const devices = query.data?.devices ?? [];

  function handleExport(): void {
    if (!query.data?.auditTrail.length) return;
    const date = new Date().toISOString().slice(0, 10);
    exportAuditCsv(query.data.auditTrail, `pops-audit-${branch?.code ?? "all"}-${date}.csv`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Security & monitoring"
        subtitle="Audit trail, device posture, fraud signals, and login history."
        actions={
          <>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={!query.data?.auditTrail.length}
              onClick={handleExport}
            >
              Export audit
            </Button>
            <Button className="text-xs" onClick={() => setShowDevices((v) => !v)}>
              {showDevices ? "Hide devices" : "Device inventory"}
            </Button>
          </>
        }
      />

      {query.isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {(query.error as Error).message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Failed logins (24h)"
          value={query.isLoading ? "…" : String(metrics?.failedLogins24h ?? 0)}
          highlight={Boolean(metrics && metrics.failedLogins24h > 0)}
        />
        <MetricCard
          label="Active devices"
          value={query.isLoading ? "…" : String(metrics?.activeDevices ?? 0)}
        />
        <MetricCard
          label="Policy violations"
          value={query.isLoading ? "…" : String(metrics?.policyViolations ?? 0)}
          highlight={Boolean(metrics && metrics.policyViolations > 0)}
        />
      </div>

      {showDevices ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Device inventory</div>
          <p className="mt-1 text-xs text-slate-500">
            Active refresh-token sessions for users in this organization.
          </p>
          {devices.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No sessions recorded.</p>
          ) : (
            <SimpleTable<SecurityDevice>
              rowKey={(d) => d.id}
              columns={[
                { key: "userEmail", header: "User" },
                { key: "role", header: "Role" },
                {
                  key: "status",
                  header: "Status",
                  render: (d) => (
                    <Badge tone={d.status === "active" ? "success" : "neutral"}>{d.status}</Badge>
                  ),
                },
                {
                  key: "sessionStarted",
                  header: "Session started",
                  render: (d) => formatShortTime(d.sessionStarted),
                },
                {
                  key: "expiresAt",
                  header: "Expires",
                  render: (d) => formatShortTime(d.expiresAt),
                },
                {
                  key: "lastActivityAt",
                  header: "Last activity",
                  render: (d) => (d.lastActivityAt ? formatShortTime(d.lastActivityAt) : "—"),
                },
              ]}
              rows={devices}
            />
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="h-8 min-w-[12rem] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-amber-500/50 sm:max-w-xs"
          placeholder="Search user, action, module…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500">
          {filteredAudit.length} event{filteredAudit.length === 1 ? "" : "s"}
          {branch ? ` · ${branch.name}` : ""}
        </span>
      </div>

      {query.isLoading ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
          Loading audit trail…
        </div>
      ) : (
        <SimpleTable<SecurityAuditEntry>
          rowKey={(r) => r.id}
          columns={[
            { key: "time", header: "When" },
            { key: "user", header: "User" },
            {
              key: "action",
              header: "Action",
              render: (r) => (
                <span className={r.severity === "danger" ? linkDangerClass : undefined}>{r.action}</span>
              ),
            },
            { key: "detail", header: "Detail" },
            {
              key: "module",
              header: "Module",
              render: (r) => (
                <Badge
                  tone={r.severity === "danger" ? "danger" : r.severity === "warning" ? "warning" : "neutral"}
                >
                  {r.module}
                </Badge>
              ),
            },
          ]}
          rows={filteredAudit}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${highlight ? linkDangerClass : accentValueClass}`}>
        {value}
      </div>
    </div>
  );
}

function formatShortTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}
