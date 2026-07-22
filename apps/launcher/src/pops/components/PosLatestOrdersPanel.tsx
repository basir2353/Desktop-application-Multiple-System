import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import {
  canChangePosRecentOrderTable,
  canEditPosRecentOrder,
  dismissPosOrder,
  filterDismissedPosOrders,
  filterPosRecentOrders,
  formatRecentOrderTime,
  posRecentOrderTotal,
  POS_RECENT_ORDERS_PREVIEW_LIMIT,
  type PosRecentOrder,
  type PosRecentOrderModeFilter,
} from "../lib/recentOrders";
import { updateKitchenTicket } from "../api/kitchen";
import { removeOfflineKot } from "../lib/popsOfflineOrders";
import { printPosRecentOrderAsync } from "../lib/printTicket";
import { resolveKotPrinter, resolveReceiptPrinter } from "../lib/printerRouting";
import { getWaiterPrinter } from "../lib/waiterPrinterSettings";
import { useSessionStore } from "../../stores/sessionStore";
import { POS_ORDER_MODES, formatPosStationDisplay } from "../lib/posOrderMode";
import { usePopsStore } from "../../stores/popsStore";
import { loadPosSettings } from "../lib/posSettings";
import {
  loadPosOrderModeVisibility,
  POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT,
} from "../lib/posOrderModeVisibility";
import { PosOrderDetailModal } from "./PosOrderDetailModal";
import { ChangeOrderTableModal } from "./ChangeOrderTableModal";

type Props = {
  orders: PosRecentOrder[];
  isLoading: boolean;
  isError: boolean;
  onEdit?: (order: PosRecentOrder) => void;
  onPayOrder?: (order: PosRecentOrder) => void;
};

function statusDotClass(tone: PosRecentOrder["statusTone"]): string {
  if (tone === "warning") return "bg-amber-400";
  if (tone === "success") return "bg-emerald-400";
  if (tone === "info") return "bg-sky-400";
  return "bg-slate-500";
}

