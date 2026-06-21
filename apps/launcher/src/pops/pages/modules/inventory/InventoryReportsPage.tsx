import type { InventoryReportDateMode } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchBranchInventory, fetchInventoryReport, INVENTORY_REPORTS } from "../../../api/inventory";
import { inputClass, useInventoryAccess } from "../../../hooks/useInventory";
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

export function InventoryReportsPage(): JSX.Element {
  const { branch } = useInventoryAccess();
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<InventoryReportDateMode>("activity");

  const reportOptions = useMemo(
    () => (filterDate ? { filterDate, dateMode: dateFilterMode } : undefined),
    [filterDate, dateFilterMode],
  );

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const reportQuery = useQuery({
    queryKey: ["inventory", "report", branch?.code, activeReportId, filterDate, dateFilterMode],
    enabled: Boolean(branch?.code && activeReportId),
    queryFn: () => fetchInventoryReport(branch!.code, activeReportId!, reportOptions),
  });

  const runReport = useMutation({
    mutationFn: (reportId: string) => {
      setActiveReportId(reportId);
      setError(null);
      return fetchInventoryReport(branch!.code, reportId, reportOptions);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (inventoryQuery.isLoading) return <InventoryLoading />;
  if (inventoryQuery.isError) return <InventoryError message={(inventoryQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory reports"
        subtitle="Stock, consumption, recipe cost, waste, purchase, and supplier reports."
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
        {filterDate ? (
          <button
            type="button"
            className={`self-end text-xs ${linkActionClass}`}
            onClick={() => setFilterDate("")}
          >
            Clear date
          </button>
        ) : null}
      </ModuleFilterBar>

      {filterDate ? (
        <p className={`text-xs ${mutedClass}`}>
          Reports with date fields are filtered by{" "}
          <span className="font-medium">{dateFilterMode}</span> date on{" "}
          <span className="font-medium">{formatFilterDate(filterDate)}</span>. Snapshot reports (stock, valuation,
          recipe cost) are unchanged.
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
                  <button
                    type="button"
                    className={`text-xs ${linkWarningClass}`}
                    onClick={() => runReport.mutate(r.id)}
                  >
                    Generate
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {activeReportId && reportQuery.isLoading ? <InventoryLoading label="Generating report…" /> : null}

      {reportQuery.data ? (
        <div className={`${cardClass} p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={panelTitleClass}>{reportQuery.data.name}</span>
            <Badge tone={categoryTone(reportQuery.data.category)}>{reportQuery.data.category}</Badge>
            <span className={`text-xs ${mutedClass}`}>Generated {reportQuery.data.lastGenerated}</span>
            {reportQuery.data.filterDate ? (
              <span className={`text-xs ${mutedClass}`}>
                · Filtered {reportQuery.data.dateMode} {formatFilterDate(reportQuery.data.filterDate)}
              </span>
            ) : null}
          </div>
          <p className={`mt-1 text-xs ${mutedClass}`}>{reportQuery.data.description}</p>
          <div className="mt-3">
            <InventoryReportView report={reportQuery.data} />
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
              <button type="button" className={`text-xs ${linkWarningClass}`} onClick={() => runReport.mutate(r.id)}>
                Run
              </button>
            ),
          },
        ]}
        rows={INVENTORY_REPORTS}
      />
    </div>
  );
}
