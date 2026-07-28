import { Button } from "@platform/ui";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStoreProducts,
  fetchStoreProfitLoss,
  fetchStoreStockReport,
  fetchStoreTransactions,
} from "../api/store";
import { isWithinRange } from "../lib/reportDateFilter";
import { useStoreReportDateFilter } from "../hooks/useStoreReportDateFilter";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import { StoreStatCard } from "../ui/StoreUi";
import { StoreReportDateFilter } from "../ui/StoreReportDateFilter";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass } from "../../pops/lib/themeClasses";

const storeReportTypes = [
  { label: "Stock reports", to: "/pops/store/reports/stock", hint: "Current stock, movement, dead stock, fast/slow movers" },
  { label: "Peak hours", to: "/pops/store/reports/peak-hours", hint: "Busy periods and transaction volume by hour" },
  { label: "Employee report", to: "/pops/store/reports/employees", hint: "Cashier and staff sales performance" },
  { label: "Wastage report", to: "/pops/store/reports/wastage", hint: "Write-offs and wastage tracking" },
  { label: "Profit / loss", to: "/pops/store/reports/profit-loss", hint: "Revenue, COGS, margins, top products" },
  { label: "Inventory valuation", to: "/pops/store/reports/inventory", hint: "Stock value and movement transactions" },
  { label: "Tax (PRA/FBR)", to: "/pops/tax", hint: "Fiscal invoice status and authority connection" },
  { label: "Consolidated multi-branch", to: "/pops/multi-branch/reports", hint: "Cross-branch consolidated view" },
];

