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
import { inputClass, selectClass, useInventoryAccess } from "../../../hooks/useInventory";
import { printInventoryReport } from "../../../lib/printInventoryReport";
import { cardClass, linkActionClass, linkWarningClass, mutedClass, panelTitleClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { ModuleFilterBar, ModuleSegmentedControl } from "../../../ui/ModuleToolbar";
import { InventoryError, InventoryLoading } from "./InventoryUi";
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

const UNIT_SCOPED_REPORTS = new Set([
  "stock-transfers",
  "stock-transfers-by-section",
  "cooking-unit-stock",
]);

export function InventoryReportsPage(): JSX.Element {
  const { branch } = useInventoryAccess();
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<InventoryReportDateMode>("activity");
  const [cookingUnitId, setCookingUnitId] = useState("");

  const reportOptions = useMemo(
    () => ({
      ...(filterDate ? { filterDate, dateMode: dateFilterMode } : {}),
      ...(cookingUnitId && activeReportId && UNIT_SCOPED_REPORTS.has(activeReportId)
        ? { cookingUnitId }
        : {}),
    }),
    [filterDate, dateFilterMode, cookingUnitId, activeReportId],
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
      filterDate,
      dateFilterMode,
      cookingUnitId,
    ],
    enabled: Boolean(branch?.code && activeReportId),
    queryFn: () => fetchInventoryReport(branch!.code, activeReportId!, reportOptions),
  });

  const runReport = useMutation({
    mutationFn: (reportId: string) => {
      setActiveReportId(reportId);
      setError(null);
      const options = {
        ...(filterDate ? { filterDate, dateMode: dateFilterMode } : {}),
        ...(cookingUnitId && UNIT_SCOPED_REPORTS.has(reportId) ? { cookingUnitId } : {}),
      };
      return fetchInventoryReport(branch!.code, reportId, options);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (inventoryQuery.isLoading) return <InventoryLoading />;
  if (inventoryQuery.isError) return <InventoryError message={(inventoryQuery.error as Error).message} />;

  const cookingUnits = cookingUnitsQuery.data?.units.filter((u) => u.isActive) ?? [];
  const showUnitFilter = !activeReportId || UNIT_SCOPED_REPORTS.has(activeReportId);
  const selectedUnitName =
    cookingUnits.find((u) => u.id === cookingUnitId)?.name ?? null;

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory reports"
        subtitle="Stock, transfers, kitchen section stock, consumption, recipe cost, waste, purchase, and supplier reports."
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
            <Link to="/pops/reports/cooking-unit-profit" className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500">
              Section profit report
            </Link>
            <Link to="/pops/inventory/stock-transfers" className="rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Stock transfers
            </Link>
          </>
        }
      />
      {error ? <InventoryError message={error} /> : null}

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
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>Filter date</span>
          <input
            className={inputClass}
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
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
        ) : null}
        {filterDate || cookingUnitId ? (
          <button
            type="button"
            className={`self-end text-xs ${linkActionClass}`}
            onClick={() => {
              setFilterDate("");
              setCookingUnitId("");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </ModuleFilterBar>

      {filterDate || cookingUnitId ? (
        <p className={`text-xs ${mutedClass}`}>
          {filterDate ? (
            <>
              Date filter: <span className="font-medium">{dateFilterMode}</span> on{" "}
              <span className="font-medium">{formatFilterDate(filterDate)}</span>.{" "}
            </>
          ) : null}
          {cookingUnitId && selectedUnitName ? (
            <>
              Cooking unit: <span className="font-medium text-amber-200">{selectedUnitName}</span> — unit-wise
              stock / transfer reports show qty + Rs value for this section only.
            </>
          ) : null}
        </p>
      ) : null}

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
              {reportQuery.data.filterDate ? (
                <span className={`text-xs ${mutedClass}`}>
                  · Filtered {reportQuery.data.dateMode} {formatFilterDate(reportQuery.data.filterDate)}
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
