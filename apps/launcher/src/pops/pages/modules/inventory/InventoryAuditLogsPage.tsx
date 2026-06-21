import type { InventoryAuditLog } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchBranchInventory } from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess } from "../../../hooks/useInventory";
import { filterBarClass, mutedClass } from "../../../lib/themeClasses";
import { timeToMinutes } from "../../../lib/orderSales";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryLoading } from "./InventoryUi";

function auditLogDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function auditLogTime(timestamp: string): string {
  return timestamp.length >= 16 ? timestamp.slice(11, 16) : "00:00";
}

function matchesAuditTimeFilter(
  timestamp: string,
  filterDate: string,
  timeFrom: string,
  timeTo: string,
): boolean {
  if (filterDate && auditLogDate(timestamp) !== filterDate) return false;
  if (timeFrom || timeTo) {
    const mins = timeToMinutes(auditLogTime(timestamp));
    if (timeFrom && mins < timeToMinutes(timeFrom)) return false;
    if (timeTo && mins > timeToMinutes(timeTo)) return false;
  }
  return true;
}

export function InventoryAuditLogsPage(): JSX.Element {
  const { branch } = useInventoryAccess();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeFrom, setFilterTimeFrom] = useState("");
  const [filterTimeTo, setFilterTimeTo] = useState("");

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 20_000,
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const logs = useMemo(() => {
    const all = query.data?.auditLogs ?? [];
    return all.filter((l) => {
      const matchSearch =
        !search ||
        l.user.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.detail.toLowerCase().includes(search.toLowerCase());
      const matchModule = !moduleFilter || l.module === moduleFilter;
      const matchTime = matchesAuditTimeFilter(l.timestamp, filterDate, filterTimeFrom, filterTimeTo);
      return matchSearch && matchModule && matchTime;
    });
  }, [query.data?.auditLogs, search, moduleFilter, filterDate, filterTimeFrom, filterTimeTo]);

  const modules = useMemo(() => {
    const set = new Set((query.data?.auditLogs ?? []).map((l) => l.module));
    return Array.from(set).sort();
  }, [query.data?.auditLogs]);

  const hasTimeFilters = Boolean(filterDate || filterTimeFrom || filterTimeTo);

  function clearTimeFilters(): void {
    setFilterDate("");
    setFilterTimeFrom("");
    setFilterTimeTo("");
  }

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Audit logs" subtitle="Track receiving, deductions, adjustments, waste, and approvals." />

      <div className={filterBarClass}>
        <input
          placeholder="Search user or action…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`min-w-[10rem] flex-1 sm:max-w-xs ${inputClass}`}
        />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={selectClass}>
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className={inputClass}
          aria-label="Filter by date"
        />
        <input
          type="time"
          value={filterTimeFrom}
          onChange={(e) => setFilterTimeFrom(e.target.value)}
          className={inputClass}
          aria-label="From time"
        />
        <span className={`hidden self-center text-xs sm:inline ${mutedClass}`}>to</span>
        <input
          type="time"
          value={filterTimeTo}
          onChange={(e) => setFilterTimeTo(e.target.value)}
          className={inputClass}
          aria-label="To time"
        />
        {hasTimeFilters ? (
          <button
            type="button"
            onClick={clearTimeFilters}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
          >
            Clear dates
          </button>
        ) : null}
      </div>

      {hasTimeFilters ? (
        <p className={`text-xs ${mutedClass}`}>
          Showing {logs.length} log{logs.length === 1 ? "" : "s"}
          {filterDate ? ` on ${filterDate}` : ""}
          {filterTimeFrom || filterTimeTo
            ? ` between ${filterTimeFrom || "00:00"} and ${filterTimeTo || "23:59"}`
            : ""}
        </p>
      ) : null}

      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">
          {query.data?.auditLogs.length
            ? "No audit logs match the current filters."
            : "No audit logs yet. Actions across inventory modules will appear here."}
        </p>
      ) : (
        <SimpleTable<InventoryAuditLog>
          rowKey={(r) => r.id}
          columns={[
            { key: "timestamp", header: "Time" },
            { key: "user", header: "User" },
            { key: "action", header: "Action" },
            { key: "module", header: "Module", render: (r) => <Badge tone="info">{r.module}</Badge> },
            { key: "detail", header: "Detail" },
          ]}
          rows={logs}
        />
      )}
    </div>
  );
}
