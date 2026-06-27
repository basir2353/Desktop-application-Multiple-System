import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchPharmacyExpiredProducts,
  fetchPharmacyProfitLoss,
  fetchPharmacyPurchaseStatement,
  fetchPharmacySales,
  fetchPharmacySalesOfMonth,
  fetchPharmacySalesStatement,
  fetchPharmacySupplierPayments,
} from "../api/pharmacy";
import { formatPkr, usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyField, PharmacyInput, PharmacyStatCard } from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { printPharmacyInvoice } from "../lib/printPharmacyInvoice";
import type { PharmacySale } from "@platform/contracts";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import { Badge } from "../../pops/ui/Badge";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function nowLocal(): string {
  return toDatetimeLocalValue(new Date());
}

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayDate(): string {
  return toDateInputValue(new Date());
}

function expiredDefaultFrom(): string {
  return "2000-01-01";
}

function endOfMonthDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return toDateInputValue(d);
}

function in30DaysDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return toDateInputValue(d);
}

export function PharmacyPurchaseStatementPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "purchase-statement", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPurchaseStatement(branch!.code),
  });
  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <PageHeader title="Purchase statement" subtitle="All purchase orders and receiving status." />
      <SimpleTable
        rowKey={(r) => r.poNumber}
        columns={[
          { key: "poNumber", header: "PO #" },
          { key: "supplierName", header: "Supplier" },
          { key: "status", header: "Status" },
          { key: "totalAmount", header: "Amount", render: (r) => formatPkr(r.totalAmount) },
          { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacySupplierPaymentsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "supplier-payments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySupplierPayments(branch!.code),
  });
  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <PageHeader title="Supplier payments" subtitle="Outstanding balances and payment terms per supplier." />
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Supplier" },
          { key: "paymentTerms", header: "Terms", render: (r) => r.paymentTerms ?? "—" },
          { key: "totalPurchases", header: "Purchases", render: (r) => formatPkr(r.totalPurchases) },
          { key: "openingBalancePkr", header: "Opening bal.", render: (r) => formatPkr(r.openingBalancePkr) },
          { key: "amountDue", header: "Amount due", render: (r) => <span className="font-semibold text-amber-600">{formatPkr(r.amountDue)}</span> },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacySalesManagementPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySales(branch!.code),
  });
  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  function onPrint(sale: PharmacySale): void {
    printPharmacyInvoice(branch?.name ?? "Pharmacy", branch?.code ?? "—", sale);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Sales management" subtitle="View transactions, reprint invoices, and track payments." />
      <SimpleTable<PharmacySale>
        rowKey={(r) => r.id}
        columns={[
          { key: "invoiceNumber", header: "Invoice" },
          { key: "patientName", header: "Customer", render: (r) => r.patientName ?? "Walk-in" },
          { key: "paymentMethod", header: "Payment" },
          { key: "total", header: "Total", render: (r) => formatPkr(r.total) },
          { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
          {
            id: "print",
            key: "id",
            header: "",
            render: (r) => (
              <button type="button" className="text-xs text-emerald-600 hover:underline" onClick={() => onPrint(r)}>
                Print invoice
              </button>
            ),
          },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacySalesStatementPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "sales-statement", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySalesStatement(branch!.code),
  });
  const total = (query.data ?? []).reduce((s, r) => s + r.total, 0);
  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <PageHeader title="Sales statement" subtitle={`Total: ${formatPkr(total)} across ${(query.data ?? []).length} invoices.`} />
      <SimpleTable
        rowKey={(r) => r.invoiceNumber}
        columns={[
          { key: "invoiceNumber", header: "Invoice" },
          { key: "patientName", header: "Customer", render: (r) => r.patientName ?? "Walk-in" },
          { key: "paymentMethod", header: "Payment" },
          { key: "total", header: "Amount", render: (r) => formatPkr(r.total) },
          { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacyProfitLossPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [fromLocal, setFromLocal] = useState(startOfMonth);
  const [toLocal, setToLocal] = useState(nowLocal);
  const [appliedFrom, setAppliedFrom] = useState(startOfMonth);
  const [appliedTo, setAppliedTo] = useState(nowLocal);

  const fromIso = useMemo(() => new Date(appliedFrom).toISOString(), [appliedFrom]);
  const toIso = useMemo(() => new Date(appliedTo).toISOString(), [appliedTo]);

  const query = useQuery({
    queryKey: ["pharmacy", "profit-loss", branch?.code, fromIso, toIso],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyProfitLoss(branch!.code, fromIso, toIso),
  });

  function applyFilter(): void {
    setAppliedFrom(fromLocal);
    setAppliedTo(toLocal);
  }

  function applyPreset(preset: "today" | "week" | "month"): void {
    const to = nowLocal();
    const from = preset === "today" ? startOfToday() : preset === "week" ? startOfWeek() : startOfMonth();
    setFromLocal(from);
    setToLocal(to);
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading profit / loss report…
      </div>
    );
  }

  if (query.isError) {
    return <div className={noticeErrorClass}>{(query.error as Error).message}</div>;
  }

  const report = query.data!;
  const isProfit = report.netProfit >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit / loss report"
        subtitle="Revenue, costs, and net profit for your pharmacy — filter by date and time."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Date filter</h2>
            <p className="mt-1 text-xs text-slate-500">Select a period to calculate profit and loss.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PharmacyField label="From">
            <PharmacyInput type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
          </PharmacyField>
          <PharmacyField label="To">
            <PharmacyInput type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
          </PharmacyField>
          <div className="flex items-end sm:col-span-2">
            <button
              type="button"
              onClick={applyFilter}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto"
            >
              Apply filter
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Showing: {report.periodLabel}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Net profit / loss" value={formatPkr(report.netProfit)} tone={isProfit ? "success" : "danger"} />
        <PharmacyStatCard label="Revenue" value={formatPkr(report.revenue)} tone="success" />
        <PharmacyStatCard label="Cost of goods sold" value={formatPkr(report.costOfGoods)} tone="warning" />
        <PharmacyStatCard label="Profit margin" value={`${report.marginPct}%`} tone={isProfit ? "success" : "danger"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Transactions" value={report.transactionCount} />
        <PharmacyStatCard label="Items sold" value={report.itemsSold} />
        <PharmacyStatCard label="Purchases" value={formatPkr(report.purchasesInPeriod)} />
        <PharmacyStatCard label="Discounts given" value={formatPkr(report.discountsGiven)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Profit & loss statement</h2>
          <p className="mt-1 text-xs text-slate-500">Income and expenses for the selected period.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {report.statement.map((row) => (
                  <tr
                    key={row.label}
                    className={
                      row.type === "total"
                        ? "bg-slate-50 font-semibold dark:bg-slate-900/60"
                        : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    }
                  >
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.label}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        row.type === "total"
                          ? "text-base font-bold text-slate-900 dark:text-white"
                          : row.amount >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {row.amount < 0 ? "−" : ""}
                      {formatPkr(Math.abs(row.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
              <span className="text-slate-500">Gross profit</span>
              <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">{formatPkr(report.grossProfit)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
              <span className="text-slate-500">Tax collected</span>
              <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">{formatPkr(report.taxCollected)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top selling medicines</h2>
          <p className="mt-1 text-xs text-slate-500">Best performers by revenue in this period.</p>
          {report.topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No sales recorded for this filter.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-4 py-3 text-left">Medicine</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {report.topProducts.map((product) => (
                    <tr key={product.medicineName} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{product.medicineName}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{product.qtySold}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-white">{formatPkr(product.revenue)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          product.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatPkr(product.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PharmacySalesMonthPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [fromLocal, setFromLocal] = useState(startOfMonth);
  const [toLocal, setToLocal] = useState(nowLocal);
  const [appliedFrom, setAppliedFrom] = useState(startOfMonth);
  const [appliedTo, setAppliedTo] = useState(nowLocal);

  const fromIso = useMemo(() => new Date(appliedFrom).toISOString(), [appliedFrom]);
  const toIso = useMemo(() => new Date(appliedTo).toISOString(), [appliedTo]);

  const query = useQuery({
    queryKey: ["pharmacy", "sales-month", branch?.code, fromIso, toIso],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySalesOfMonth(branch!.code, fromIso, toIso),
  });

  function applyFilter(): void {
    setAppliedFrom(fromLocal);
    setAppliedTo(toLocal);
  }

  function applyPreset(preset: "today" | "week" | "month"): void {
    const to = nowLocal();
    const from = preset === "today" ? startOfToday() : preset === "week" ? startOfWeek() : startOfMonth();
    setFromLocal(from);
    setToLocal(to);
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading sales report…
      </div>
    );
  }

  if (query.isError) {
    return <div className={noticeErrorClass}>{(query.error as Error).message}</div>;
  }

  const report = query.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales of the month"
        subtitle="Track pharmacy revenue by date and time — filter to see daily or hourly performance."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Date & time filter</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a start and end date/time, then apply the filter.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PharmacyField label="From">
            <PharmacyInput type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
          </PharmacyField>
          <PharmacyField label="To">
            <PharmacyInput type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
          </PharmacyField>
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button
              type="button"
              onClick={applyFilter}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto"
            >
              Apply filter
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Showing: {report.month}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Total sales" value={formatPkr(report.totalSales)} tone="success" />
        <PharmacyStatCard label="Transactions" value={report.transactionCount} />
        <PharmacyStatCard label="Average sale" value={formatPkr(report.averageSale)} />
        <PharmacyStatCard
          label="Period buckets"
          value={report.dailyBreakdown.length}
          tone={report.dailyBreakdown.length > 0 ? "default" : "warning"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Summary by period</h2>
          {report.dailyBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No breakdown data for the selected range.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Transactions</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {report.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.label}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{row.count}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatPkr(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">All transactions</h2>
          {report.transactions.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices found for this filter.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
              <div className="max-h-[360px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/90">
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date & time</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {report.transactions.map((sale) => (
                      <tr key={sale.invoiceNumber} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">{sale.invoiceNumber}</div>
                          <div className="text-xs text-slate-500">
                            {sale.patientName ?? "Walk-in"} · {sale.paymentMethod}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {new Date(sale.createdAt).toLocaleString("en-PK", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                          {formatPkr(sale.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PharmacyExpiredProductsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [fromDate, setFromDate] = useState(expiredDefaultFrom);
  const [toDate, setToDate] = useState(todayDate);
  const [appliedFrom, setAppliedFrom] = useState(expiredDefaultFrom);
  const [appliedTo, setAppliedTo] = useState(todayDate);
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["pharmacy", "expired", branch?.code, appliedFrom, appliedTo],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyExpiredProducts(branch!.code, appliedFrom, appliedTo),
  });

  const filtered = useMemo(() => {
    const list = query.data?.products ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.medicineName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.batchNumber.toLowerCase().includes(q),
    );
  }, [query.data?.products, search]);

  function applyFilter(): void {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  }

  function applyPreset(preset: "expired" | "month" | "soon"): void {
    if (preset === "expired") {
      setFromDate(expiredDefaultFrom());
      setToDate(todayDate());
      setAppliedFrom(expiredDefaultFrom());
      setAppliedTo(todayDate());
    } else if (preset === "month") {
      const from = toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const to = endOfMonthDate();
      setFromDate(from);
      setToDate(to);
      setAppliedFrom(from);
      setAppliedTo(to);
    } else {
      const from = todayDate();
      const to = in30DaysDate();
      setFromDate(from);
      setToDate(to);
      setAppliedFrom(from);
      setAppliedTo(to);
    }
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading expired products…
      </div>
    );
  }

  if (query.isError) {
    return <div className={noticeErrorClass}>{(query.error as Error).message}</div>;
  }

  const report = query.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expired products"
        subtitle="Track expired and near-expiry batches — arrange supplier returns or safe disposal."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Expiry date filter</h2>
            <p className="mt-1 text-xs text-slate-500">Filter batches by expiry date range.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["expired", "All expired"],
                ["month", "Expiring this month"],
                ["soon", "Next 30 days"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PharmacyField label="Expiry from">
            <PharmacyInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </PharmacyField>
          <PharmacyField label="Expiry to">
            <PharmacyInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </PharmacyField>
          <div className="flex items-end sm:col-span-2">
            <button
              type="button"
              onClick={applyFilter}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto"
            >
              Apply filter
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Showing expiry dates: {report.periodLabel}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Total batches" value={report.totalBatches} />
        <PharmacyStatCard label="Units at risk" value={report.totalUnits} tone="warning" />
        <PharmacyStatCard label="Already expired" value={report.expiredCount} tone="danger" />
        <PharmacyStatCard label="Est. loss value" value={formatPkr(report.estimatedLossPkr)} tone="danger" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Batch list</h2>
          <p className="text-xs text-slate-500">
            {filtered.length} of {report.products.length} batches
            {report.expiringSoonCount > 0 ? ` · ${report.expiringSoonCount} expiring soon` : ""}
          </p>
        </div>
        <div className="w-full sm:max-w-sm">
          <PharmacyInput
            placeholder="Search medicine, SKU, or batch…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No batches found</p>
          <p className="mt-1 text-xs text-slate-500">
            {search ? "Try a different search term." : "No expired or near-expiry stock for this date range."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Est. loss</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{item.medicineName}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {item.sku} · {item.category}
                        {item.presentation ? ` · ${item.presentation}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{item.batchNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.expiryDate}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-slate-900 dark:text-white">{item.quantity}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-red-600 dark:text-red-400">
                      {formatPkr(item.estimatedLossPkr)}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "expired" ? (
                        <Badge tone="danger">{item.daysOverdue} days overdue</Badge>
                      ) : (
                        <Badge tone="warning">Expires in {item.daysUntilExpiry} days</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
