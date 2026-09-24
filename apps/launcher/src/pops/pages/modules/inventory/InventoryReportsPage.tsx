import type { InventoryReportDateMode } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchBranchInventory,
  fetchInventoryCookingUnits,
  fetchInventoryReport,
  INVENTORY_REPORTS,
} from "../../../api/inventory";
import { fetchRestaurantReport } from "../../../api/reports";
import { formatPkr, inputClass, selectClass, useInventoryAccess } from "../../../hooks/useInventory";
import { printInventoryReport } from "../../../lib/printInventoryReport";
import { cardClass, linkActionClass, linkWarningClass, mutedClass, panelTitleClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { ModuleFilterBar, ModuleSegmentedControl } from "../../../ui/ModuleToolbar";
import { InventoryError, InventoryLoading, StockLeftTotal, summarizeIngredientStock } from "./InventoryUi";
import { InventoryReportView } from "./InventoryReportView";

function categoryTone(cat: string): "neutral" | "info" | "success" | "warning" {
  if (cat === "Inventory") return "info";
  if (cat === "Restaurant") return "success";
  if (cat === "Purchase") return "warning";
  return "neutral";
}

function formatFilterDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateRangeLabel(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom && !dateTo) return null;
  if (dateFrom && dateTo && dateFrom === dateTo) return formatFilterDate(dateFrom);
  if (dateFrom && dateTo) return `${formatFilterDate(dateFrom)} → ${formatFilterDate(dateTo)}`;
  if (dateFrom) return `From ${formatFilterDate(dateFrom)}`;
  return `Until ${formatFilterDate(dateTo)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const UNIT_SCOPED_REPORTS = new Set([
  "stock-transfers",
  "stock-transfers-by-section",
  "cooking-unit-stock",
]);

const FOOD_COST_KIT = [
  {
    step: "1",
    id: "stock-transfers-by-section",
    title: "Cooking unit transfer report",
    blurb: "Kitna stock (Rs) unit mein gaya — food cost ka input",
    kind: "inventory" as const,
  },
  {
    step: "2",
    id: "cooking-unit-stock",
    title: "Cooking unit stock in hand",
    blurb: "Ab unit ke paas kitna stock bacha (closing)",
    kind: "inventory" as const,
  },
  {
    step: "3",
    id: "cooking-unit-sales",
    title: "Cooking unit sales",
    blurb: "Us unit ne kitni sale ki — food cost % ka denominator",
    kind: "sales" as const,
  },
] as const;

type FoodCostSnapshot = {
  transferValue: number;
  stockValue: number;
  salesValue: number;
  foodCostPct: number | null;
};

export function InventoryReportsPage(): JSX.Element {
  const { branch } = useInventoryAccess();
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<InventoryReportDateMode>("activity");
  const [cookingUnitId, setCookingUnitId] = useState("");
  const [foodCostSnapshot, setFoodCostSnapshot] = useState<FoodCostSnapshot | null>(null);

  const reportOptions = useMemo(
    () => ({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(dateFrom || dateTo ? { dateMode: dateFilterMode } : {}),
      ...(cookingUnitId && activeReportId && UNIT_SCOPED_REPORTS.has(activeReportId)
        ? { cookingUnitId }
        : {}),
    }),
    [dateFrom, dateTo, dateFilterMode, cookingUnitId, activeReportId],
  );

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const cookingUnitsQuery = useQuery({
    queryKey: ["inventory", "cooking-units", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnits(branch!.code),
  });

  const reportQuery = useQuery({
    queryKey: [
      "inventory",
      "report",
      branch?.code,
      activeReportId,
      dateFrom,
      dateTo,
      dateFilterMode,
      cookingUnitId,
    ],
    enabled: Boolean(branch?.code && activeReportId),
    queryFn: () => fetchInventoryReport(branch!.code, activeReportId!, reportOptions),
  });

  const salesReportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo || dateFrom) params.set("to", dateTo || dateFrom);
    if (cookingUnitId) params.set("cookingUnitId", cookingUnitId);
    const qs = params.toString();
    return qs ? `/pops/reports/cooking-unit-sales?${qs}` : "/pops/reports/cooking-unit-sales";
  }, [dateFrom, dateTo, cookingUnitId]);

  const runReport = useMutation({
    mutationFn: (reportId: string) => {
      setActiveReportId(reportId);
      setError(null);
      const options = {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(dateFrom || dateTo ? { dateMode: dateFilterMode } : {}),
        ...(cookingUnitId && UNIT_SCOPED_REPORTS.has(reportId) ? { cookingUnitId } : {}),
      };
      return fetchInventoryReport(branch!.code, reportId, options);
    },
    onError: (e: Error) => setError(e.message),
  });

  const loadFoodCostSnapshot = useMutation({
    mutationFn: async () => {
      if (!branch?.code) throw new Error("Branch required");
      const from = dateFrom || todayIso();
      const to = dateTo || dateFrom || todayIso();
      const invOpts = {
        dateFrom: from,
        dateTo: to,
        dateMode: dateFilterMode,
        ...(cookingUnitId ? { cookingUnitId } : {}),
      };
      const [transfer, stock, sales] = await Promise.all([
        fetchInventoryReport(branch.code, "stock-transfers-by-section", invOpts),
        fetchInventoryReport(branch.code, "cooking-unit-stock", {
          ...(cookingUnitId ? { cookingUnitId } : {}),
        }),
        fetchRestaurantReport(branch.code, "cooking-unit-sales", {
          from,
          to,
          fromTime: "00:00",
          toTime: "23:59",
          ...(cookingUnitId ? { cookingUnitId } : {}),
        }),
      ]);

      const transferRows = Array.isArray(transfer.data) ? transfer.data : [];
      const transferValue = transferRows.reduce((sum, row) => {
        if (!row || typeof row !== "object") return sum;
        const r = row as Record<string, unknown>;
        return sum + (Number(r.valueIn ?? r.totalValue) || 0);
      }, 0);

      const stockRows = Array.isArray(stock.data) ? stock.data : [];
      const stockValue = stockRows.reduce((sum, row) => {
        if (!row || typeof row !== "object") return sum;
        return sum + (Number((row as Record<string, unknown>).stockValue) || 0);
      }, 0);

      const salesValue = Number(sales.totals?.revenue ?? 0);
      const foodCostPct =
        salesValue > 0 ? Math.round((transferValue / salesValue) * 1000) / 10 : null;

      return { transferValue, stockValue, salesValue, foodCostPct };
    },
    onSuccess: (data) => {
      setFoodCostSnapshot(data);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const stockLeft = useMemo(
    () => summarizeIngredientStock(inventoryQuery.data?.ingredients ?? []),
    [inventoryQuery.data?.ingredients],
  );

  if (inventoryQuery.isLoading) return <InventoryLoading />;
  if (inventoryQuery.isError) return <InventoryError message={(inventoryQuery.error as Error).message} />;

  const cookingUnits = cookingUnitsQuery.data?.units.filter((u) => u.isActive) ?? [];
  const showUnitFilter = !activeReportId || UNIT_SCOPED_REPORTS.has(activeReportId);
  const selectedUnitName =
    cookingUnits.find((u) => u.id === cookingUnitId)?.name ?? null;
  const dateRangeLabel = formatDateRangeLabel(dateFrom, dateTo);
  const hasFilters = Boolean(dateFrom || dateTo || cookingUnitId);

  const canPrint =
    Boolean(reportQuery.data) &&
    Array.isArray(reportQuery.data?.data) &&
    (reportQuery.data?.data.length ?? 0) > 0;

  async function runPrint(opts?: { preferPdf?: boolean }): Promise<void> {
    if (!reportQuery.data) return;
    setError(null);
    const result = await printInventoryReport({
      report: reportQuery.data,
      branchCode: branch?.code,
      branchName: branch?.name ?? branch?.code,
      cookingUnitLabel: UNIT_SCOPED_REPORTS.has(reportQuery.data.id) ? selectedUnitName : null,
      preferPdf: opts?.preferPdf,
    });
    if (!result.ok) {
      setError(result.error ?? "Print failed. Printer → Routing → By report check karein.");
    }
  }

  function clearFilters(): void {
    setDateFrom("");
    setDateTo("");
    setCookingUnitId("");
    setFoodCostSnapshot(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory reports"
        subtitle="Transfers, stock in hand, and cooking-unit sales — recipe lock ke baghair food cost nikalne ke liye."
        actions={
          <>
            <button
              type="button"
              className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canPrint}
              title={canPrint ? "Print (uses Routing → By report)" : "Pehle koi report Generate karein"}
              onClick={() => void runPrint()}
            >
              Print
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canPrint}
              title={canPrint ? "Save as PDF" : "Pehle koi report Generate karein"}
              onClick={() => void runPrint({ preferPdf: true })}
            >
              PDF
            </button>
            <Link to="/pops/printer?tab=routing&sub=reports" className="rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Report routing
            </Link>
            <Link to={salesReportHref} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500">
              Cooking unit sales
            </Link>
            <Link to="/pops/inventory/stock-transfers" className="rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Stock transfers
            </Link>
          </>
        }
      />
      {error ? <InventoryError message={error} /> : null}

      <StockLeftTotal
        title="Stock left — overall"
        hint={
          selectedUnitName
            ? `${selectedUnitName} highlight hai. Bara number poori branch ka bacha hua stock hai (on-hand × unit cost).`
            : "Har cheez alag nazar aati hai. Ye total hai ke branch mein ab kitna stock bacha hai (on-hand × unit cost). Store back stock hai, baqi cooking units hain."
        }
        total={stockLeft.total}
        parts={stockLeft.parts}
        highlightId={cookingUnitId || null}
      />

      <div className={`${cardClass} border-amber-500/30 bg-amber-500/5 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={panelTitleClass}>No-recipe food cost kit</div>
            <p className={`mt-1 max-w-3xl text-xs ${mutedClass}`}>
              Jahan chef recipe lock nahi karwate, wahan ye 3 reports se unit-wise food cost easy nikalta hai:
              transfer (stock in) ÷ sale × 100 ≈ food cost %. Stock in hand closing / leftover check ke liye.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            disabled={loadFoodCostSnapshot.isPending || !branch?.code}
            onClick={() => loadFoodCostSnapshot.mutate()}
          >
            {loadFoodCostSnapshot.isPending ? "Loading…" : "Load food cost snapshot"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {FOOD_COST_KIT.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-[11px] font-bold text-white">
                  {item.step}
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</span>
              </div>
              <p className={`mt-1 text-xs ${mutedClass}`}>{item.blurb}</p>
              {item.kind === "inventory" ? (
                <button
                  type="button"
                  className={`mt-2 text-xs ${linkWarningClass}`}
                  onClick={() => runReport.mutate(item.id)}
                >
                  Open report
                </button>
              ) : (
                <Link to={salesReportHref} className={`mt-2 inline-block text-xs ${linkWarningClass}`}>
                  Open sales report
                </Link>
              )}
            </div>
          ))}
        </div>

        {foodCostSnapshot ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">1 · Transfer in</div>
              <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatPkr(foodCostSnapshot.transferValue)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">2 · Stock in hand</div>
              <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatPkr(foodCostSnapshot.stockValue)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">3 · Sale</div>
              <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatPkr(foodCostSnapshot.salesValue)}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Est. food cost
              </div>
              <div className="text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                {foodCostSnapshot.foodCostPct == null
                  ? "—"
                  : `${foodCostSnapshot.foodCostPct}%`}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Transfer ÷ Sale
                {selectedUnitName ? ` · ${selectedUnitName}` : " · all units"}
                {dateRangeLabel ? ` · ${dateRangeLabel}` : " · today"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ModuleFilterBar>
        <ModuleSegmentedControl
          value={dateFilterMode}
          onChange={setDateFilterMode}
          options={[
            { id: "activity", label: "Activity" },
            { id: "expiry", label: "Expiry" },
            { id: "order", label: "Order" },
          ]}
        />
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>From date</span>
          <input
            className={inputClass}
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setFoodCostSnapshot(null);
            }}
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>To date</span>
          <input
            className={inputClass}
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => {
              setDateTo(e.target.value);
              setFoodCostSnapshot(null);
            }}
          />
        </label>
        {showUnitFilter ? (
          <label className="flex min-w-[12rem] flex-col gap-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>
              Cooking unit
            </span>
            <select
              className={selectClass}
              value={cookingUnitId}
              onChange={(e) => {
                setCookingUnitId(e.target.value);
                setFoodCostSnapshot(null);
              }}
            >
              <option value="">All units</option>
              {cookingUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            className={`self-end text-xs ${linkActionClass}`}
            onClick={clearFilters}
          >
            Clear filters
          </button>
        ) : null}
      </ModuleFilterBar>

      {hasFilters ? (
        <p className={`text-xs ${mutedClass}`}>
          {dateRangeLabel ? (
            <>
              Date: <span className="font-medium">{dateFilterMode}</span>{" "}
              <span className="font-medium">{dateRangeLabel}</span>.{" "}
            </>
          ) : null}
          {cookingUnitId && selectedUnitName ? (
            <>
              Cooking unit: <span className="font-medium text-amber-200">{selectedUnitName}</span>
            </>
          ) : null}
        </p>
      ) : (
        <p className={`text-xs ${mutedClass}`}>
          Food cost ke liye pehle From/To date + Cooking unit select karein, phir upar se Load food cost snapshot dabayein.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(["Inventory", "Restaurant", "Purchase", "Supplier"] as const).map((cat) => (
          <div key={cat} className={`${cardClass} p-4`}>
            <div className={panelTitleClass}>{cat} reports</div>
            <ul className={`mt-3 space-y-2 text-sm ${mutedClass}`}>
              {INVENTORY_REPORTS.filter((r) => r.category === cat).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-800 dark:text-slate-200">{r.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className={`text-xs ${linkWarningClass}`}
                      onClick={() => runReport.mutate(r.id)}
                    >
                      Generate
                    </button>
                    {reportQuery.data?.id === r.id &&
                    Array.isArray(reportQuery.data.data) &&
                    reportQuery.data.data.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className="text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-300"
                          onClick={() => void runPrint()}
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-500 hover:text-slate-300"
                          onClick={() => void runPrint({ preferPdf: true })}
                        >
                          PDF
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {activeReportId && reportQuery.isLoading ? <InventoryLoading label="Generating report…" /> : null}

      {reportQuery.data ? (
        <div className={`${cardClass} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={panelTitleClass}>{reportQuery.data.name}</span>
              <Badge tone={categoryTone(reportQuery.data.category)}>{reportQuery.data.category}</Badge>
              <span className={`text-xs ${mutedClass}`}>Generated {reportQuery.data.lastGenerated}</span>
              {dateRangeLabel ? (
                <span className={`text-xs ${mutedClass}`}>
                  · {reportQuery.data.dateMode ?? dateFilterMode} {dateRangeLabel}
                </span>
              ) : null}
              {selectedUnitName && UNIT_SCOPED_REPORTS.has(reportQuery.data.id) ? (
                <span className={`text-xs ${mutedClass}`}>· Unit {selectedUnitName}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                disabled={!canPrint}
                onClick={() => void runPrint()}
              >
                Print
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                disabled={!canPrint}
                onClick={() => void runPrint({ preferPdf: true })}
              >
                PDF
              </button>
            </div>
          </div>
          <p className={`mt-1 text-xs ${mutedClass}`}>{reportQuery.data.description}</p>

          {UNIT_SCOPED_REPORTS.has(reportQuery.data.id) ? (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3">
              <label className="flex min-w-[10rem] flex-col gap-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>
                  From date
                </span>
                <input
                  className={inputClass}
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="flex min-w-[10rem] flex-col gap-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>
                  To date
                </span>
                <input
                  className={inputClass}
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              <label className="flex min-w-[12rem] flex-col gap-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>
                  Cooking unit
                </span>
                <select
                  className={selectClass}
                  value={cookingUnitId}
                  onChange={(e) => setCookingUnitId(e.target.value)}
                >
                  <option value="">All units</option>
                  {cookingUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500"
                onClick={() => activeReportId && runReport.mutate(activeReportId)}
              >
                Apply filters
              </button>
              {hasFilters ? (
                <button
                  type="button"
                  className={`self-end pb-2 text-xs ${linkActionClass}`}
                  onClick={clearFilters}
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3">
            <InventoryReportView
              report={reportQuery.data}
              cookingUnitLabel={
                UNIT_SCOPED_REPORTS.has(reportQuery.data.id) ? selectedUnitName : null
              }
            />
          </div>
        </div>
      ) : null}

      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Report" },
          {
            key: "category",
            header: "Category",
            render: (r) => <Badge tone={categoryTone(r.category)}>{r.category}</Badge>,
          },
          {
            id: "action",
            key: "id",
            header: "",
            render: (r) => (
              <div className="flex items-center gap-2">
                <button type="button" className={`text-xs ${linkWarningClass}`} onClick={() => runReport.mutate(r.id)}>
                  Run
                </button>
                {reportQuery.data?.id === r.id && Array.isArray(reportQuery.data.data) && reportQuery.data.data.length > 0 ? (
                  <>
                    <button
                      type="button"
                      className="text-xs font-medium text-amber-300 hover:text-amber-200"
                      onClick={() => void runPrint()}
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-400 hover:text-slate-200"
                      onClick={() => void runPrint({ preferPdf: true })}
                    >
                      PDF
                    </button>
                  </>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={INVENTORY_REPORTS}
      />
    </div>
  );
}
