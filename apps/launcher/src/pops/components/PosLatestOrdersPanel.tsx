import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { Bill } from "@platform/contracts";
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
  printReceiptDetailed,
  resolveSessionPrintName,
  type PrintTicketInput,
} from "../lib/printTicket";
import { asPrinterName } from "../lib/asPrinterName";
import { describeAutoPrintReadiness } from "../lib/canDirectThermalPrint";
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
import {
  resolveReceiptPrinter,
  resolvePrintUserId,
} from "../lib/printerRouting";
import { getWaiterPrinter } from "../lib/waiterPrinterSettings";
import { loadBillPrintSettings } from "../lib/billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "../lib/billReceiptTemplateAssignments";
import { fetchCompletedOrders } from "../api/billing";
import { useSessionStore } from "../../stores/sessionStore";
import { POS_ORDER_MODES, formatPosStationDisplay } from "../lib/posOrderMode";
import { usePopsStore } from "../../stores/popsStore";
import { sessionCanManageFloor } from "../lib/roleAccess";
import { loadPosSettings, POS_SETTINGS_CHANGED_EVENT } from "../lib/posSettings";
import {
  isPosOrderModeVisible,
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
  /** `thenClose`: after Pay succeeds, parent passes `closeAfterPayBillId` so we mark Closed + show PRA. */
  onPayOrder?: (order: PosRecentOrder, options?: { thenClose?: boolean }) => void;
  onNotice?: (message: string, tone?: "success" | "error") => void;
  /** Bill just paid via Close → Pay; panel marks Closed and shows that bill’s PRA invoice. */
  closeAfterPayBillId?: string | null;
  onCloseAfterPayHandled?: () => void;
  /** Parent (POS) wires shortcut P → quick print selected bill. */
  quickPrintRef?: { current: (() => boolean) | null };
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
  closeAfterPayBillId = null,
  onCloseAfterPayHandled,
  quickPrintRef,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const claims = useSessionStore((s) => s.claims);
  const role = (claims?.role ?? displayRole ?? "").toLowerCase();
  /** Cashiers stay on POS — hide Orders “View all” shortcut. */
  const showViewAllOrders = role !== "cashier";
  const [posSettingsTick, setPosSettingsTick] = useState(0);
  /** Bill ids that successfully uploaded to Real PRA this session — hide RPRA immediately. */
  const [rpraDoneBillIds, setRpraDoneBillIds] = useState<Set<string>>(() => new Set());
  const posSettings = useMemo(
    () => loadPosSettings(branch?.code),
    [branch?.code, posSettingsTick],
  );
  const canManageTables = sessionCanManageFloor(claims);
  const taxFeatures = useTaxAuthorityFeatures();
  const praFakeEnabled = isPraFakeEnabled(taxFeatures.data);
  const praRealEnabled = isPraRealEnabled(taxFeatures.data);

  const [orderModeVisibility, setOrderModeVisibility] = useState(() =>
    loadPosOrderModeVisibility(branch?.code),
  );

  useEffect(() => {
    function onPosSettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setPosSettingsTick((n) => n + 1);
      }
    }
    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
    return () => window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
  }, [branch?.code]);

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
    () => POS_ORDER_MODES.filter((m) => isPosOrderModeVisible(m.id, orderModeVisibility)),
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
  const [layoutMode, setLayoutMode] = useState<"list" | "grid">(() => {
    try {
      const raw = localStorage.getItem("pops-latest-orders-layout");
      return raw === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  const [viewOrder, setViewOrder] = useState<PosRecentOrder | null>(null);
  const [changeTableOrder, setChangeTableOrder] = useState<PosRecentOrder | null>(null);
  const [printPreview, setPrintPreview] = useState<{
    input: Omit<PrintTicketInput, "kind">;
    printerName?: string;
    systemPrinterName?: string;
    /** Close final = PRA invoice; Print = simple slip. */
    title?: string;
    subtitle?: string;
  } | null>(null);
  const [dismissedRevision, setDismissedRevision] = useState(0);
  const [, setTimeTick] = useState(0);
  const handledCloseAfterPayRef = useRef<string | null>(null);

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
      // Hide RPRA immediately — do not wait for refetch (API used to omit praMode).
      setRpraDoneBillIds((prev) => {
        const next = new Set(prev);
        next.add(bill.id);
        return next;
      });

      // Patch cached bills so Paid list shows praMode=real without a full reload.
      queryClient.setQueriesData<Bill[]>({ queryKey: ["orders", branch?.code] }, (old) => {
        if (!old) return old;
        return old.map((row) =>
          row.id === bill.id
            ? {
                ...row,
                praMode: "real" as const,
                praInvoiceNumber: issued.fiscal.invoiceNumber,
                praInvoiceId: issued.fiscal.invoiceId,
                praQrPayload: issued.fiscal.qrPayload?.trim() || issued.fiscal.invoiceNumber,
              }
            : row,
        );
      });

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
          branchCode: branch!.code,
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

  /** Paid / held / open → customer receipt. Pass embedPra on Close only (Print stays simple). */
  async function buildPaidReceiptInput(
    order: PosRecentOrder,
    options?: { embedPra?: boolean; issueIfMissing?: boolean; skipBillRefresh?: boolean },
  ): Promise<{
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

    // Quick Print P uses cached bill — never block on a full orders API round-trip.
    let bill = order.bill ?? null;
    if (!options?.skipBillRefresh) {
      try {
        const bills = await fetchCompletedOrders(branch.code, { scope: "active" });
        const billId = bill?.id;
        const orderRef = (order.ref || order.bill?.orderRef || order.bill?.billRef || "")
          .trim()
          .toLowerCase();
        const fresh =
          (billId ? bills.find((b) => b.id === billId) : undefined) ??
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
    }

    const base = bill
      ? billToPrintInput(branch.name, branch.code, bill)
      : posRecentOrderToReceiptPrint(branch.name, branch.code, order);

    let praFiscal = base.praFiscal ?? null;
    let notice: string | undefined;

    // Print on unpaid = simple. Print/reprint on paid = PRA (same as Close).
    if (options?.embedPra) {
      if (!bill) {
        notice = "Paid bill not found for this order — cannot issue PRA invoice.";
        praFiscal = null;
      } else {
        const resolved = await resolvePraFooterForPaidBill({
          branchCode: branch.code,
          bill,
          issueIfMissing: options?.issueIfMissing ?? true,
        });
        praFiscal = resolved.footer;
        notice = resolved.notice;
        if (resolved.blockedReal && resolved.notice) {
          window.alert(resolved.notice);
        } else if (!praFiscal && resolved.notice) {
          window.alert(resolved.notice);
        } else if (!praFiscal && !resolved.notice) {
          notice =
            "PRA invoice issue skip ho gayi (Tax Active check karein ya thori der baad Close dobara try karein).";
        }
      }
    } else {
      praFiscal = null;
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

  /** Print P / shortcut P — instant auto-print (no preview modal, no orders API wait). */
  async function quickPrintOrder(order: PosRecentOrder): Promise<void> {
    const isPaidBill =
      order.bill?.status === "completed" ||
      Boolean(order.bill?.praInvoiceNumber) ||
      modeFilter === "Paid";

    onNotice?.(`Printing ${order.ref}…`, "success");

    const built = await buildPaidReceiptInput(order, {
      embedPra: isPaidBill,
      issueIfMissing: false,
      skipBillRefresh: true,
    });
    if (!built) {
      onNotice?.("Print failed — branch not loaded.", "error");
      return;
    }

    const readiness = describeAutoPrintReadiness({
      systemPrinterName: built.systemPrinterName,
      claims: useSessionStore.getState().claims,
      displayRole: usePopsStore.getState().displayRole,
    });

    const result = await printReceiptDetailed({
      ...built.input,
      kind: "receipt",
      printerName: built.printerName,
      systemPrinterName: built.systemPrinterName,
    });

    if (result.ok) {
      onNotice?.(
        result.usedNamedPrinter && built.systemPrinterName
          ? `${order.ref} auto-printed on ${built.systemPrinterName}.`
          : readiness.ready
            ? `${order.ref} sent to printer.`
            : `${order.ref} print dialog opened.${readiness.hint ? ` ${readiness.hint}` : ""}`,
        "success",
      );
      return;
    }

    onNotice?.(
      result.error?.trim() ||
        readiness.hint ||
        "Auto print failed — link receipt printer in Settings → Printers.",
      "error",
    );
    setPrintPreview({
      input: built.input,
      printerName: built.printerName,
      systemPrinterName: built.systemPrinterName,
      title: isPaidBill && built.input.praFiscal ? "PRA invoice" : isPaidBill ? "Paid invoice" : "Simple invoice",
      subtitle: isPaidBill
        ? built.input.praFiscal
          ? `PRA Invoice # ${built.input.praFiscal.invoiceNumber} · QR + logo`
          : "Paid reprint (PRA unavailable — use Close to issue)"
        : "Print = simple slip (FPRA)",
    });
  }

  function openPrintPreview(order: PosRecentOrder): void {
    void (async () => {
      const isPaidBill =
        order.bill?.status === "completed" ||
        Boolean(order.bill?.praInvoiceNumber) ||
        modeFilter === "Paid";
      const built = await buildPaidReceiptInput(order, { embedPra: isPaidBill });
      if (!built) return;
      setPrintPreview({
        input: built.input,
        printerName: built.printerName,
        systemPrinterName: built.systemPrinterName,
        title: isPaidBill && built.input.praFiscal ? "PRA invoice" : isPaidBill ? "Paid invoice" : "Simple invoice",
        subtitle: isPaidBill
          ? built.input.praFiscal
            ? `PRA Invoice # ${built.input.praFiscal.invoiceNumber} · QR + logo`
            : "Paid reprint (PRA unavailable — Tax Active check karein)"
          : "Print = simple slip (FPRA)",
      });
      if (built.notice && isPaidBill && !built.input.praFiscal) {
        onNotice?.(built.notice, "error");
      }
    })();
  }

  /**
   * Print: paid/Closed → PRA logo bill; unpaid → simple customer slip.
   * Kitchen KOT still goes out from POS Order / Pay.
   */
  function printOrder(order: PosRecentOrder, event?: MouseEvent): void {
    event?.stopPropagation();
    void quickPrintOrder(order);
  }

  const printOrderRef = useRef(printOrder);
  printOrderRef.current = printOrder;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    if (!quickPrintRef) return;
    quickPrintRef.current = () => {
      const id = selectedIdRef.current;
      if (!id) {
        onNotice?.("Pehle koi bill select karein, phir P dabayein (quick print).", "error");
        return false;
      }
      const order = ordersRef.current.find((o) => o.id === id);
      if (!order) {
        onNotice?.("Selected bill list mein nahi mili.", "error");
        return false;
      }
      printOrderRef.current(order);
      return true;
    };
    return () => {
      quickPrintRef.current = null;
    };
  }, [quickPrintRef, onNotice]);

  /**
   * Close (paid): mark status Closed + show this order’s real PRA invoice (number + QR + logo).
   * Never fall back to the simple Card/Cash slip — that is Print's job.
   */
  function markOrderClosed(order: PosRecentOrder): void {
    if (branch?.code) dismissPosOrder(branch.code, order.id);
    setDismissedRevision((n) => n + 1);
    setSelectedId(null);
    closeOrderMutation.mutate(order);
  }

  function openCloseInvoicePreview(order: PosRecentOrder): void {
    void (async () => {
      if (!branch) return;

      // Status first — Paid tab shows "Closed" even if PRA preview is blocked.
      markOrderClosed(order);

      if (!praFakeEnabled && !praRealEnabled) {
        window.alert(
          "Order Closed.\n\nPRA invoice ke liye Settings → Tax mein FPRA ya Real PRA Active karein.\nSimple slip ke liye Print use karein.",
        );
        onNotice?.(`Order ${order.ref} Closed.`, "success");
        return;
      }

      const built = await buildPaidReceiptInput(order, { embedPra: true });
      if (!built) {
        window.alert(
          `Order ${order.ref} Closed, lekin bill load nahi hui. Paid tab se Print / Close dobara try karein.`,
        );
        return;
      }

      const fiscal = built.input.praFiscal;
      const hasPra = Boolean(fiscal?.invoiceNumber);
      const mode =
        fiscal?.mode ??
        (praRealEnabled ? "real" : praFakeEnabled ? "fake" : null);
      const modeLabel = mode === "real" ? "Real PRA" : mode === "fake" ? "FPRA" : "PRA";

      if (!hasPra) {
        // buildPaidReceiptInput already alerts when it has a notice (e.g. not connected).
        if (!built.notice) {
          const missing =
            mode === "real"
              ? `Order ${order.ref} Closed.\n\nReal PRA invoice nahi bani (Invoice # / QR missing).\n\nSettings → Tax → Real PRA: Connect / Registered + Production token check karein, phir Close dobara try karein.`
              : `Order ${order.ref} Closed.\n\nFPRA invoice nahi bani (Invoice # / QR missing).\n\nSettings → Tax → FPRA Active check karein. Simple slip ke liye Print use karein.`;
          window.alert(missing);
        }
        onNotice?.(
          built.notice ||
            (mode === "real"
              ? `Order ${order.ref} Closed — Real PRA Invoice # / QR missing.`
              : `Order ${order.ref} Closed — FPRA Invoice # / QR missing.`),
          "error",
        );
        return;
      }

      setPrintPreview({
        input: built.input,
        printerName: built.printerName,
        systemPrinterName: built.systemPrinterName,
        title: `${modeLabel} invoice · ${order.ref}`,
        subtitle: `${modeLabel} Invoice # ${fiscal!.invoiceNumber} · QR + logo`,
      });
      if (built.notice) onNotice?.(built.notice, "success");
      else onNotice?.(`Order ${order.ref} Closed — ${modeLabel} invoice ready.`, "success");
    })();
  }

  /** After Close → Pay, show PRA + Closed for that exact paid bill. */
  useEffect(() => {
    if (!closeAfterPayBillId) {
      handledCloseAfterPayRef.current = null;
      return;
    }
    if (handledCloseAfterPayRef.current === closeAfterPayBillId) return;
    const paid = orders.find(
      (o) => o.bill?.id === closeAfterPayBillId && o.bill.status === "completed",
    );
    if (!paid) return;
    handledCloseAfterPayRef.current = closeAfterPayBillId;
    onCloseAfterPayHandled?.();
    openCloseInvoicePreview(paid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when this bill appears after Close→Pay
  }, [closeAfterPayBillId, orders]);

  function toggleSelected(order: PosRecentOrder): void {
    setSelectedId((current) => (current === order.id ? null : order.id));
  }

  /**
   * Close:
   * - Unpaid / held → Pay first, then auto Closed + PRA for that bill.
   * - Paid → status Closed + real PRA invoice for this order.
   */
  function closeOrder(order: PosRecentOrder, event?: MouseEvent): void {
    event?.stopPropagation();
    if (canPayPosRecentOrder(order)) {
      onPayOrder?.(order, { thenClose: true });
      onNotice?.(
        `Pay ${order.ref} — after payment status Closed + PRA invoice open hogi.`,
        "success",
      );
      return;
    }
    openCloseInvoicePreview(order);
  }

  function setOrdersLayout(next: "list" | "grid"): void {
    setLayoutMode(next);
    try {
      localStorage.setItem("pops-latest-orders-layout", next);
    } catch {
      /* ignore */
    }
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
                Select bill → <kbd className="rounded bg-slate-800 px-1 text-amber-300">P</kbd> quick
                print · Close = PRA
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div
                className="inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5"
                role="group"
                aria-label="Orders layout"
              >
                <button
                  type="button"
                  onClick={() => setOrdersLayout("list")}
                  title="List view"
                  aria-pressed={layoutMode === "list"}
                  className={`rounded px-1.5 py-1 transition ${
                    layoutMode === "list"
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersLayout("grid")}
                  title="Grid view"
                  aria-pressed={layoutMode === "grid"}
                  className={`rounded px-1.5 py-1 transition ${
                    layoutMode === "grid"
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
              </div>
              {showViewAllOrders ? (
                <Link
                  to="../orders"
                  className="shrink-0 text-[10px] font-medium text-amber-400 hover:text-amber-300"
                >
                  View all
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative mt-2">
            <span
              className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders…"
              className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-2 text-[11px] text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40"
            />
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
            <ul
              className={
                layoutMode === "list" ? "flex flex-col gap-1" : "grid grid-cols-3 gap-1"
              }
            >
              {displayedOrders.map((order) => {
                const isSelected = selectedId === order.id;
                const orderTotal = posRecentOrderTotal(order, posSettings);
                const showChangeTable =
                  canManageTables && canChangePosRecentOrderTable(order) && Boolean(branch?.code);
                const showEdit = Boolean(onEdit) && canEditPosRecentOrder(order);
                const showRpra =
                  canShowRpraForBill({
                    praFakeEnabled,
                    praRealEnabled,
                    praMode: order.bill?.praMode,
                  }) &&
                  isPaidPosRecentOrder(order) &&
                  Boolean(order.bill) &&
                  order.bill?.status === "completed" &&
                  !rpraDoneBillIds.has(order.bill!.id);
                const station = formatPosStationDisplay(order.stationLabel, order.orderMode);

                const onCardActivate = () => {
                  if (showEdit && onEdit) {
                    setSelectedId(order.id);
                    onEdit(order);
                    return;
                  }
                  toggleSelected(order);
                };

                const actionButtons = (
                  <>
                    {showEdit ? (
                      <button
                        type="button"
                        className="rounded border border-sky-300 px-1.5 py-0.5 text-[9px] font-medium text-sky-700 transition hover:border-sky-400 hover:bg-sky-50 dark:border-sky-700/60 dark:text-sky-300 dark:hover:border-sky-500/50 dark:hover:bg-sky-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(order);
                          setSelectedId(order.id);
                        }}
                        title="Open order in ticket panel to add/remove items"
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-amber-300 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 dark:border-slate-700 dark:text-amber-400 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/10"
                      onClick={(e) => printOrder(order, e)}
                      title={
                        order.kind === "pending" && order.kitchenTicket?.status !== "done"
                          ? "Print kitchen order ticket (order stays editable)"
                          : order.bill?.status === "completed" || modeFilter === "Paid"
                            ? "Re-print PRA invoice (logo + QR) — or press P"
                            : "Print simple invoice — or press P"
                      }
                    >
                      Print
                      <span className="ml-0.5 opacity-60">P</span>
                    </button>
                    {showRpra ? (
                      <button
                        type="button"
                        className="rounded border border-emerald-500/50 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-600/20 dark:text-emerald-300 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/30 dark:hover:text-white disabled:opacity-50"
                        title="Upload this paid ticket to Real PRA and print Real fiscal slip"
                        disabled={rpraMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          rpraMutation.mutate(order);
                        }}
                      >
                        {rpraMutation.isPending && rpraMutation.variables?.id === order.id ? "…" : "RPRA"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      onClick={(e) => closeOrder(order, e)}
                      disabled={closeOrderMutation.isPending}
                      title={
                        canPayPosRecentOrder(order)
                          ? "Pay → status Closed + this order’s PRA invoice"
                          : "Status Closed + this order’s PRA invoice"
                      }
                    >
                      Close
                    </button>
                    {isSelected ? (
                      <>
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewOrder(order);
                          }}
                        >
                          View
                        </button>
                        {showChangeTable ? (
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChangeTableOrder(order);
                            }}
                          >
                            Table
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </>
                );

                if (layoutMode === "list") {
                  return (
                    <li key={order.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={onCardActivate}
                        onDoubleClick={(e) => handleOrderDoubleClick(order, e)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onCardActivate();
                          }
                        }}
                        className={[
                          "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition",
                          isSelected
                            ? "border-amber-500 bg-amber-50 ring-1 ring-amber-400/50 dark:border-amber-500/50 dark:bg-slate-900 dark:ring-amber-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-950/40 dark:hover:border-slate-700",
                        ].join(" ")}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                              {order.ref}
                            </span>
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(order.statusTone)}`}
                              aria-hidden
                            />
                            <span className="truncate text-[10px] text-slate-600 dark:text-slate-400">
                              {order.orderMode} · {station}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-500">
                            <span>{formatRecentOrderTime(order.createdAt)}</span>
                            <span className="truncate">{order.statusLabel}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {orderTotal != null ? (
                            <p className="text-[12px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {orderTotal.toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 dark:text-slate-600">—</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {actionButtons}
                        </div>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={order.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={onCardActivate}
                      onDoubleClick={(e) => handleOrderDoubleClick(order, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onCardActivate();
                        }
                      }}
                      className={[
                        "flex h-full flex-col rounded-lg border p-1.5 transition",
                        isSelected
                          ? "border-amber-500 bg-amber-50 ring-1 ring-amber-400/50 dark:border-amber-500/50 dark:bg-slate-900 dark:ring-amber-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-950/50 dark:hover:border-slate-700",
                      ].join(" ")}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-sm font-bold leading-tight text-slate-900 dark:text-white">
                            {order.ref}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded px-0.5 text-[10px] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
                            onClick={(e) => closeOrder(order, e)}
                            disabled={closeOrderMutation.isPending}
                            aria-label="Close order"
                            title="Close — status Closed + this order’s PRA invoice"
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
                          <p className="text-[11px] font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
                            {orderTotal.toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-600">—</p>
                        )}
                      </div>

                      <div className="mt-1 flex min-w-0 items-center gap-1 text-[8px]">
                        <span className="inline-flex min-w-0 items-center gap-0.5 truncate text-slate-700 dark:text-slate-300">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(order.statusTone)}`}
                            aria-hidden
                          />
                          <span className="truncate">{order.statusLabel}</span>
                        </span>
                        <span className="shrink-0 text-slate-400 dark:text-slate-600">·</span>
                        <span className="truncate text-slate-600 dark:text-slate-400">{order.orderMode}</span>
                      </div>

                      <p className="mt-1 truncate text-sm font-semibold leading-tight text-slate-800 dark:text-slate-200">
                        {station}
                      </p>

                      <div className="mt-1.5 border-t border-slate-200 pt-1 dark:border-slate-800/80">
                        <div className="flex flex-wrap gap-1">{actionButtons}</div>
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
          onSuccess={(message) => {
            setChangeTableOrder(null);
            onNotice?.(message, "success");
          }}
        />
      ) : null}

      {printPreview && branch?.code ? (
        <ReceiptPrintPreviewModal
          input={printPreview.input}
          branchCode={branch.code}
          printerName={printPreview.printerName}
          systemPrinterName={printPreview.systemPrinterName}
          billPrintSettings={printPreview.input.billPrintSettings}
          title={printPreview.title}
          subtitle={printPreview.subtitle}
          onClose={handlePrintPreviewClose}
          onPrinted={(ok, error) => {
            if (ok) {
              onNotice?.(
                printPreview?.systemPrinterName
                  ? `Invoice sent to ${printPreview.systemPrinterName}.`
                  : "Print dialog opened — choose your physical printer (not PDF).",
                "success",
              );
              return;
            }
            onNotice?.(
              error?.trim() ||
                "Print failed. Printer → Receipt pe OS printer link karein (EPSON/XP name), phir EXE se Print dabayein.",
              "error",
            );
          }}
        />
      ) : null}
    </>
  );
}
