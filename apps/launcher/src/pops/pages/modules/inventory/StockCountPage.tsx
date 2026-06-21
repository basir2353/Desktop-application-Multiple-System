import { STOCK_COUNT_TYPES, type StockCount } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createStockCount, completeStockCount, fetchBranchInventory } from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { accentValueClass, linkActionClass, linkSuccessClass, mutedClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSegmentedControl,
} from "../../../ui/ModuleToolbar";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

type DateFilterMode = "count" | "started";

function formatCountDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchesDateFilter(count: StockCount, mode: DateFilterMode, filterDate: string): boolean {
  const value = mode === "count" ? count.date : count.startedDate;
  return value === filterDate;
}

export function StockCountPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [countType, setCountType] = useState<(typeof STOCK_COUNT_TYPES)[number]>("Daily");
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("count");

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () => createStockCount({ branchCode: branch!.code, type: countType }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: (countId: string) => completeStockCount(countId, true),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const counts = query.data?.stockCounts ?? [];
  const filteredCounts = useMemo(() => {
    if (!filterDate) return counts;
    return counts.filter((c) => matchesDateFilter(c, dateFilterMode, filterDate));
  }, [counts, filterDate, dateFilterMode]);

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Stock count" subtitle="Physical count → compare system stock → variance → adjustment." />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="Start stock count" submitLabel="Start count" onSubmit={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <select className={selectClass} value={countType} onChange={(e) => setCountType(e.target.value as typeof countType)}>
            {STOCK_COUNT_TYPES.map((t) => <option key={t} value={t}>{t} count</option>)}
          </select>
        </InventoryFormPanel>
      ) : null}

      <ModuleFilterBar>
        <ModuleSegmentedControl
          value={dateFilterMode}
          onChange={setDateFilterMode}
          options={[
            { id: "count", label: "Count date" },
            { id: "started", label: "Started" },
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
        <ModuleCountBadge shown={filteredCounts.length} total={counts.length} />
      </ModuleFilterBar>

      <SimpleTable<StockCount>
        rowKey={(r) => r.id}
        columns={[
          { key: "countNumber", header: "Count #" },
          { key: "type", header: "Type" },
          {
            key: "date",
            header: "Count date",
            render: (r) => <span className={mutedClass}>{formatCountDate(r.date)}</span>,
          },
          {
            key: "startedDate",
            header: "Started",
            render: (r) => <span className={mutedClass}>{formatCountDate(r.startedDate)}</span>,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge tone={r.status === "Completed" ? "success" : r.status === "In Progress" ? "info" : "warning"}>
                {r.status}
              </Badge>
            ),
          },
          { key: "itemsCounted", header: "Items" },
          {
            key: "variances",
            header: "Variances",
            render: (r) => (
              <span className={r.variances > 0 ? accentValueClass : ""}>{r.variances}</span>
            ),
          },
          { key: "conductedBy", header: "By", render: (r) => r.conductedBy ?? "—" },
          ...(canManage ? [{
            id: "actions",
            key: "id" as const,
            header: "",
            render: (r: StockCount) =>
              r.status === "In Progress" ? (
                <button type="button" className={`text-xs ${linkSuccessClass}`} onClick={() => completeMutation.mutate(r.id)}>Complete & adjust</button>
              ) : null,
          }] : []),
        ]}
        rows={filteredCounts}
      />
    </div>
  );
}
