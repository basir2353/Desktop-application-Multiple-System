import type { StockBatch } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchBranchInventory } from "../../../api/inventory";
import { formatPkr, inputClass, useInventoryAccess } from "../../../hooks/useInventory";
import { accentValueClass, linkActionClass, mutedClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSegmentedControl,
} from "../../../ui/ModuleToolbar";
import { InventoryError, InventoryLoading } from "./InventoryUi";

type DateFilterMode = "expiry" | "received";

function expiryStatus(expiry: string | null): { label: string; tone: "success" | "warning" | "danger" } {
  if (!expiry) return { label: "—", tone: "success" };
  const days = (new Date(`${expiry}T12:00:00`).getTime() - Date.now()) / 86400000;
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days <= 7) return { label: "Expiring soon", tone: "warning" };
  return { label: "OK", tone: "success" };
}

function formatBatchDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchesDateFilter(batch: StockBatch, mode: DateFilterMode, filterDate: string): boolean {
  const value = mode === "expiry" ? batch.expiry : batch.receivedDate;
  return value === filterDate;
}

export function StockManagementPage(): JSX.Element {
  const { branch } = useInventoryAccess();
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("expiry");

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 15_000,
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const batches = query.data?.stockBatches ?? [];
  const filteredBatches = useMemo(() => {
    if (!filterDate) return batches;
    return batches.filter((b) => matchesDateFilter(b, dateFilterMode, filterDate));
  }, [batches, filterDate, dateFilterMode]);

  const totalValue = useMemo(
    () => filteredBatches.reduce((s, b) => s + b.qty * b.unitCost, 0),
    [filteredBatches],
  );
  const expiring = useMemo(
    () => filteredBatches.filter((b) => expiryStatus(b.expiry).tone !== "success").length,
    [filteredBatches],
  );

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Stock management" subtitle="Current inventory by batch, location, and expiry." />

      <div className="grid gap-3 sm:grid-cols-3">
        <div data-ui="dashboard-stat-card">
          <div className="dashboard-stat-label">Total batches</div>
          <div className="dashboard-stat-value text-xl">{filteredBatches.length}</div>
        </div>
        <div data-ui="dashboard-stat-card">
          <div className="dashboard-stat-label">Stock value</div>
          <div className="dashboard-stat-value text-xl">{formatPkr(totalValue)}</div>
        </div>
        <div data-ui="dashboard-stat-card">
          <div className="dashboard-stat-label">Expiring within 7 days</div>
          <div className={`text-xl font-semibold ${accentValueClass}`}>{expiring}</div>
        </div>
      </div>

      <ModuleFilterBar>
        <ModuleSegmentedControl
          value={dateFilterMode}
          onChange={setDateFilterMode}
          options={[
            { id: "expiry", label: "Expiry" },
            { id: "received", label: "Received" },
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
        <ModuleCountBadge shown={filteredBatches.length} total={batches.length} />
      </ModuleFilterBar>

      <SimpleTable<StockBatch>
        rowKey={(r) => r.id}
        columns={[
          { key: "sku", header: "SKU" },
          { key: "name", header: "Ingredient" },
          {
            key: "qty",
            header: "On hand",
            render: (r) => (
              <span className={r.qty === 0 ? "font-medium text-red-700 dark:text-red-300" : ""}>
                {r.qty} {r.unit}
              </span>
            ),
          },
          { key: "location", header: "Location" },
          { key: "batch", header: "Batch", render: (r) => r.batch ?? "—" },
          {
            key: "receivedDate",
            header: "Received",
            render: (r) => <span className={mutedClass}>{formatBatchDate(r.receivedDate)}</span>,
          },
          {
            key: "expiry",
            header: "Expiry",
            render: (r) => <span className={mutedClass}>{formatBatchDate(r.expiry)}</span>,
          },
          {
            id: "expiryStatus",
            key: "expiry",
            header: "Status",
            render: (r) => {
              const s = expiryStatus(r.expiry);
              return s.label === "—" ? "—" : <Badge tone={s.tone}>{s.label}</Badge>;
            },
          },
          { key: "unitCost", header: "Unit cost", render: (r) => formatPkr(r.unitCost) },
        ]}
        rows={filteredBatches}
      />
    </div>
  );
}
