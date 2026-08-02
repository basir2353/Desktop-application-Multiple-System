import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { instructionsRows, isoDateStamp, writeWorkbookDownload } from "../../../lib/excelTransfer";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchRestaurantReport, RESTAURANT_REPORTS } from "../../api/reports";
import { TimeAmPmInput } from "../../components/TimeAmPmInput";
import { formatPkr } from "../../hooks/useInventory";
import { fieldInputClass } from "../../lib/themeClasses";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { ModuleFilterBar } from "../../ui/ModuleToolbar";
import { CashReportPanel } from "./CashReportPanel";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function ReportsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const params = useParams<{ reportId?: string }>();
  const activeId = params.reportId ?? RESTAURANT_REPORTS[0]?.id ?? "sales-by-item";
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(todayIso);
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const categories = useMemo(
    () => ["All", ...new Set(RESTAURANT_REPORTS.map((r) => r.category))],
    [],
  );

  const visibleReports = useMemo(
    () =>
      categoryFilter === "All"
        ? RESTAURANT_REPORTS
        : RESTAURANT_REPORTS.filter((r) => r.category === categoryFilter),
    [categoryFilter],
  );

  const activeMeta = RESTAURANT_REPORTS.find((r) => r.id === activeId) ?? RESTAURANT_REPORTS[0];

  const reportQuery = useQuery({
    queryKey: ["reports", branch?.code, activeId, from, to, fromTime, toTime],
    enabled: Boolean(branch?.code && activeId),
    queryFn: () =>
      fetchRestaurantReport(branch!.code, activeId, { from, to, fromTime, toTime }),
  });

  function exportActive(): void {
    const data = reportQuery.data;
    if (!data) return;
    writeWorkbookDownload(
      [
        {
          name: "Instructions",
          rows: instructionsRows([
            `${data.title} exported from POPS restaurant reports.`,
            `Range: ${data.from ?? ""} ${fromTime} → ${data.to ?? ""} ${toTime}`,
          ]),
        },
        {
          name: "Report",
          rows: data.rows.map((r) => ({
            Label: r.label,
            Qty: r.qty ?? "",
            Amount: r.amount ?? "",
            Debit: r.debit ?? "",
            Credit: r.credit ?? "",
            Balance: r.balance ?? "",
            Meta: r.meta ?? "",
          })),
        },
      ],
      `${data.reportId}-${isoDateStamp()}.xlsx`,
    );
  }

  function exportIndex(): void {
    writeWorkbookDownload(
      [
        {
          name: "Reports",
          rows: RESTAURANT_REPORTS.map((r) => ({
            Report: r.name,
            Category: r.category,
            Path: `/pops/reports/${r.id}`,
          })),
        },
      ],
      `restaurant-reports-index-${isoDateStamp()}.xlsx`,
    );
  }

  const rows = reportQuery.data?.rows ?? [];
  const isCashReport = activeId === "cash-report";

  const moneyTotalKeys = new Set([
    "amount",
    "value",
    "discount",
    "variance",
    "counted",
    "outstanding",
    "payments",
    "delivery",
    "serviceCharges",
    "deliveryCharges",
    "tax16",
    "tax8",
    "taxOther",
    "canceledOrders",
    "cashReceived",
    "remainingCash",
    "cardReceived",
    "walletReceived",
    "bankReceived",
    "salary",
    "advances",
    "remaining",
    "sales",
    "debit",
    "credit",
    "balance",
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & analytics"
        subtitle="Sales, cash, kitchen, vendors, and inventory — filter by date/time and export."
        actions={
          <>
            <Button variant="ghost" className="text-xs" onClick={exportIndex}>
              Export index
            </Button>
            <Button
              className="text-xs"
              disabled={!reportQuery.data || rows.length === 0}
              onClick={exportActive}
            >
              Export Excel
            </Button>
          </>
        }
      />

      <ModuleFilterBar>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From</span>
          <input className={fieldInputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <div className="flex min-w-[8rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From time</span>
          <TimeAmPmInput
            value={fromTime}
            onChange={setFromTime}
            aria-label="From time"
          />
        </div>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To</span>
          <input className={fieldInputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex min-w-[8rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To time</span>
          <TimeAmPmInput
            value={toTime}
            onChange={setToTime}
            aria-label="To time"
          />
        </div>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Category</span>
          <select
            className={fieldInputClass}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </ModuleFilterBar>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40 lg:col-span-1">
          <div className="text-xs font-semibold uppercase text-slate-500">Report</div>
          <ul className="mt-2 max-h-[28rem] space-y-0.5 overflow-y-auto">
            {visibleReports.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/pops/reports/${r.id}`}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm transition ${
                    r.id === activeId
                      ? "bg-emerald-600/20 font-medium text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
            <Link
              to="/pops/reports/kitchen-cancellations"
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Kitchen cancellations (detail) →
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {reportQuery.data?.title ?? activeMeta?.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {activeMeta?.category}
                {reportQuery.data?.from && reportQuery.data?.to
                  ? ` · ${reportQuery.data.from} ${fromTime} → ${reportQuery.data.to} ${toTime}`
                  : null}
              </p>
            </div>
            {reportQuery.data?.totals && !isCashReport ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(reportQuery.data.totals).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-700"
                  >
                    <span className="uppercase text-slate-500">{k}</span>{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {moneyTotalKeys.has(k) || k.includes("amount") || k.includes("value")
                        ? formatPkr(v)
                        : v.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {reportQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Generating report…</p>
          ) : reportQuery.isError ? (
            <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {(reportQuery.error as Error).message}
            </p>
          ) : isCashReport && reportQuery.data && branch?.code ? (
            <div className="mt-4">
              <CashReportPanel
                report={reportQuery.data}
                branchCode={branch.code}
                from={from}
                to={to}
                fromTime={fromTime}
                toTime={toTime}
              />
            </div>
          ) : rows.length === 0 || reportQuery.data?.empty ? (
            <div className="mt-6 space-y-2 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
              <p>
                No data for this report in the selected range. New companies stay empty until sales, cash
                sessions, or expenses are recorded.
              </p>
              {activeId === "customer-ledger" ? (
                <p className="text-xs text-slate-400">
                  Customer ledger uses credit invoices from{" "}
                  <Link to="/pops/accounting/receivable" className="text-emerald-600 hover:underline dark:text-emerald-400">
                    Accounting → Receivable
                  </Link>
                  . Add a customer invoice there, then reopen this report.
                </p>
              ) : null}
              {activeId === "employee-ledger" ? (
                <p className="text-xs text-slate-400">
                  Employees ledger needs staff on this branch — add them under{" "}
                  <Link to="/pops/hr/employees" className="text-emerald-600 hover:underline dark:text-emerald-400">
                    HR → Employees
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <SimpleTable
                rowKey={(r) => `${String(r.label)}-${String(r.meta ?? "")}-${String(r.amount ?? "")}-${String(r.qty ?? "")}`}
                columns={[
                  { key: "label", header: "Item" },
                  {
                    key: "qty",
                    header: "Qty",
                    render: (r) => (r.qty != null ? Number(r.qty).toLocaleString() : "—"),
                  },
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
                  {
                    key: "meta",
                    header: "Details",
                    render: (r) => (r.meta ? String(r.meta) : "—"),
                  },
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