export function PosLatestOrdersPanel({ orders, isLoading, isError, onEdit, onPayOrder }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const posSettings = useMemo(() => loadPosSettings(branch?.code), [branch?.code]);
  const canManageTables = displayRole === "admin" || displayRole === "manager";

  const [orderModeVisibility, setOrderModeVisibility] = useState(() =>
    loadPosOrderModeVisibility(branch?.code),
  );

  useEffect(() => {
    setOrderModeVisibility(loadPosOrderModeVisibility(branch?.code));
  }, [branch?.code]);

  useEffect(() => {
    function onOrderModeVisibilityChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setOrderModeVisibility(loadPosOrderModeVisibility(branch?.code));
      }
    }
    window.addEventListener(POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT, onOrderModeVisibilityChanged);
    return () =>
      window.removeEventListener(POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT, onOrderModeVisibilityChanged);
  }, [branch?.code]);

  const visibleFilterModes = useMemo(
    () =>
      POS_ORDER_MODES.filter((m) => {
        if (m.id === "online") return orderModeVisibility.onlineEnabled;
        if (m.id === "foodpanda") return orderModeVisibility.foodpandaEnabled;
        if (m.id === "staff-food") return orderModeVisibility.staffFoodEnabled;
        return true;
      }),
    [orderModeVisibility],
  );

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<PosRecentOrderModeFilter>("all");

  useEffect(() => {
    if (
      modeFilter !== "all" &&
      modeFilter !== "Paid" &&
      !visibleFilterModes.some((m) => m.label === modeFilter)
    ) {
      setModeFilter("all");
    }
  }, [visibleFilterModes, modeFilter]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<PosRecentOrder | null>(null);
  const [changeTableOrder, setChangeTableOrder] = useState<PosRecentOrder | null>(null);
  const [dismissedRevision, setDismissedRevision] = useState(0);
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const visibleOrders = useMemo(() => {
    if (!branch?.code) return orders;
    void dismissedRevision;
    return filterDismissedPosOrders(orders, branch.code);
  }, [orders, branch?.code, dismissedRevision]);

  const isSearching = search.trim().length > 0;
  const isModeFiltered = modeFilter !== "all";
  const isExpandedList = isSearching || isModeFiltered;
  const displayedOrders = useMemo(() => {
    const matches = filterPosRecentOrders(visibleOrders, search, modeFilter);
    return isExpandedList ? matches : matches.slice(0, POS_RECENT_ORDERS_PREVIEW_LIMIT);
  }, [visibleOrders, search, modeFilter, isExpandedList]);

  const closeOrderMutation = useMutation({
    mutationFn: async (order: PosRecentOrder) => {
      // Always hide from Latest orders immediately (local dismiss).
      if (branch?.code) dismissPosOrder(branch.code, order.id);

      if (order.kind === "pending" && order.pendingTicket) {
        const ticketId = order.pendingTicket.id;
        // Offline / local-only tickets never exist on the API.
        try {
          removeOfflineKot(ticketId);
        } catch {
          /* ignore */
        }
        try {
          await updateKitchenTicket(ticketId, { status: "done", recordAsCancellation: true });
        } catch {
          // Still closed in the panel via dismiss — API may be old / offline.
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kitchen", branch?.code] });
      void queryClient.invalidateQueries({ queryKey: ["kitchen", "cancellations"] });
      void queryClient.invalidateQueries({ queryKey: ["orders", branch?.code] });
      void queryClient.invalidateQueries({ queryKey: ["tables", branch?.code] });
      setDismissedRevision((n) => n + 1);
      setSelectedId(null);
    },
    onError: () => {
      // Dismiss already applied — refresh UI filter.
      setDismissedRevision((n) => n + 1);
      setSelectedId(null);
    },
  });

  function printOrder(order: PosRecentOrder, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!branch) return;
    void (async () => {
      const sessionUserId = useSessionStore.getState().claims?.sub;
      const isReceipt = order.kind === "paid" && order.bill != null;
      const profile = isReceipt
        ? resolveReceiptPrinter(branch.code, order.bill?.waiterId ?? sessionUserId)
        : resolveKotPrinter(branch.code, null, sessionUserId, "kitchen");
      const assigned =
        order.bill?.waiterId != null ? getWaiterPrinter(branch.code, order.bill.waiterId) : null;
      await printPosRecentOrderAsync(branch.name, branch.code, order, {
        printerName: profile?.name ?? assigned?.printerName,
        systemPrinterName: profile?.systemPrinterName ?? assigned?.systemPrinterName,
      });
    })();
  }

  function toggleSelected(order: PosRecentOrder): void {
    setSelectedId((current) => (current === order.id ? null : order.id));
  }

  function closeOrder(order: PosRecentOrder, event?: MouseEvent): void {
    event?.stopPropagation();
    // Hide card right away — mutation also persists dismiss + marks ticket done.
    if (branch?.code) dismissPosOrder(branch.code, order.id);
    setDismissedRevision((n) => n + 1);
    setSelectedId(null);
    closeOrderMutation.mutate(order);
  }

  function handleOrderDoubleClick(order: PosRecentOrder, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    onPayOrder?.(order);
  }

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col rounded-lg border border-slate-800/80 bg-slate-900/50">
        <div className="shrink-0 border-b border-slate-800 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-200">Latest orders</div>
              <div className="mt-0.5 text-[10px] text-slate-500">Tap for actions · double-click to pay</div>
            </div>
            <Link
              to="../orders"
              className="shrink-0 text-[10px] font-medium text-amber-400 hover:text-amber-300"
            >
              View all
            </Link>
          </div>

          <div className="relative mt-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders…"
              className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-7 pr-2 text-[11px] text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40"
            />
            <span
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden
            >
              ⌕
            </span>
            {isSearching ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-[10px] text-slate-500 hover:text-white"
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>

          <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto rounded-md border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={(e) => {
                setModeFilter("all");
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
              }}
              className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium transition ${
                modeFilter === "all" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            {visibleFilterModes.map(({ label }) => (
              <button
                key={label}
                type="button"
                onClick={(e) => {
                  setModeFilter(label);
                  e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                }}
                className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium transition ${
                  modeFilter === label ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={(e) => {
                setModeFilter("Paid");
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
              }}
              className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium transition ${
                modeFilter === "Paid" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Paid
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="px-1 py-3 text-xs text-slate-500">Loading orders…</p>
          ) : isError ? (
            <p className="px-1 py-3 text-xs text-red-300/80">Could not load orders.</p>
          ) : visibleOrders.length === 0 ? (
            <p className="px-1 py-3 text-xs text-slate-500">
              {orders.length > 0 ? "All orders closed. New orders will appear here." : "No orders yet. Create one from the ticket panel."}
            </p>
          ) : displayedOrders.length === 0 ? (
            <p className="px-1 py-3 text-xs text-slate-500">
              {isSearching && isModeFiltered
                ? `No ${modeFilter.toLowerCase()} orders match “${search.trim()}”.`
                : isSearching
                  ? `No orders match “${search.trim()}”.`
                  : `No ${modeFilter.toLowerCase()} orders yet.`}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-1">
              {displayedOrders.map((order) => {
                const isSelected = selectedId === order.id;
                const orderTotal = posRecentOrderTotal(order, posSettings);
                const showChangeTable =
                  canManageTables && canChangePosRecentOrderTable(order) && Boolean(branch?.code);
                const showEdit = Boolean(onEdit) && canEditPosRecentOrder(order);

                return (
                  <li key={order.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSelected(order)}
                      onDoubleClick={(e) => handleOrderDoubleClick(order, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelected(order);
                        }
                      }}
                      className={[
                        "flex h-full flex-col rounded-lg border bg-slate-950/50 p-1.5 transition",
                        isSelected
                          ? "border-amber-500/50 ring-1 ring-amber-500/20"
                          : "border-slate-800/70 hover:border-slate-700",
                      ].join(" ")}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-sm font-bold leading-tight text-white">
                            {order.ref}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded px-0.5 text-[10px] leading-none text-slate-500 transition hover:bg-slate-800 hover:text-red-400"
                            onClick={(e) => closeOrder(order, e)}
                            disabled={closeOrderMutation.isPending}
                            aria-label="Close order"
                            title="Close order"
                          >
                            ✕
                          </button>
                        </div>
                        <span className="block text-[8px] text-slate-500">
                          {formatRecentOrderTime(order.createdAt)}
                        </span>
                      </div>

                      <div className="mt-1">
                        {orderTotal != null ? (
                          <p className="text-[11px] font-bold tabular-nums leading-none text-emerald-400">
                            {orderTotal.toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-[10px] font-medium text-slate-600">—</p>
                        )}
                      </div>

                      <div className="mt-1 flex min-w-0 items-center gap-1 text-[8px]">
                        <span className="inline-flex min-w-0 items-center gap-0.5 truncate text-slate-300">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(order.statusTone)}`}
                            aria-hidden
                          />
                          <span className="truncate">{order.statusLabel}</span>
                        </span>
                        <span className="shrink-0 text-slate-600">·</span>
                        <span className="truncate text-slate-400">{order.orderMode}</span>
                      </div>

                      <p className="mt-1 truncate text-sm font-semibold leading-tight text-slate-200">
                        {formatPosStationDisplay(order.stationLabel, order.orderMode)}
                      </p>

                      <div className="mt-1.5 border-t border-slate-800/80 pt-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="flex-1 rounded border border-slate-700 py-0.5 text-[9px] font-medium text-amber-400 transition hover:border-amber-500/40 hover:bg-amber-500/10"
                            onClick={(e) => printOrder(order, e)}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded border border-slate-700 py-0.5 text-[9px] font-medium text-slate-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                            onClick={(e) => closeOrder(order, e)}
                            disabled={closeOrderMutation.isPending}
                          >
                            Close
                          </button>
                        </div>

                        {isSelected ? (
                          <div className="mt-1 flex gap-1">
                            <button
                              type="button"
                              className="flex-1 rounded border border-slate-700 py-1 text-[9px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewOrder(order);
                              }}
                            >
                              View
                            </button>
                            {showEdit ? (
                              <button
                                type="button"
                                className="flex-1 rounded border border-slate-700 py-1 text-[9px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit?.(order);
                                }}
                              >
                                Edit
                              </button>
                            ) : null}
                            {showChangeTable ? (
                              <button
                                type="button"
                                className="flex-1 rounded border border-slate-700 py-1 text-[9px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChangeTableOrder(order);
                                }}
                              >
                                Table
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!isExpandedList && visibleOrders.length > POS_RECENT_ORDERS_PREVIEW_LIMIT ? (
            <p className="mt-2 px-1 text-center text-[10px] text-slate-600">
              Showing latest {POS_RECENT_ORDERS_PREVIEW_LIMIT} · search or filter to find more
            </p>
          ) : null}
          {isExpandedList && displayedOrders.length > 0 ? (
            <p className="mt-2 px-1 text-center text-[10px] text-slate-600">
              {displayedOrders.length} {modeFilter !== "all" ? modeFilter.toLowerCase() : ""} order
              {displayedOrders.length === 1 ? "" : "s"}
              {isSearching ? ` matching “${search.trim()}”` : ""}
            </p>
          ) : null}
        </div>
      </aside>

      {viewOrder ? <PosOrderDetailModal order={viewOrder} onClose={() => setViewOrder(null)} /> : null}

      {changeTableOrder?.pendingTicket && branch?.code ? (
        <ChangeOrderTableModal
          ticket={changeTableOrder.pendingTicket}
          branchCode={branch.code}
          onClose={() => setChangeTableOrder(null)}
          onSuccess={() => setChangeTableOrder(null)}
        />
      ) : null}
    </>
  );
}
