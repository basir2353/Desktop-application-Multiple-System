import { Button } from "@platform/ui";
import type { KitchenTicket } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAdaptiveRefetchInterval } from "../../../lib/useAdaptiveRefetchInterval";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchCompletedOrders } from "../../api/billing";
import {
  bumpKitchenPriority,
  fetchCompletedKitchenTickets,
  fetchKitchenTickets,
  updateKitchenTicket,
} from "../../api/kitchen";
import { fetchPopsBranches } from "../../api/operations";
import { fetchOrgUsers } from "../../api/users";
import { isMonitoringBranch, kitchenBranchCodes, storeBranchCodes } from "../../lib/branchScope";
import {
  cacheKitchenCompleted,
  loadCachedKitchenCompleted,
  pruneCachedKitchenCompleted,
} from "../../lib/kitchenCompletedCache";
import { OrderDetailModal } from "../../components/OrderDetailModal";
import {
  kitchenActiveOrders,
  kitchenCompletedOrders,
  unifiedOrderRef,
  unifiedOrderStatusLabel,
  unifiedOrderStatusTone,
  unifiedOrderTable,
  unifiedOrderTotal,
  type UnifiedOrder,
} from "../../lib/orderHistory";
import {
  formatSessionPrintName,
  printKotDetailed,
  withPrinterProfile,
  type PrintTicketInput,
} from "../../lib/printTicket";
import { resolveKotPrinter } from "../../lib/printerRouting";
import { useSessionStore } from "../../../stores/sessionStore";
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
  printedByName?: string,
): Omit<PrintTicketInput, "kind"> {
  const lines = parseItemsSummary(ticket.itemsSummary).map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: 0,
  }));
  const by = printedByName?.trim() || ticket.createdByName?.trim() || undefined;

  return {
    branchName,
    branchCode,
    orderRef: ticket.orderRef ?? ticket.ticketRef,
    modeLabel: "Order",
    tableLabel: ticket.stationLabel,
    waiterName: by,
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
  const livePollMs = useAdaptiveRefetchInterval(5_000);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "completed">("active");
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completedBump, setCompletedBump] = useState(0);
  const monitoringView = isMonitoringBranch(branch?.code);

  // Warm UUID→name cache so KOT "By" shows staff name, not user id.
  useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
    staleTime: 5 * 60_000,
  });

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches"],
    queryFn: () => fetchPopsBranches(),
    staleTime: 60_000,
  });

  const scopedBranchCodes = useMemo(
    () => storeBranchCodes(branch?.code, branchesQuery.data),
    [branch?.code, branchesQuery.data],
  );

  const kitchenBranchScope = useMemo(
    () => kitchenBranchCodes(branch?.code, branchesQuery.data),
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
    refetchInterval: livePollMs,
  });

  const ticketsQuery = useQuery({
    queryKey: ["kitchen", "active", branch?.code, kitchenBranchScope],
    enabled: kitchenBranchScope.length > 0,
    queryFn: async () => {
      const branchByTicketId = new Map<string, string>();
      const tickets: KitchenTicket[] = [];
      for (const code of kitchenBranchScope) {
        const rows = await fetchKitchenTickets(code);
        for (const row of rows) {
          branchByTicketId.set(row.id, code);
          tickets.push(row);
        }
      }
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { tickets, branchByTicketId };
    },
    refetchInterval: livePollMs,
  });

  const doneTicketsQuery = useQuery({
    queryKey: ["kitchen", "done", branch?.code, kitchenBranchScope],
    enabled: kitchenBranchScope.length > 0,
    queryFn: async () => {
      const branchByTicketId = new Map<string, string>();
      const tickets: KitchenTicket[] = [];
      for (const code of kitchenBranchScope) {
        const rows = await fetchCompletedKitchenTickets(code);
        for (const row of rows) {
          branchByTicketId.set(row.id, code);
          tickets.push(row);
        }
      }
      pruneCachedKitchenCompleted(new Set(tickets.map((t) => t.id)));
      const cached = loadCachedKitchenCompleted(kitchenBranchScope);
      const remoteIds = new Set(tickets.map((t) => t.id));
      for (const row of cached) {
        if (!remoteIds.has(row.id)) {
          tickets.push(row);
        }
      }
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { tickets, branchByTicketId };
    },
    refetchInterval: livePollMs,
  });

  const kitchenTickets = ticketsQuery.data?.tickets ?? [];
  const ticketBranchById = ticketsQuery.data?.branchByTicketId ?? new Map<string, string>();
  const doneTicketBranchById = doneTicketsQuery.data?.branchByTicketId ?? ticketBranchById;

  const activeOrders = useMemo(() => kitchenActiveOrders(kitchenTickets), [kitchenTickets]);

  const completedOrders = useMemo(() => {
    const doneTickets = doneTicketsQuery.data?.tickets ?? [];
    const cachedOnly = loadCachedKitchenCompleted(kitchenBranchScope);
    const mergedDone = [...doneTickets];
    const seen = new Set(doneTickets.map((t) => t.id));
    for (const row of cachedOnly) {
      if (!seen.has(row.id)) mergedDone.push(row);
    }
    return kitchenCompletedOrders(ordersQuery.data ?? [], mergedDone, kitchenTickets);
  }, [ordersQuery.data, doneTicketsQuery.data, kitchenBranchScope, kitchenTickets, completedBump]);

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
    mutationFn: async ({ id, ticket, branchCode }: { id: string; ticket: KitchenTicket; branchCode: string }) => {
      const updated = await updateKitchenTicket(id, { status: "done" });
      cacheKitchenCompleted(updated, branchCode);
      return { updated, branchCode };
    },
    onMutate: async ({ id, ticket, branchCode }) => {
      const doneTicket: KitchenTicket = { ...ticket, status: "done" };
      cacheKitchenCompleted(doneTicket, branchCode);

      const activeKey = ["kitchen", "active", branch?.code, kitchenBranchScope] as const;
      const doneKey = ["kitchen", "done", branch?.code, kitchenBranchScope] as const;

      await queryClient.cancelQueries({ queryKey: activeKey });
      await queryClient.cancelQueries({ queryKey: doneKey });

      const prevActive = queryClient.getQueryData<{
        tickets: KitchenTicket[];
        branchByTicketId: Map<string, string>;
      }>(activeKey);
      const prevDone = queryClient.getQueryData<{
        tickets: KitchenTicket[];
        branchByTicketId: Map<string, string>;
      }>(doneKey);

      queryClient.setQueryData(activeKey, (old) => {
        if (!old) return old;
        return {
          tickets: old.tickets.filter((row) => row.id !== id),
          branchByTicketId: old.branchByTicketId,
        };
      });

      queryClient.setQueryData(doneKey, (old) => {
        const branchByTicketId = new Map(old?.branchByTicketId ?? []);
        branchByTicketId.set(id, branchCode);
        const tickets = [doneTicket, ...(old?.tickets ?? []).filter((row) => row.id !== id)];
        return { tickets, branchByTicketId };
      });

      setCompletedBump((n) => n + 1);

      return { prevActive, prevDone };
    },
    onSuccess: async () => {
      invalidate();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["kitchen", "active"] }),
        queryClient.refetchQueries({ queryKey: ["kitchen", "done"] }),
        queryClient.refetchQueries({ queryKey: ["orders", branch?.code] }),
      ]);
      setSelectedOrder(null);
      setCompletingId(null);
      setView("completed");
      setNotice("Order completed and moved to Completed.");
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevActive) {
        queryClient.setQueryData(
          ["kitchen", "active", branch?.code, kitchenBranchScope],
          context.prevActive,
        );
      }
      if (context?.prevDone) {
        queryClient.setQueryData(
          ["kitchen", "done", branch?.code, kitchenBranchScope],
          context.prevDone,
        );
      }
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

  const isLoading = ordersQuery.isLoading || ticketsQuery.isLoading || doneTicketsQuery.isLoading;
  const isError = ordersQuery.isError || ticketsQuery.isError || doneTicketsQuery.isError;
  const errorMessage = (ordersQuery.error ?? ticketsQuery.error ?? doneTicketsQuery.error) as Error | null;

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
                void doneTicketsQuery.refetch();
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
                        {r.source === "kitchen"
                          ? (view === "completed"
                              ? doneTicketBranchById.get(r.ticket.id)
                              : ticketBranchById.get(r.ticket.id)) ?? "—"
                          : "—"}
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
                r.source === "kitchen" && view === "active" ? (
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
                        completeMutation.mutate({
                          id: r.ticket.id,
                          ticket: r.ticket,
                          branchCode: ticketBranchById.get(r.ticket.id) ?? branch!.code,
                        });
                      }}
                    >
                      {completeMutation.isPending && completingId === r.ticket.id ? "…" : "Completed"}
                    </Button>
                    <button
                      type="button"
                      className="text-[11px] text-amber-300 hover:text-amber-200"
                      onClick={() => {
                        void (async () => {
                          const actorId = useSessionStore.getState().claims?.sub;
                          const printedBy = formatSessionPrintName(actorId);
                          const base = ticketToPrint(r.ticket, branch.name, branch.code, printedBy);
                          const profile = resolveKotPrinter(branch.code, null, actorId, "kitchen");
                          const result = await printKotDetailed(withPrinterProfile(base, profile));
                          setNotice(
                            result.ok
                              ? `KOT printed${profile?.systemPrinterName ? ` → ${profile.systemPrinterName}` : profile?.name ? ` → ${profile.name}` : ""}.`
                              : `KOT print failed: ${result.error ?? "assign a kitchen printer to this user in Printer settings"}.`,
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