export function StoreReportsPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const filter = useStoreReportDateFilter("month");

  const profitQuery = useQuery({
    queryKey: ["store", "profit-loss", branch?.code, filter.fromIso, filter.toIso],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProfitLoss(branch!.code, filter.fromIso || undefined, filter.toIso || undefined),
  });

  const stockQuery = useQuery({
    queryKey: ["store", "stock-report", branch?.code, filter.fromIso, filter.toIso],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreStockReport(branch!.code, filter.fromIso || undefined, filter.toIso || undefined),
  });

  const profit = profitQuery.data;
  const stock = stockQuery.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & analytics"
        subtitle="General Store — saved layouts, comparisons, and exports (same workflow as Restaurant Reports)."
        actions={
          <>
            <Button variant="ghost" className="text-xs">
              Schedule email
            </Button>
            <Button className="text-xs">Export Excel</Button>
          </>
        }
      />

      <StoreReportDateFilter
        description="Set the period for report summaries. Each report page uses the same date & time filter."
        fromLocal={filter.fromLocal}
        toLocal={filter.toLocal}
        periodLabel={filter.periodLabel}
        onFromChange={filter.setFromLocal}
        onToChange={filter.setToLocal}
        onApply={filter.applyFilter}
        onPreset={filter.applyPreset}
      />

      {(profitQuery.isError || stockQuery.isError) && (
        <div className={noticeErrorClass}>
          {(profitQuery.error as Error)?.message ?? (stockQuery.error as Error)?.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreStatCard label="Revenue" value={profit ? formatPkr(profit.revenue) : "—"} tone="success" />
        <StoreStatCard
          label="Net profit"
          value={profit ? formatPkr(profit.netProfit) : "—"}
          tone={profit && profit.netProfit >= 0 ? "success" : "danger"}
        />
        <StoreStatCard label="Items sold" value={profit?.itemsSold ?? "—"} />
        <StoreStatCard label="Fast movers" value={stock?.fastMoving.length ?? "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40 lg:col-span-1">
          <div className="text-xs font-semibold uppercase text-slate-500">Report</div>
          <ul className="mt-2 space-y-1">
            {storeReportTypes.map((r) => (
              <li key={r.label}>
                <Link
                  to={r.to}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-emerald-700 hover:bg-slate-100 dark:text-emerald-300 dark:hover:bg-slate-800"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30 lg:col-span-3">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Pick a report on the left, or open{" "}
            <Link className="text-emerald-600 underline dark:text-emerald-400" to="/pops/store/reports/stock">
              Stock reports
            </Link>{" "}
            /{" "}
            <Link className="text-emerald-600 underline dark:text-emerald-400" to="/pops/store/reports/profit-loss">
              Profit / loss
            </Link>{" "}
            for live General Store data.
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {storeReportTypes.slice(0, 6).map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-sky-600"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{r.label}</div>
                <p className="mt-1 text-xs text-slate-500">{r.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StoreStockReportPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const filter = useStoreReportDateFilter("month");

  const reportQuery = useQuery({
    queryKey: ["store", "stock-report", branch?.code, filter.fromIso, filter.toIso],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreStockReport(branch!.code, filter.fromIso || undefined, filter.toIso || undefined),
  });

  const report = reportQuery.data;

  if (reportQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading stock report…</p>;
  }

  if (reportQuery.isError) {
    return <div className={noticeErrorClass}>{(reportQuery.error as Error).message}</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Stock reports" subtitle="Current stock, movement, dead stock, and product velocity." />

      <StoreReportDateFilter
        description="Movement, fast/slow movers, and dead stock are calculated for the selected period."
        fromLocal={filter.fromLocal}
        toLocal={filter.toLocal}
        periodLabel={filter.periodLabel}
        onFromChange={filter.setFromLocal}
        onToChange={filter.setToLocal}
        onApply={filter.applyFilter}
        onPreset={filter.applyPreset}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StoreStatCard label="Products tracked" value={report?.products.length ?? 0} />
        <StoreStatCard label="Fast movers" value={report?.fastMoving.length ?? 0} tone="success" />
        <StoreStatCard label="Dead stock items" value={report?.deadStock.length ?? 0} tone="warning" />
      </div>

      <StoreDataTable
        columns={["SKU", "Product", "Category", "Stock", "Reorder", "Value", "Movement", "Status"]}
        rows={(report?.products ?? []).map((p) => [
          p.sku,
          p.name,
          p.category ?? "—",
          p.availableStock,
          p.reorderLevel,
          formatPkr(p.value),
          p.movement30d,
          <Badge tone={p.status === "out" ? "danger" : p.status === "low" ? "warning" : "success"}>{p.status.toUpperCase()}</Badge>,
        ])}
      />

      <h3 className="text-sm font-semibold">Fast-moving products</h3>
      <StoreDataTable columns={["Product", "SKU", "Qty sold"]} rows={(report?.fastMoving ?? []).map((p) => [p.name, p.sku, p.qtySold])} />

      <h3 className="text-sm font-semibold">Slow-moving products</h3>
      <StoreDataTable columns={["Product", "SKU", "Qty sold"]} rows={(report?.slowMoving ?? []).map((p) => [p.name, p.sku, p.qtySold])} />

      <h3 className="text-sm font-semibold">Dead stock</h3>
      <StoreDataTable
        columns={["Product", "SKU", "Days idle", "Value"]}
        rows={(report?.deadStock ?? []).map((p) => [p.name, p.sku, p.daysIdle, formatPkr(p.value)])}
      />
    </div>
  );
}

export function StoreProfitLossPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const filter = useStoreReportDateFilter("month");

  const reportQuery = useQuery({
    queryKey: ["store", "profit-loss", branch?.code, filter.fromIso, filter.toIso],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProfitLoss(branch!.code, filter.fromIso || undefined, filter.toIso || undefined),
  });

  const r = reportQuery.data;

  if (reportQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading profit / loss report…</p>;
  }

  if (reportQuery.isError) {
    return <div className={noticeErrorClass}>{(reportQuery.error as Error).message}</div>;
  }

  if (!r) {
    return <p className="text-sm text-slate-500">No report data for this period.</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Profit / loss report" subtitle="Revenue, costs, and net profit for the selected period." />

      <StoreReportDateFilter
        description="Calculate revenue, COGS, and profit for sales within this date & time range."
        fromLocal={filter.fromLocal}
        toLocal={filter.toLocal}
        periodLabel={filter.periodLabel}
        onFromChange={filter.setFromLocal}
        onToChange={filter.setToLocal}
        onApply={filter.applyFilter}
        onPreset={filter.applyPreset}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreStatCard label="Revenue" value={formatPkr(r.revenue)} tone="success" />
        <StoreStatCard label="Cost of goods" value={formatPkr(r.costOfGoods)} />
        <StoreStatCard label="Gross profit" value={formatPkr(r.grossProfit)} tone="success" />
        <StoreStatCard label="Net profit" value={formatPkr(r.netProfit)} tone={r.netProfit >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StoreStatCard label="Margin" value={`${r.marginPct}%`} />
        <StoreStatCard label="Transactions" value={r.transactionCount} />
        <StoreStatCard label="Items sold" value={r.itemsSold} />
      </div>

      <h3 className="text-sm font-semibold">Top products by profit</h3>
      <StoreDataTable
        columns={["Product", "Qty sold", "Revenue", "Profit"]}
        rows={r.topProducts.map((p) => [p.productName, p.qtySold, formatPkr(p.revenue), formatPkr(p.profit)])}
      />
    </div>
  );
}

export function StoreInventoryValuationPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const filter = useStoreReportDateFilter("month");

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  const txQuery = useQuery({
    queryKey: ["store", "transactions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreTransactions(branch!.code),
  });

  const products = productsQuery.data ?? [];
  const filteredTx = (txQuery.data ?? []).filter((t) =>
    isWithinRange(t.createdAt, filter.appliedFrom, filter.appliedTo),
  );

  const totalValue = products.reduce((s, p) => s + p.inventoryValue, 0);

  if (productsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading inventory valuation…</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Inventory valuation" subtitle="Current stock value and movement transactions for the selected period." />

      <StoreReportDateFilter
        description="Stock levels reflect current snapshot; transactions below are filtered by date & time."
        fromLocal={filter.fromLocal}
        toLocal={filter.toLocal}
        periodLabel={filter.periodLabel}
        onFromChange={filter.setFromLocal}
        onToChange={filter.setToLocal}
        onApply={filter.applyFilter}
        onPreset={filter.applyPreset}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StoreStatCard label="Total inventory value" value={formatPkr(totalValue)} tone="success" />
        <StoreStatCard label="Transactions in period" value={filteredTx.length} />
      </div>

      <StoreDataTable
        columns={["SKU", "Product", "Stock", "Unit cost", "Value", "Status"]}
        rows={products.map((p) => [
          p.sku,
          p.name,
          p.availableStock,
          formatPkr(p.purchasePrice),
          formatPkr(p.inventoryValue),
          p.availableStock === 0 ? (
            <Badge tone="danger">Out</Badge>
          ) : p.availableStock <= p.reorderLevel ? (
            <Badge tone="warning">Low</Badge>
          ) : (
            <Badge tone="success">OK</Badge>
          ),
        ])}
      />

      <h3 className="text-sm font-semibold">Inventory transactions in period</h3>
      <StoreDataTable
        columns={["Product", "Type", "Qty", "Reference", "Date"]}
        rows={filteredTx.map((t) => [
          t.productName,
          t.type.replace(/_/g, " "),
          t.qty,
          t.reference ?? "—",
          new Date(t.createdAt).toLocaleString(),
        ])}
      />
    </div>
  );
}
