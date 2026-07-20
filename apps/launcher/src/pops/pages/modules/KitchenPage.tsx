import { Button } from "@platform/ui";
import type { KitchenTicket } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchCompletedOrders } from "../../api/billing";
import {
  bumpKitchenPriority,
  fetchKitchenTickets,
  updateKitchenTicket,
} from "../../api/kitchen";
import { fetchPopsBranches } from "../../api/operations";
import { isMonitoringBranch, storeBranchCodes } from "../../lib/branchScope";
import { OrderDetailModal } from "../../components/OrderDetailModal";
import {
  buildUnifiedOrders,
  unifiedOrderRef,
  unifiedOrderStatusLabel,
  unifiedOrderStatusTone,
  unifiedOrderTable,
  unifiedOrderTotal,
  type UnifiedOrder,
} from "../../lib/orderHistory";
import { printKotDetailed, withPrinterProfile, type PrintTicketInput } from "../../lib/printTicket";
import { resolveKotPrinter } from "../../lib/printerRouting";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSearchInput,
  ModuleSegmentedControl,
  ModuleToolbar,
} from "../../ui/ModuleToolbar";
import { tableOrderRefClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { SimpleTable } from "../../ui/SimpleTable";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseItemsSummary(summary: string): { label: string; qty: number }[] {
  let items = summary;
  const deliveryIdx = items.indexOf(" · Delivery");
  if (deliveryIdx >= 0) items = items.slice(0, deliveryIdx);

  return items
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s+x(\d+)$/i);
      return match
        ? { label: match[1].trim(), qty: Number(match[2]) }
        : { label: part, qty: 1 };
    });
}

function ticketToPrint(
  ticket: KitchenTicket,
  branchName: string,
  branchCode: string,
): Omit<PrintTicketInput, "kind"> {
  const lines = parseItemsSummary(ticket.itemsSummary).map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: 0,
  }));

  return {
    branchName,
    branchCode,
    orderRef: ticket.orderRef ?? ticket.ticketRef,
    modeLabel: "Order",
    tableLabel: ticket.stationLabel,
    lines: lines.length > 0 ? lines : [{ label: ticket.itemsSummary || "Items", qty: 1, unitPrice: 0 }],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    total: 0,
    servicePct: 0,
    discountPct: 0,
  };
}

function isActiveKitchenOrder(order: UnifiedOrder): boolean {
  return order.source === "kitchen";
}

function isCompletedKitchenOrder(order: UnifiedOrder): boolean {
  return order.source === "bill";
}

function kitchenItemsSummary(order: UnifiedOrder): string {
  if (order.source === "kitchen") {
    return parseItemsSummary(order.ticket.itemsSummary)
      .map((line) => `${line.label} x${line.qty}`)
      .join(", ");
  }
  return order.bill.lines.map((line) => `${line.label} x${line.qty}`).join(", ");
}

