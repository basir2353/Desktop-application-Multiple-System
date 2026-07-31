import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import {
  canChangePosRecentOrderTable,
  canEditPosRecentOrder,
  canPayPosRecentOrder,
  dismissPosOrder,
  filterDismissedPosOrders,
  filterPosRecentOrders,
  formatRecentOrderTime,
  isPaidPosRecentOrder,
  posRecentOrderTotal,
  POS_RECENT_ORDERS_PREVIEW_LIMIT,
  withClosedPosOrderStatus,
  type PosRecentOrder,
  type PosRecentOrderModeFilter,
} from "../lib/recentOrders";
import { updateKitchenTicket } from "../api/kitchen";
import { removeOfflineKot } from "../lib/popsOfflineOrders";
import {
  posRecentOrderToReceiptPrint,
  billToPrintInput,
  printReceiptAsync,
  resolveSessionPrintName,
  type PrintTicketInput,
} from "../lib/printTicket";
import { asPrinterName } from "../lib/asPrinterName";
import { resolvePraFooterForPaidBill } from "../lib/praPaidPrint";
import {
  canEmbedPraOnSlip,
  canShowRpraForBill,
  checkRealPraConnected,
  issuePraForBill,
  praIssuedNotice,
  REAL_PRA_NOT_CONNECTED_MSG,
} from "../lib/praIssueFlow";
import { preparePraReceiptFooter } from "../lib/praReceiptFooter";
import {
  isPraFakeEnabled,
  isPraRealEnabled,
  useTaxAuthorityFeatures,
} from "../hooks/useTaxAuthorityFeatures";
import { resolveReceiptPrinter, resolvePrintUserId } from "../lib/printerRouting";
import { getWaiterPrinter } from "../lib/waiterPrinterSettings";
import { loadBillPrintSettings } from "../lib/billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "../lib/billReceiptTemplateAssignments";
import { fetchCompletedOrders } from "../api/billing";
import { useSessionStore } from "../../stores/sessionStore";
import { POS_ORDER_MODES, formatPosStationDisplay } from "../lib/posOrderMode";
import { usePopsStore } from "../../stores/popsStore";
import { sessionCanManageFloor } from "../lib/roleAccess";
import { loadPosSettings } from "../lib/posSettings";
import {
  loadPosOrderModeVisibility,
  POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT,
} from "../lib/posOrderModeVisibility";
import { PosOrderDetailModal } from "./PosOrderDetailModal";
import { ChangeOrderTableModal } from "./ChangeOrderTableModal";
import { ReceiptPrintPreviewModal } from "./ReceiptPrintPreviewModal";

type Props = {
  orders: PosRecentOrder[];
  isLoading: boolean;
  isError: boolean;
  onEdit?: (order: PosRecentOrder) => void;
  onPayOrder?: (order: PosRecentOrder) => void;
  onNotice?: (message: string, tone?: "success" | "error") => void;
};

function statusDotClass(tone: PosRecentOrder["statusTone"]): string {
  if (tone === "warning") return "bg-amber-400";
  if (tone === "success") return "bg-emerald-400";
  if (tone === "info") return "bg-sky-400";
  return "bg-slate-500";
}

