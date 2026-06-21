import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchConsolidatedReport } from "../../../api/multi-branch";
import { formatPkr } from "../../../hooks/useMultiBranch";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { MbError, MbLoading } from "./MultiBranchUi";

export function ConsolidatedReportsPage(): JSX.Element {
  const reportQuery = useQuery({
    queryKey: ["multi-branch", "report"],
    queryFn: fetchConsolidatedReport,
  });

  if (reportQuery.isLoading) return <MbLoading />;
  if (reportQuery.isError) return <MbError message={(reportQuery.error as Error).message} />;

  const report = reportQuery.data!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Consolidated report"
        subtitle={`Network-wide sales summary — ${report.periodLabel}. Data from billing across all branches.`}
        actions={
          <Link to="/pops/multi-branch" className="text-xs text-slate-400 hover:text-white">
            ← Overview
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Total network sales</div>
          <div className="mt-1 text-2xl font-semibold text-white">{formatPkr(report.totals.salesPkr)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Total orders</div>
          <div className="mt-1 text-2xl font-semibold text-white">{report.totals.orderCount.toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.branchCode)}
          rows={report.branches as unknown as Record<string, unknown>[]}
          columns={[
            { key: "branchCode", header: "Branch" },
            { key: "branchName", header: "Name" },
            { key: "salesPkr", header: "Sales", render: (r) => formatPkr(Number(r.salesPkr)) },
            { key: "orderCount", header: "Orders" },
            { key: "avgTicketPkr", header: "Avg ticket", render: (r) => formatPkr(Number(r.avgTicketPkr)) },
            { key: "activeStaff", header: "Active staff" },
          ]}
        />
      </div>

      <p className="text-xs text-slate-500">
        Drill down per branch via{" "}
        <Link to="/pops/accounting/reports" className="text-amber-400/90 hover:text-amber-300">
          Accounting → Reports
        </Link>
        .
      </p>
    </div>
  );
}
