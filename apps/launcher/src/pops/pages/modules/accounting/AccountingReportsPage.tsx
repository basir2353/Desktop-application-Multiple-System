import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountingReport } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading } from "./AccountingUi";

const REPORTS = [
  { id: "profit-loss", label: "Profit & Loss" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "cash-flow", label: "Cash Flow" },
  { id: "trial-balance", label: "Trial Balance" },
  { id: "general-ledger", label: "General Ledger" },
];

export function AccountingReportsPage(): JSX.Element {
  const { branch } = useAccountingAccess();
  const [reportId, setReportId] = useState("profit-loss");

  const reportQuery = useQuery({
    queryKey: ["accounting", "report", branch?.code, reportId],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccountingReport(branch!.code, reportId),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Financial reports" subtitle="P&L, balance sheet, cash flow, trial balance, and general ledger." />

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReportId(r.id)}
            className={`rounded-md px-3 py-2 text-xs font-medium transition ${
              reportId === r.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {reportQuery.isLoading ? <AccountingLoading label="Generating report…" /> : null}
      {reportQuery.isError ? <AccountingError message={(reportQuery.error as Error).message} /> : null}

      {reportQuery.data ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">{reportQuery.data.title}</div>
            <div className="text-xs text-slate-500">
              Generated {new Date(reportQuery.data.generatedAt).toLocaleString()}
            </div>
          </div>
          <SimpleTable
            rowKey={(r) => `${String(r.label)}-${String(r.amount ?? r.debit ?? r.credit ?? "")}`}
            columns={[
              { key: "label", header: "Item" },
              {
                key: "amount",
                header: "Amount",
                render: (r) => (r.amount != null ? formatPkr(Number(r.amount)) : "—"),
              },
              {
                key: "debit",
                header: "Debit",
                render: (r) => (r.debit != null ? formatPkr(Number(r.debit)) : "—"),
              },
              {
                key: "credit",
                header: "Credit",
                render: (r) => (r.credit != null ? formatPkr(Number(r.credit)) : "—"),
              },
              {
                key: "balance",
                header: "Balance",
                render: (r) => (r.balance != null ? formatPkr(Number(r.balance)) : "—"),
              },
            ]}
            rows={reportQuery.data.rows as unknown as Record<string, unknown>[]}
          />
        </div>
      ) : null}
    </div>
  );
}