export function PosLatestOrdersPanel({
  orders,
  isLoading,
  isError,
  onEdit,
  onPayOrder,
  onNotice,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const posSettings = useMemo(() => loadPosSettings(branch?.code), [branch?.code]);
  const canManageTables = sessionCanManageFloor(claims);
  const taxFeatures = useTaxAuthorityFeatures();
  const praFakeEnabled = isPraFakeEnabled(taxFeatures.data);
  const praRealEnabled = isPraRealEnabled(taxFeatures.data);

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
  const [printPreview, setPrintPreview] = useState<{
    input: Omit<PrintTicketInput, "kind">;
    printerName?: string;
    systemPrinterName?: string;
  } | null>(null);
  const [dismissedRevision, setDismissedRevision] = useState(0);
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const visibleOrders = useMemo(() => {
    if (!branch?.code) return orders;
    void dismissedRevision;
    // Paid tab: keep closed bills visible with status "Closed".
    if (modeFilter === "Paid") return withClosedPosOrderStatus(orders, branch.code);
    return filterDismissedPosOrders(orders, branch.code);
  }, [orders, branch?.code, dismissedRevision, modeFilter]);

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

  /** FPRA Active → RPRA uploads this paid ticket to Real PRA and reprints Real slip. */
  const rpraMutation = useMutation({
    mutationFn: async (order: PosRecentOrder) => {
      if (!branch?.code) throw new Error("Select a branch before uploading to Real PRA.");
      const bill = order.bill;
      if (!bill || bill.status !== "completed") {
        throw new Error("Pay the order first, then use RPRA.");
      }
      if (String(bill.praMode ?? "").toLowerCase() === "real") {
        throw new Error("This ticket already has a Real PRA invoice.");
      }
      if (!canShowRpraForBill({
        praFakeEnabled: isPraFakeEnabled(taxFeatures.data),
        praRealEnabled: isPraRealEnabled(taxFeatures.data),
        praMode: bill.praMode,
      })) {
        throw new Error("RPRA is only while FPRA is Active. Real PRA runs automatically on Pay.");
      }
      const gate = await checkRealPraConnected(branch.code);
      if (!gate.connected) throw new Error(REAL_PRA_NOT_CONNECTED_MSG);
      const issued = await issuePraForBill({
        branchCode: branch.code,
        billId: bill.id,
        mode: "real",
      });
      return { order, bill, issued };
    },
    onSuccess: async ({ order, bill, issued }) => {
      void queryClient.invalidateQueries({ queryKey: ["orders", branch?.code] });
      if (!canEmbedPraOnSlip(issued.fiscal)) {
        onNotice?.("Real PRA did not return invoice number/QR.", "error");
        return;
      }
      onNotice?.(praIssuedNotice("real", issued.fiscal.invoiceNumber), "success");

      try {
        const sessionUserId = useSessionStore.getState().claims?.sub;
        const printUserId = resolvePrintUserId(sessionUserId, bill.waiterId);
        const profile = resolveReceiptPrinter(branch!.code, printUserId);
        const assigned = printUserId ? getWaiterPrinter(branch!.code, printUserId) : null;
        const praFiscal = await preparePraReceiptFooter({
          mode: "real",
          invoiceNumber: issued.fiscal.invoiceNumber,
          orderRef: bill.orderRef ?? bill.billRef ?? order.ref,
          qrPayload: issued.fiscal.qrPayload?.trim() || issued.fiscal.invoiceNumber,
        });
        const base = billToPrintInput(branch!.name, branch!.code, {
          ...bill,
          praMode: "real",
          praInvoiceNumber: issued.fiscal.invoiceNumber,
          praQrPayload: issued.fiscal.qrPayload?.trim() || issued.fiscal.invoiceNumber,
          praInvoiceId: issued.fiscal.invoiceId,
        });
        void printReceiptAsync({
          ...base,
          praFiscal,
          billPrintSettings:
            resolveBillPrintSettingsForReceipt(branch!.code) ??
            loadBillPrintSettings(branch!.code),
          printerName: profile?.name ?? assigned?.printerName,
          systemPrinterName: asPrinterName(
            profile?.systemPrinterName ?? assigned?.systemPrinterName,
          ),
        });
      } catch {
        onNotice?.(
          `Real PRA saved (${issued.fiscal.invoiceNumber}) but print failed — use Print to reprint.`,
          "error",
        );
      }
    },
    onError: (err: Error) => {
      onNotice?.(err.message || "Real PRA upload failed.", "error");
    },
  });

  /** Latest orders: always customer/order receipt — never kitchen KOT.
   * Paid / PRA orders reprint the same Invoice # + QR as on Pay (All + Paid tabs). */
  async function buildPaidReceiptInput(order: PosRecentOrder): Promise<{
    input: Omit<PrintTicketInput, "kind">;
    printerName?: string;
    systemPrinterName?: string;
    notice?: string;
  } | null> {
    if (!branch) return null;
    const sessionUserId = useSessionStore.getState().claims?.sub;
    const printedBy = resolveSessionPrintName(sessionUserId);
    const printUserId = resolvePrintUserId(sessionUserId, order.bill?.waiterId);
    const profile = resolveReceiptPrinter(branch.code, printUserId);
    const assigned = printUserId ? getWaiterPrinter(branch.code, printUserId) : null;

    // Always prefer the paid bill for this ORD-# so All-tab reprints match Pay (PRA).
    let bill = order.bill ?? null;
    try {
      const bills = await fetchCompletedOrders(branch.code);
      const orderRef = (order.ref || order.bill?.orderRef || order.bill?.billRef || "")
        .trim()
        .toLowerCase();
      const fresh =
        (bill ? bills.find((b) => b.id === bill!.id) : undefined) ??
        (orderRef
          ? bills.find(
              (b) =>
                (b.orderRef ?? "").trim().toLowerCase() === orderRef ||
                (b.billRef ?? "").trim().toLowerCase() === orderRef,
            )
          : undefined);
      if (fresh) bill = fresh;
    } catch {
      /* use cached bill */
    }

    const base = bill
      ? billToPrintInput(branch.name, branch.code, bill)
      : posRecentOrderToReceiptPrint(branch.name, branch.code, order);

    let praFiscal = base.praFiscal ?? null;
    let notice: string | undefined;

    if (bill) {
      const resolved = await resolvePraFooterForPaidBill({
        branchCode: branch.code,
        bill,
        issueIfMissing: true,
      });
      praFiscal = resolved.footer;
      notice = resolved.notice;
      if (resolved.blockedReal && resolved.notice) {
        window.alert(resolved.notice);
      } else if (!praFiscal && resolved.notice) {
        window.alert(resolved.notice);
      }
    }

    return {
      input: {
        ...base,
        waiterName: printedBy || base.waiterName,
        praFiscal,
        billPrintSettings:
          resolveBillPrintSettingsForReceipt(branch.code) ?? loadBillPrintSettings(branch.code),
      },
      printerName: profile?.name ?? assigned?.printerName,
      systemPrinterName: asPrinterName(
        profile?.systemPrinterName ?? assigned?.systemPrinterName,
      ),
      notice,
    };
  }

  function openPrintPreview(order: PosRecentOrder): void {
    void (async () => {
      const built = await buildPaidReceiptInput(order);
      if (!built) return;
      setPrintPreview({
        input: built.input,
        printerName: built.printerName,
        systemPrinterName: built.systemPrinterName,
      });
    })();
  }

  /** Unpaid New/held → open Pay (payment first). Paid → reprint with Real PRA footer. */
  function printOrder(order: PosRecentOrder, event?: MouseEvent): void {
    event?.stopPropagation();
    if (canPayPosRecentOrder(order)) {
      onPayOrder?.(order);
      return;
    }
    openPrintPreview(order);
  }

  /** Close: unpaid → Pay first; paid → print receipt + dismiss from list. */
  function printOrderDirect(order: PosRecentOrder): void {
    void (async () => {
      const built = await buildPaidReceiptInput(order);
      if (!built) return;
      void printReceiptAsync({
        ...built.input,
        printerName: built.printerName ?? built.systemPrinterName,
        systemPrinterName: built.systemPrinterName,
      });
    })();
  }

  function toggleSelected(order: PosRecentOrder): void {
    setSelectedId((current) => (current === order.id ? null : order.id));
  }

  function closeOrder(order: PosRecentOrder, event?: MouseEvent): void {
    event?.stopPropagation();
    if (canPayPosRecentOrder(order)) {
      onPayOrder?.(order);
      return;
    }
    printOrderDirect(order);
    if (branch?.code) dismissPosOrder(branch.code, order.id);
    setDismissedRevision((n) => n + 1);
    setSelectedId(null);
    closeOrderMutation.mutate(order);
  }

  function handlePrintPreviewClose(): void {
    setPrintPreview(null);
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
              <div className="mt-0.5 text-[10px] text-slate-500">
                Tap for actions · Close hides from All; Paid shows Closed
              </div>
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
                // FPRA Active only — never on Real Active / Real invoice tickets.
                const showRpra =
                  canShowRpraForBill({
                    praFakeEnabled,
                    praRealEnabled,
                    praMode: order.bill?.praMode,
                  }) &&
                  isPaidPosRecentOrder(order) &&
                  Boolean(order.bill) &&
                  order.bill?.status === "completed";

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
                          {showRpra ? (
                            <button
                              type="button"
                              className="shrink-0 rounded border border-emerald-600/50 bg-emerald-600/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/30 hover:text-white disabled:opacity-50"
                              title="Upload this paid ticket to Real PRA and print Real fiscal slip"
                              disabled={rpraMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                rpraMutation.mutate(order);
                              }}
                            >
                              {rpraMutation.isPending && rpraMutation.variables?.id === order.id
                                ? "…"
                                : "RPRA"}
                            </button>
                          ) : null}
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

      {printPreview && branch?.code ? (
        <ReceiptPrintPreviewModal
          input={printPreview.input}
          branchCode={branch.code}
          printerName={printPreview.printerName}
          systemPrinterName={printPreview.systemPrinterName}
          billPrintSettings={printPreview.input.billPrintSettings}
          onClose={handlePrintPreviewClose}
        />
      ) : null}
    </>
  );
}
