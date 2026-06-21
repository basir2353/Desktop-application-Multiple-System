import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountingDashboard } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading, StatCard } from "./AccountingUi";
import { AccountingFlowBanner } from "./AccountingFlowBanner";

export function AccountingDashboardPage(): JSX.Element {
  const { branch } = useAccountingAccess();

  const dashboardQuery = useQuery({
    queryKey: ["accounting", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchAccountingDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) return <AccountingLoading label="Loading financial dashboard…" />;
  if (dashboardQuery.isError) {
    return <AccountingError message={(dashboardQuery.error as Error).message} />;
  }

  const m = dashboardQuery.data!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting dashboard"
        subtitle="Financial overview — sales, expenses, cash flow, and profit."
        actions={
          <>
            <Link to="/pops/accounting/expenses" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Add expense
            </Link>
            <Link to="/pops/accounting/journal" className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500">
              Journal entry
            </Link>
          </>
        }
      />

      <AccountingFlowBanner />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's sales" value={formatPkr(m.todaySales)} />
        <StatCard label="Weekly sales" value={formatPkr(m.weeklySales)} />
        <StatCard label="Monthly revenue" value={formatPkr(m.monthlyRevenue)} />
        <StatCard label="Total expenses" value={formatPkr(m.totalExpenses)} hint="This month" />
        <StatCard label="Profit / loss" value={formatPkr(m.profitLoss)} hint="This month" />
        <StatCard label="Outstanding receivable" value={formatPkr(m.outstandingReceivable)} />
        <StatCard label="Outstanding payable" value={formatPkr(m.outstandingPayable)} />
        <StatCard label="Cash in hand" value={formatPkr(m.cashInHand)} />
        <StatCard label="Bank balance" value={formatPkr(m.bankBalance)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Top expense categories</div>
          {m.topExpenseCategories.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No approved expenses this month.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {m.topExpenseCategories.map((c) => (
                <li key={c.category} className="flex justify-between text-sm">
                  <span className="text-slate-300">{c.category}</span>
                  <span className="text-white">{formatPkr(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Quick links</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { to: "/pops/accounting/sales", label: "Sales" },
              { to: "/pops/accounting/expenses", label: "Expenses" },
              { to: "/pops/accounting/payable", label: "Payables" },
              { to: "/pops/accounting/receivable", label: "Receivable" },
              { to: "/pops/accounting/reports", label: "Reports" },
              { to: "/pops/accounting/accounts", label: "Chart of accounts" },
            ].map((link) => (
              <Link key={link.to} to={link.to} className="rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-200">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="text-sm font-medium text-white">Recent journal entries</div>
        <SimpleTable
          rowKey={(r) => String(r.entryRef)}
          columns={[
            { key: "entryRef", header: "Ref" },
            { key: "entryDate", header: "Date" },
            { key: "source", header: "Source" },
            { key: "description", header: "Description" },
          ]}
          rows={m.recentEntries as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
