import type { PraInvoiceMode, PraReportPeriod } from "@platform/contracts";
import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchPraReports } from "../../lib/taxAuthorityApi";
import { useSessionStore } from "../../stores/sessionStore";
import { fieldInputClass, fieldSelectClass, mutedClass, panelClass } from "../lib/themeClasses";
import { SimpleTable } from "../ui/SimpleTable";

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultRange(period: PraReportPeriod): { from: string; to: string } {
  const now = new Date();
  const to = toDateInput(now);
  const from = new Date(now);
  if (period === "daily") from.setDate(from.getDate() - 13);
  else if (period === "weekly") from.setDate(from.getDate() - 7 * 11);
  else if (period === "monthly") from.setMonth(from.getMonth() - 11);
  else from.setFullYear(from.getFullYear() - 4);
  return { from: toDateInput(from), to };
}

function formatPkr(n: number): string {
  return `Rs ${Number(n || 0).toLocaleString()}`;
}

export function PraPeriodReportsPanel(props: {
  branchCode: string;
  mode: PraInvoiceMode;
  title?: string;
}): JSX.Element {
  const { branchCode, mode, title } = props;
  const organizationId = useSessionStore((s) => s.claims?.organizationId);
  const [period, setPeriod] = useState<PraReportPeriod>("daily");
  const defaults = useMemo(() => defaultRange(period), [period]);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [status, setStatus] = useState("all");

  // Reset range when period chip changes.
  const onPeriod = (next: PraReportPeriod) => {
    setPeriod(next);
    const r = defaultRange(next);
    setFrom(r.from);
    setTo(r.to);
  };

  const query = useQuery({
    queryKey: [
      "tax-authority",
      "pra-reports",
      organizationId,
      branchCode,
      mode,
      period,
      from,
      to,
      status,
    ],
    enabled: Boolean(organizationId && branchCode),
    queryFn: () =>
      fetchPraReports({
        branchCode,
        mode,
        period,
        from,
        to,
        status,
      }),
  });

  const summary = query.data?.summary;
  const buckets = query.data?.buckets ?? [];

  function exportCsv(): void {
    const header = [
      "period",
      "invoices",
      "submitted",
      "failed",
      "pending",
      "taxable_pkr",
      "tax_pkr",
    ];
    const lines = [
      header.join(","),
      ...buckets.map((b) =>
        [
          b.key,
          b.invoiceCount,
          b.submittedCount,
          b.failedCount,
          b.pendingCount,
          b.taxableTotalPkr,
          b.taxTotalPkr,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pra-${mode}-${period}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`${panelClass} space-y-4 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title ?? (mode === "fake" ? "FPRA Reports" : "Real PRA Reports")}
          </h3>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Daily, weekly, monthly, and yearly totals for this branch.
          </p>
        </div>
        <Button type="button" disabled={buckets.length === 0} onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["daily", "Daily"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
            ["yearly", "Yearly"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onPeriod(id)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              period === id
                ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">From</span>
          <input
            type="date"
            className={fieldInputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">To</span>
          <input
            type="date"
            className={fieldInputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">Status</span>
          <select
            className={fieldSelectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Invoices" value={summary?.invoiceCount} />
        <Stat label="Submitted" value={summary?.submittedCount} />
        <Stat label="Failed" value={summary?.failedCount} />
        <Stat label="Taxable" value={summary ? formatPkr(summary.taxableTotalPkr) : undefined} />
        <Stat label="Tax" value={summary ? formatPkr(summary.taxTotalPkr) : undefined} />
      </div>

      {query.isLoading ? <p className={`text-sm ${mutedClass}`}>Loading report…</p> : null}
      {query.isError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {query.error instanceof Error ? query.error.message : "Could not load report"}
        </p>
      ) : null}

      <SimpleTable
        rowKey={(r) => String(r.key)}
        columns={[
          { key: "key", header: "Period" },
          {
            key: "invoiceCount",
            header: "Invoices",
            render: (r) => String(r.invoiceCount),
          },
          {
            key: "submittedCount",
            header: "Submitted",
            render: (r) => String(r.submittedCount),
          },
          {
            key: "failedCount",
            header: "Failed",
            render: (r) => String(r.failedCount),
          },
          {
            key: "pendingCount",
            header: "Pending",
            render: (r) => String(r.pendingCount),
          },
          {
            key: "taxableTotalPkr",
            header: "Taxable",
            render: (r) => formatPkr(Number(r.taxableTotalPkr)),
          },
          {
            key: "taxTotalPkr",
            header: "Tax",
            render: (r) => formatPkr(Number(r.taxTotalPkr)),
          },
        ]}
        rows={buckets as unknown as Record<string, unknown>[]}
      />
      {!query.isLoading && buckets.length === 0 ? (
        <p className={`text-sm ${mutedClass}`}>No invoices in this range.</p>
      ) : null}
    </section>
  );
}

function Stat({
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