export function KitchenPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "completed">("active");
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const monitoringView = isMonitoringBranch(branch?.code);

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches"],
    queryFn: () => fetchPopsBranches(),
    staleTime: 60_000,
  });

  const scopedBranchCodes = useMemo(
    () => storeBranchCodes(branch?.code, branchesQuery.data),
    [branch?.code, branchesQuery.data],
  );

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code, scopedBranchCodes],
    enabled: scopedBranchCodes.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(scopedBranchCodes.map((code) => fetchCompletedOrders(code)));
      return lists
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    refetchInterval: 5_000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["kitchen", branch?.code, scopedBranchCodes],
    enabled: scopedBranchCodes.length > 0,
    queryFn: async () => {
      const branchByTicketId = new Map<string, string>();
      const tickets: KitchenTicket[] = [];
      for (const code of scopedBranchCodes) {
        const rows = await fetchKitchenTickets(code);
        for (const row of rows) {
          branchByTicketId.set(row.id, code);
          tickets.push(row);
        }
      }
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { tickets, branchByTicketId };
    },
    refetchInterval: 5_000,
  });

  const kitchenTickets = ticketsQuery.data?.tickets ?? [];
  const ticketBranchById = ticketsQuery.data?.branchByTicketId ?? new Map<string, string>();

  const allOrders = useMemo(
    () => buildUnifiedOrders(ordersQuery.data ?? [], kitchenTickets),
    [ordersQuery.data, kitchenTickets],
  );

  const activeOrders = useMemo(() => allOrders.filter(isActiveKitchenOrder), [allOrders]);
  const completedOrders = useMemo(() => allOrders.filter(isCompletedKitchenOrder), [allOrders]);

  const sectionOrders = view === "active" ? activeOrders : completedOrders;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sectionOrders;
    return sectionOrders.filter((o) => {
      const ref = unifiedOrderRef(o).toLowerCase();
      const table = unifiedOrderTable(o).toLowerCase();
      const items = kitchenItemsSummary(o).toLowerCase();
      const extra =
        o.source === "bill"
          ? o.bill.billRef.toLowerCase()
          : o.ticket.ticketRef.toLowerCase();
      return ref.includes(q) || table.includes(q) || items.includes(q) || extra.includes(q);
    });
  }, [sectionOrders, search]);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateKitchenTicket(id, { status: "done" }),
    onSuccess: async () => {
      invalidate();
      await queryClient.refetchQueries({ queryKey: ["orders", branch?.code] });
      setSelectedOrder(null);
      setCompletingId(null);
      setView("completed");
      setNotice("Order completed and moved to Completed.");
    },
    onError: (err: Error) => {
      setCompletingId(null);
      setNotice(err.message);
    },
  });

  const bumpMutation = useMutation({
    mutationFn: () => {
      if (monitoringView) {
        throw new Error("Select a store branch (e.g. POPS Blue Area) to bump kitchen priority.");
      }
      return bumpKitchenPriority(branch!.code);
    },
    onSuccess: () => {
      invalidate();
      setNotice("Oldest ticket bumped to priority.");
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const isLoading = ordersQuery.isLoading || ticketsQuery.isLoading;
  const isError = ordersQuery.isError || ticketsQuery.isError;
  const errorMessage = (ordersQuery.error ?? ticketsQuery.error) as Error | null;

  if (!branch?.code) {
    return <p className="text-sm text-slate-500">Select a branch to view kitchen orders.</p>;
  }

  return (
    <div className="space-y-3">
      <ModuleToolbar
        title="Kitchen"
        trailing={
          <>
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                void ordersQuery.refetch();
                void ticketsQuery.refetch();
              }}
            >
              Refresh
            </Button>
            {view === "active" && !monitoringView ? (
              <Button
                type="button"
                className="h-8 px-2.5 text-xs"
                disabled={bumpMutation.isPending || activeOrders.length === 0}
                onClick={() => bumpMutation.mutate()}
              >
                Bump priority
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
      {isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage?.message ?? "Could not load orders."}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {notice}
        </p>
      ) : null}
      {monitoringView ? (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          Monitoring view — showing kitchen tickets from all store branches (including waiter mobile orders on{" "}
          <span className="font-mono text-sky-100">ISB-GT</span>). Use{" "}
          <span className="font-medium">Switch branch</span> to focus on one location.
        </p>
      ) : null}

      <ModuleFilterBar>
        <ModuleSegmentedControl
          value={view}
          onChange={setView}
          options={[
            { id: "active", label: `Active (${activeOrders.length})`, accent: true },
            { id: "completed", label: `Completed (${completedOrders.length})` },
          ]}
        />
        <ModuleSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search KOT, order, table, items…"
        />
        <ModuleCountBadge shown={filtered.length} total={sectionOrders.length} />
      </ModuleFilterBar>

      {filtered.length === 0 && !isLoading ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
          {view === "active"
            ? activeOrders.length === 0
              ? "No active orders. Send tickets from POS."
              : "No active orders match your search."
            : completedOrders.length === 0
              ? "No completed orders yet. Mark active orders as Completed."
              : "No completed orders match your search."}
        </p>
      ) : (
        <SimpleTable
          rowKey={(r) => r.id}
          rows={filtered}
          onRowClick={setSelectedOrder}
          columns={[
            {
              key: "ref",
              header: "Order",
              render: (r) => (
                <button
                  type="button"
                  className={tableOrderRefClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(r);
                  }}
                >
                  {unifiedOrderRef(r)}
                </button>
              ),
            },
            {
              key: "type",
              header: "Ref",
              render: (r) => (
                <span className="text-xs text-slate-500">
                  {r.source === "bill" ? r.bill.billRef : r.ticket.ticketRef}
                </span>
              ),
            },
            ...(monitoringView
              ? [
                  {
                    key: "branch",
                    header: "Branch",
                    render: (r: UnifiedOrder) => (
                      <span className="font-mono text-xs text-slate-400">
                        {r.source === "kitchen" ? (ticketBranchById.get(r.ticket.id) ?? "—") : "—"}
                      </span>
                    ),
                  },
                ]
              : []),
            {
              key: "stationLabel",
              header: "Table / station",
              render: (r) => unifiedOrderTable(r),
            },
            {
              key: "items",
              header: "Items",
              render: (r) => (
                <span className="line-clamp-2 max-w-xs text-slate-400" title={kitchenItemsSummary(r)}>
                  {kitchenItemsSummary(r)}
                </span>
              ),
            },
            {
              key: "wait",
              header: "Wait",
              render: (r) =>
                r.source === "kitchen" ? (
                  <span
                    className={
                      r.ticket.mins >= 20 ? "font-semibold text-red-300" : "tabular-nums text-slate-400"
                    }
                  >
                    {r.ticket.mins}m
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "total",
              header: "Total",
              render: (r) => {
                const total = unifiedOrderTotal(r);
                return total != null ? `Rs ${total.toLocaleString()}` : "—";
              },
            },
            {
              key: "createdAt",
              header: "Received",
              render: (r) => formatWhen(r.createdAt),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={unifiedOrderStatusTone(r)}>{unifiedOrderStatusLabel(r)}</Badge>
                  {r.source === "kitchen" && r.ticket.priority === "priority" ? (
                    <Badge tone="warning">Priority</Badge>
                  ) : null}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              id: "actions",
              render: (r) =>
                r.source === "kitchen" ? (
                  <span
                    className="flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <Button
                      type="button"
                      className="h-7 border-0 bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                      disabled={completeMutation.isPending}
                      onClick={() => {
                        setCompletingId(r.ticket.id);
                        completeMutation.mutate(r.ticket.id);
                      }}
                    >
                      {completeMutation.isPending && completingId === r.ticket.id ? "…" : "Completed"}
                    </Button>
                    <button
                      type="button"
                      className="text-[11px] text-amber-300 hover:text-amber-200"
                      onClick={() => {
                        void (async () => {
                          const base = ticketToPrint(r.ticket, branch.name, branch.code);
                          const profile = resolveKotPrinter(branch.code, null, undefined, "kitchen");
                          const result = await printKotDetailed(withPrinterProfile(base, profile));
                          setNotice(
                            result.ok
                              ? `KOT printed${profile?.systemPrinterName ? ` → ${profile.systemPrinterName}` : ""}.`
                              : `KOT print failed: ${result.error ?? "check printer assignment"}.`,
                          );
                        })();
                      }}
                    >
                      Print KOT
                    </button>
                  </span>
                ) : null,
            },
          ]}
        />
      )}

      {selectedOrder ? (
        <OrderDetailModal
          order={selectedOrder}
          branchName={branch.name}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}
    </div>
  );
}
