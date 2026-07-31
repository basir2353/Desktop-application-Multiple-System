import type { PraInvoiceMode } from "@platform/contracts";
import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPraActivityLogs,
  fetchPraDashboard,
  retryFailedPraInvoices,
} from "../../lib/taxAuthorityApi";
import { useSessionStore } from "../../stores/sessionStore";
import { mutedClass, panelClass } from "../lib/themeClasses";
import { Badge } from "../ui/Badge";
import { SimpleTable } from "../ui/SimpleTable";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatPkr(n: number): string {
  return `Rs ${Number(n || 0).toLocaleString()}`;
}

export function PraTodayDashboard(props: {
  branchCode: string;
  mode: PraInvoiceMode;
  showActivityLogs?: boolean;
  showRetry?: boolean;
  onMessage?: (msg: string | null) => void;
  onError?: (msg: string | null) => void;
}): JSX.Element {
  const {
    branchCode,
    mode,
    showActivityLogs = mode === "real",
    showRetry = mode === "real",
    onMessage,
    onError,
  } = props;
  const qc = useQueryClient();
  const organizationId = useSessionStore((s) => s.claims?.organizationId);

  const dashQuery = useQuery({
    queryKey: ["tax-authority", "pra-dashboard", organizationId, branchCode, mode],
    enabled: Boolean(organizationId && branchCode),
    queryFn: () => fetchPraDashboard(branchCode, mode),
    refetchInterval: 30_000,
  });

  const logsQuery = useQuery({
    queryKey: ["tax-authority", "pra-logs", organizationId, branchCode],
    enabled: showActivityLogs && Boolean(organizationId && branchCode),
    queryFn: () => fetchPraActivityLogs(branchCode, 40),
    refetchInterval: 30_000,
  });

  const retryMut = useMutation({
    mutationFn: () => retryFailedPraInvoices(branchCode),
    onSuccess: async (res) => {
      onError?.(null);
      onMessage?.(res.message);
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      onMessage?.(null);
      onError?.(err instanceof Error ? err.message : "Retry failed");
    },
  });

  const dash = dashQuery.data;
  const logs = logsQuery.data ?? [];

  return (
    <section className={`${panelClass} space-y-4 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {mode === "fake" ? "FPRA Dashboard" : "Real PRA Dashboard"}
          </h3>
          <p className={`mt-1 text-sm ${mutedClass}`}>Today&apos;s activity for this branch.</p>
        </div>
        {showRetry ? (
          <Button
            type="button"
            disabled={retryMut.isPending}
            onClick={() => retryMut.mutate()}
          >
            {retryMut.isPending ? "Retrying…" : "Retry Failed Invoices"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card label="Today Submitted" value={dash?.todaySubmitted} />
        <Card label="Today Failed" value={dash?.todayFailed} />
        <Card label="Pending Queue" value={dash?.pendingQueue} />
        <Card
          label="Today Taxable"
          value={dash ? formatPkr(dash.todayTaxableTotalPkr) : undefined}
        />
        <Card label="Today Tax" value={dash ? formatPkr(dash.todayTaxTotalPkr) : undefined} />
        <Card label="Last Sync" value={formatWhen(dash?.lastSyncAt)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone={mode === "fake" ? "success" : "neutral"}>
          {mode === "fake" ? "FPRA mode" : "Real mode"}
        </Badge>
        {dash?.connectionStatus ? (
          <Badge tone={dash.connectionStatus === "connected" ? "success" : "warning"}>
            {dash.connectionStatus}
          </Badge>
        ) : null}
      </div>
      {dash?.lastError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{dash.lastError}</p>
      ) : null}
      {dashQuery.isLoading ? <p className={`text-sm ${mutedClass}`}>Loading dashboard…</p> : null}

      {showActivityLogs ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            Activity Logs
          </h4>
          <SimpleTable
            rowKey={(r) => String(r.id)}
            columns={[
              {
                key: "createdAt",
                header: "When",
                render: (r) => formatWhen(String(r.createdAt)),
              },
              { key: "event", header: "Event" },
              {
                key: "invoiceNumber",
                header: "Invoice",
                render: (r) => String(r.invoiceNumber ?? "—"),
              },
              {
                key: "praInvoiceNumber",
                header: "PRA #",
                render: (r) => String(r.praInvoiceNumber ?? "—"),
              },
              { key: "status", header: "Status" },
              {
                key: "errorMessage",
                header: "Error",
                render: (r) => String(r.errorMessage ?? "—"),
              },
            ]}
            rows={logs as unknown as Record<string, unknown>[]}
          />
          {!logsQuery.isLoading && logs.length === 0 ? (
            <p className={`mt-2 text-sm ${mutedClass}`}>No activity yet.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Card({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className={`text-xs ${mutedClass}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold">{value ?? "—"}</p>
    </div>
  );
}
