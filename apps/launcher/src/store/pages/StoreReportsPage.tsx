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
    <div className="space-y-5">
      <PageHeader title="Reports hub" subtitle="Inventory, financial, and business intelligence reports." />

      <StoreReportDateFilter
        description="Set the period for all report summaries below. Each report page uses the same date & time filter."
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/pops/store/reports/stock"
          className="group rounded-xl border border-slate-200 p-5 transition hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:hover:border-sky-600"
        >
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
            Stock reports
          </h3>
          <p className="mt-1 text-xs text-slate-500">Current stock, movement, dead stock, fast/slow movers</p>
        </Link>
        <Link
          to="/pops/store/reports/profit-loss"
          className="group rounded-xl border border-slate-200 p-5 transition hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:hover:border-sky-600"
        >
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
            Profit / loss
          </h3>
          <p className="mt-1 text-xs text-slate-500">Revenue, COGS, margins, top products</p>
        </Link>
        <Link
          to="/pops/store/reports/inventory"
          className="group rounded-xl border border-slate-200 p-5 transition hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:hover:border-sky-600"
        >
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
            Inventory valuation
          </h3>
          <p className="mt-1 text-xs text-slate-500">Stock value and filtered movement transactions</p>
        </Link>
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
