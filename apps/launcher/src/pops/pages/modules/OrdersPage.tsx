import { Button } from "@platform/ui";
import type { Bill, PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPraFiscalForSource } from "../../../lib/praApi";
import { usePopsStore } from "../../../stores/popsStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { sessionCanManageFloor } from "../../lib/roleAccess";
import { fetchCompletedOrders, completeBill, deleteBill } from "../../api/billing";
import { confirmDeleteBill } from "../../lib/confirmDeleteBill";
import { fetchKitchenTickets } from "../../api/kitchen";
import { loadBusinessDaySettings } from "../../lib/businessDay";
import { loadPosSettings, POS_SETTINGS_CHANGED_EVENT } from "../../lib/posSettings";
import { karachiYear } from "../../lib/orderSales";
import {
  buildUnifiedOrders,
  canChangeOrderTable,
  canEditUnifiedOrder,
  filterUnifiedOrdersByDateTime,
  summarizeOrderSales,
  unifiedOrderRef,
  unifiedOrderService,
  unifiedOrderStatusLabel,
  unifiedOrderStatusTone,
  unifiedOrderTable,
  unifiedOrderTotal,
  unifiedOrderWaiter,
  type UnifiedOrder,
} from "../../lib/orderHistory";
import { CompleteHeldBillModal } from "../../components/CompleteHeldBillModal";
import { OrderDateFiltersBar } from "../../components/OrderDateFiltersBar";
import { ChangeOrderTableModal } from "../../components/ChangeOrderTableModal";
import { OrderDetailModal } from "../../components/OrderDetailModal";
import { PraFiscalInvoiceModal } from "../../components/PraFiscalInvoiceModal";
import { PraModeConfirmDialog } from "../../components/PraModeConfirmDialog";
import { ReceiptPrintPreviewModal } from "../../components/ReceiptPrintPreviewModal";
import {
  isPraFakeEnabled,
  isPraRealEnabled,
  useTaxAuthorityFeatures,
} from "../../hooks/useTaxAuthorityFeatures";
import {
  autoIssuePraForCompletedBill,
  canEmbedPraOnSlip,
  canShowRpraForBill,
  checkRealPraConnected,
  issuePraForBill,
  praIssuedNotice,
  printIssuedPraSlip,
  REAL_PRA_NOT_CONNECTED_MSG,
} from "../../lib/praIssueFlow";
import { billToPrintInput, type PrintTicketInput } from "../../lib/printTicket";
import { resolvePraFooterForPaidBill } from "../../lib/praPaidPrint";
import { resolveReceiptPrinter, resolvePrintUserId } from "../../lib/printerRouting";
import { loadBillPrintSettings } from "../../lib/billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "../../lib/billReceiptTemplateAssignments";
import { isTypingTarget } from "../../lib/posShortcuts";
import { shareBillViaWhatsApp, phoneFromBillNotes } from "../../lib/whatsappShare";
import { getWaiterPrinter } from "../../lib/waiterPrinterSettings";
import { PAYMENT_METHOD_LABELS } from "@platform/contracts";
import {
  linkActionClass,
  linkDangerClass,
  linkSuccessClass,
  linkWarningClass,
  tableOrderRefClass,
} from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSearchInput,
  ModuleToolbar,
} from "../../ui/ModuleToolbar";
import { SimpleTable } from "../../ui/SimpleTable";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBillPayments(bill: Bill): string {
  if (bill.status === "held") return "—";
  if (bill.payments.length === 0) return "—";
  return bill.payments
    .map((p) => `${PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}`)
    .join(", ");
}

function OrdersSummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={[
          "mt-1 text-2xl font-semibold",
          accent ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white",
        ].join(" ")}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function OrdersPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManageTables = sessionCanManageFloor(claims);
  const businessDay = useMemo(
    () => loadBusinessDaySettings(branch?.code),
    [branch?.code],
  );
  const [posSettingsTick, setPosSettingsTick] = useState(0);
  const posSettings = useMemo(
    () => loadPosSettings(branch?.code),
    [branch?.code, posSettingsTick],
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

  const [search, setSearch] = useState("");
  const [praFilter, setPraFilter] = useState<"all" | "fake" | "real" | "none">("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeFrom, setFilterTimeFrom] = useState("");
  const [filterTimeTo, setFilterTimeTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(() => new Set());
  /** Last-focused completed bill for P = quick reprint. */
  const [quickPrintBillId, setQuickPrintBillId] = useState<string | null>(null);
  const [heldBillToPay, setHeldBillToPay] = useState<Bill | null>(null);
  const [changeTableOrder, setChangeTableOrder] = useState<UnifiedOrder | null>(null);
  const [printPreview, setPrintPreview] = useState<{
    input: Omit<PrintTicketInput, "kind">;
    printerName?: string;
    systemPrinterName?: string;
    billRef: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [praFiscal, setPraFiscal] = useState<PraFiscalInvoice | null>(null);
  const [praModalOpen, setPraModalOpen] = useState(false);
  const [praPrinting, setPraPrinting] = useState(false);
  const [praBusy, setPraBusy] = useState(false);
  const [praModePromptBill, setPraModePromptBill] = useState<Bill | null>(null);
  const taxFeatures = useTaxAuthorityFeatures();
  const praRealEnabled = isPraRealEnabled(taxFeatures.data);
  const praFakeEnabled = isPraFakeEnabled(taxFeatures.data);

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCompletedOrders(branch!.code),
    refetchInterval: 10_000,
  });

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchKitchenTickets(branch!.code),
    refetchInterval: 10_000,
  });

  const completeHeldMutation = useMutation({
    mutationFn: ({
      billId,
      servicePct,
      taxPct,
      payments,
    }: {
      billId: string;
      servicePct: number;
      taxPct: number;
      payments: Bill["payments"];
    }) => completeBill(billId, { servicePct, taxPct, payments }),
    onSuccess: async (bill) => {
      setHeldBillToPay(null);
      void ordersQuery.refetch();

      // Real/FPRA ON → auto-issue on Orders Pay (same as POS Pay).
      if (!branch?.code) {
        setNotice(`Payment completed — ${bill.billRef}`);
        return;
      }

      const autoPra = await autoIssuePraForCompletedBill({
        branchCode: branch.code,
        billId: bill.id,
      });

      if (!autoPra.mode) {
        setNotice(`Payment completed — ${bill.billRef}`);
        return;
      }

      if (autoPra.blockedReal) {
        window.alert(autoPra.notice || REAL_PRA_NOT_CONNECTED_MSG);
        setNotice(`Payment completed — ${bill.billRef}. ${autoPra.notice}`);
        return;
      }

      if (autoPra.fiscal && canEmbedPraOnSlip(autoPra.fiscal)) {
        setPraFiscal(autoPra.fiscal);
        setNotice(`Payment completed — ${bill.billRef}. ${autoPra.notice}`);
        await ordersQuery.refetch();
        reprint({
          ...bill,
          praMode: autoPra.fiscal.mode,
          praInvoiceNumber: autoPra.fiscal.invoiceNumber,
          praQrPayload: autoPra.fiscal.qrPayload?.trim() || autoPra.fiscal.invoiceNumber,
          praInvoiceId: autoPra.fiscal.invoiceId,
        });
        return;
      }

      setNotice(
        `Payment completed — ${bill.billRef}${autoPra.notice ? `. ${autoPra.notice}` : ""}`,
      );
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const deleteBillsMutation = useMutation({
    mutationFn: async (bills: Bill[]) => {
      for (const bill of bills) {
        await deleteBill(bill.id);
      }
      return bills.length;
    },
    onSuccess: (count) => {
      setSelectedBillIds(new Set());
      setSelectedOrder(null);
      setNotice(
        count === 1
          ? "Order deleted."
          : `${count} orders deleted.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void ordersQuery.refetch();
      void kitchenQuery.refetch();
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const allOrders = useMemo(
    () => buildUnifiedOrders(ordersQuery.data ?? [], kitchenQuery.data ?? []),
    [ordersQuery.data, kitchenQuery.data],
  );

  const availableYears = useMemo(() => {
    const years = new Set(allOrders.map((o) => karachiYear(o.createdAt)));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allOrders]);

  const dateFilters = useMemo(
    () => ({
      year: filterYear,
      date: filterDate,
      timeFrom: filterTimeFrom,
      timeTo: filterTimeTo,
    }),
    [filterYear, filterDate, filterTimeFrom, filterTimeTo],
  );

  const hasDateFilters =
    filterYear !== "all" || Boolean(filterDate) || Boolean(filterTimeFrom) || Boolean(filterTimeTo);

  function clearDateFilters(): void {
    setFilterYear("all");
    setFilterDate("");
    setFilterTimeFrom("");
    setFilterTimeTo("");
  }

  const filtered = useMemo(() => {
    let list = filterUnifiedOrdersByDateTime(allOrders, dateFilters, businessDay);
    if (praFilter !== "all") {
      list = list.filter((o) => {
        if (o.source !== "bill") return praFilter === "none";
        const mode = o.bill.praMode;
        if (praFilter === "fake") return mode === "fake";
        if (praFilter === "real") return mode === "real";
        return !mode;
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const ref = unifiedOrderRef(o).toLowerCase();
      const table = unifiedOrderTable(o).toLowerCase();
      const waiter = unifiedOrderWaiter(o).toLowerCase();
      const extra =
        o.source === "bill"
          ? (
              o.bill.billRef +
              " " +
              (o.bill.praInvoiceNumber ?? "") +
              " " +
              (o.bill.praInvoiceId ?? "") +
              " " +
              (o.bill.praMode ?? "")
            ).toLowerCase()
          : o.ticket.ticketRef.toLowerCase() + o.ticket.itemsSummary.toLowerCase();
      return ref.includes(q) || table.includes(q) || waiter.includes(q) || extra.includes(q);
    });
  }, [allOrders, search, praFilter, dateFilters, businessDay]);

  const salesSummary = useMemo(
    () => summarizeOrderSales(filtered, posSettings),
    [filtered, posSettings],
  );

  const deletableBillsInView = useMemo(
    () => filtered.filter((o): o is Extract<UnifiedOrder, { source: "bill" }> => o.source === "bill"),
    [filtered],
  );

  const allDeletableSelected =
    deletableBillsInView.length > 0 &&
    deletableBillsInView.every((o) => selectedBillIds.has(o.bill.id));

  const selectedBills = useMemo(() => {
    const byId = new Map(deletableBillsInView.map((o) => [o.bill.id, o.bill]));
    return [...selectedBillIds]
      .map((id) => byId.get(id))
      .filter((b): b is Bill => Boolean(b));
  }, [deletableBillsInView, selectedBillIds]);

  useEffect(() => {
    const allowed = new Set(deletableBillsInView.map((o) => o.bill.id));
    setSelectedBillIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [deletableBillsInView]);

  function toggleBillSelected(billId: string): void {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) next.delete(billId);
      else next.add(billId);
      return next;
    });
  }

  function toggleSelectAllDeletable(): void {
    if (allDeletableSelected) {
      setSelectedBillIds(new Set());
      return;
    }
    setSelectedBillIds(new Set(deletableBillsInView.map((o) => o.bill.id)));
  }

  function deleteSingleBill(bill: Bill): void {
    if (!confirmDeleteBill(bill)) return;
    deleteBillsMutation.mutate([bill]);
  }

  function deleteSelectedBills(): void {
    if (selectedBills.length === 0) return;
    const confirmed = window.confirm(
      selectedBills.length === 1
        ? `Permanently delete order ${selectedBills[0]!.orderRef ?? selectedBills[0]!.billRef}?\n\nThis action cannot be undone.`
        : `Permanently delete ${selectedBills.length} selected orders?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) return;
    deleteBillsMutation.mutate(selectedBills);
  }

  function reprint(bill: Bill): void {
    setQuickPrintBillId(bill.id);
    void (async () => {
      const branchCode = branch?.code ?? "—";
      const branchName = branch?.name ?? "POPS";
      const printUserId = resolvePrintUserId(claims?.sub, bill.waiterId);
      const profile = resolveReceiptPrinter(branch?.code, printUserId);
      const assigned = getWaiterPrinter(branch?.code, printUserId);
      const resolved = branch?.code
        ? await resolvePraFooterForPaidBill({
            branchCode: branch.code,
            bill,
            issueIfMissing: true,
          })
        : { footer: null, fiscal: null, notice: undefined, blockedReal: false };
      if (resolved.blockedReal && resolved.notice) {
        window.alert(resolved.notice);
      } else if (resolved.notice && !resolved.footer) {
        setNotice(resolved.notice);
      }
      setPrintPreview({
        input: {
          ...billToPrintInput(branchName, branchCode, bill),
          paperSize: profile?.paperSize,
          copies: profile?.copies,
          praFiscal: resolved.footer,
          billPrintSettings:
            resolveBillPrintSettingsForReceipt(branchCode) ?? loadBillPrintSettings(branchCode),
        },
        printerName: profile?.name ?? assigned?.printerName,
        systemPrinterName: profile?.systemPrinterName ?? assigned?.systemPrinterName,
        billRef: bill.billRef,
      });
    })();
  }

  async function issuePraForOrder(bill: Bill, mode: PraInvoiceMode): Promise<void> {
    if (!branch?.code) {
      setNotice("Select a branch before issuing PRA.");
      return;
    }
    setPraBusy(true);
    try {
      const issued = await issuePraForBill({
        branchCode: branch.code,
        billId: bill.id,
        mode,
      });
      if (!canEmbedPraOnSlip(issued.fiscal)) {
        setNotice("PRA did not return invoice number/QR.");
        return;
      }
      setPraFiscal(issued.fiscal);
      setNotice(praIssuedNotice(mode, issued.fiscal.invoiceNumber));

      // Patch list so RPRA hides immediately (API used to omit praMode on bills).
      const patched: Bill = {
        ...bill,
        praMode: mode,
        praInvoiceNumber: issued.fiscal.invoiceNumber,
        praQrPayload: issued.fiscal.qrPayload?.trim() || issued.fiscal.invoiceNumber,
        praInvoiceId: issued.fiscal.invoiceId,
      };
      void queryClient.setQueriesData<Bill[]>({ queryKey: ["orders", branch.code] }, (old) => {
        if (!old) return old;
        return old.map((row) => (row.id === bill.id ? { ...row, ...patched } : row));
      });
      setSelectedOrder((prev) =>
        prev?.source === "bill" && prev.bill.id === bill.id
          ? { ...prev, bill: { ...prev.bill, ...patched } }
          : prev,
      );

      await ordersQuery.refetch();
      reprint(patched);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "PRA issue failed.");
    } finally {
      setPraBusy(false);
      setPraModePromptBill(null);
    }
  }

  async function requestRpra(bill: Bill): Promise<void> {
    if (String(bill.praMode ?? "").toLowerCase() === "real") {
      setNotice("This ticket already has a Real PRA invoice.");
      return;
    }
    if (
      !canShowRpraForBill({
        praFakeEnabled: isPraFakeEnabled(taxFeatures.data),
        praRealEnabled: isPraRealEnabled(taxFeatures.data),
        praMode: bill.praMode,
      })
    ) {
      setNotice("RPRA is only while FPRA is Active. Real PRA runs automatically on Pay.");
      return;
    }
    if (!branch?.code) {
      setNotice("Select a branch before uploading to Real PRA.");
      return;
    }
    try {
      const gate = await checkRealPraConnected(branch.code);
      if (!gate.connected) {
        window.alert(REAL_PRA_NOT_CONNECTED_MSG);
        setNotice(REAL_PRA_NOT_CONNECTED_MSG);
        return;
      }
    } catch {
      window.alert(REAL_PRA_NOT_CONNECTED_MSG);
      setNotice(REAL_PRA_NOT_CONNECTED_MSG);
      return;
    }
    await issuePraForOrder(bill, "real");
  }

  async function viewPraForBill(bill: Bill): Promise<void> {
    if (!branch?.code) {
      setNotice("Select a branch before viewing PRA.");
      return;
    }
    setPraBusy(true);
    try {
      const fiscal = await fetchPraFiscalForSource({
        branchCode: branch.code,
        sourceType: "bill",
        sourceId: bill.id,
      });
      if (!fiscal) {
        setNotice(`No PRA fiscal found for ${bill.billRef}.`);
        return;
      }
      setPraFiscal(fiscal);
      
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load PRA fiscal.");
    } finally {
      setPraBusy(false);
    }
  }

  function openOrder(order: UnifiedOrder): void {
    setSelectedOrder(order);
    if (order.source === "bill" && order.bill.status === "completed") {
      setQuickPrintBillId(order.bill.id);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "p" && e.key !== "P") return;
      if (isTypingTarget(e.target)) return;
      if (printPreview || praModalOpen || heldBillToPay || selectedOrder) return;

      const fromSelection =
        selectedBills.length === 1 && selectedBills[0]!.status === "completed"
          ? selectedBills[0]!
          : null;
      const fromFocus =
        quickPrintBillId &&
        (ordersQuery.data ?? []).find((b) => b.id === quickPrintBillId && b.status === "completed");
      const bill = fromSelection ?? fromFocus ?? null;
      if (!bill) {
        setNotice("Pehle completed bill select/open karein, phir P dabayein (quick print).");
        return;
      }
      e.preventDefault();
      reprint(bill);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    printPreview,
    praModalOpen,
    heldBillToPay,
    selectedOrder,
    selectedBills,
    quickPrintBillId,
    ordersQuery.data,
  ]);

  function editInPos(order: UnifiedOrder): void {
    if (order.source === "kitchen") {
      navigate("/pops/pos", { state: { editTicketId: order.ticket.id } });
      return;
    }
    if (order.bill.status === "held") {
      navigate("/pops/pos", { state: { editBillId: order.bill.id } });
    }
  }

  const isLoading = ordersQuery.isLoading || kitchenQuery.isLoading;
  const isError = ordersQuery.isError || kitchenQuery.isError;
  const errorMessage = (ordersQuery.error ?? kitchenQuery.error) as Error | null;

  if (!branch?.code) {
    return <p className="text-sm text-slate-500">Select a branch to view orders.</p>;
  }

  return (
    <div className="space-y-3">
      <ModuleToolbar
        title="Orders"
        trailing={
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2.5 text-xs"
            onClick={() => {
              void ordersQuery.refetch();
              void kitchenQuery.refetch();
            }}
          >
            Refresh
          </Button>
        }
      />

      {isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
      {isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage?.message ?? "Could not load orders."}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{notice}</p>
      ) : null}

      <ModuleFilterBar>
        <ModuleSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search bill, order, table, waiter…"
        />
        <ModuleCountBadge shown={filtered.length} total={allOrders.length} />
      </ModuleFilterBar>

      <OrderDateFiltersBar
        filterYear={filterYear}
        filterDate={filterDate}
        filterTimeFrom={filterTimeFrom}
        filterTimeTo={filterTimeTo}
        availableYears={availableYears}
        hasActiveFilters={hasDateFilters}
        onYearChange={setFilterYear}
        onDateChange={setFilterDate}
        onTimeFromChange={setFilterTimeFrom}
        onTimeToChange={setFilterTimeTo}
        onClear={clearDateFilters}
      />

      {!isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OrdersSummaryCard
            label="Total sales"
            value={`Rs ${salesSummary.paidTotal.toLocaleString()}`}
            hint={
              salesSummary.paidCount === 0
                ? "No paid orders in this view"
                : `${salesSummary.paidCount} paid order${salesSummary.paidCount === 1 ? "" : "s"}`
            }
            accent
          />
          <OrdersSummaryCard
            label="Service charges"
            value={`Rs ${salesSummary.serviceTotal.toLocaleString()}`}
            hint="Paid bills and open kitchen tickets shown"
          />
          <OrdersSummaryCard
            label="On hold"
            value={`Rs ${salesSummary.heldTotal.toLocaleString()}`}
            hint={
              salesSummary.heldCount === 0
                ? "No held bills"
                : `${salesSummary.heldCount} bill${salesSummary.heldCount === 1 ? "" : "s"} awaiting payment`
            }
          />
          <OrdersSummaryCard
            label="Open in kitchen"
            value={
              salesSummary.openTotal > 0
                ? `Rs ${salesSummary.openTotal.toLocaleString()}`
                : String(salesSummary.openCount)
            }
            hint={
              salesSummary.openCount === 0
                ? "No open tickets"
                : `${salesSummary.openCount} ticket${salesSummary.openCount === 1 ? "" : "s"} not yet billed`
            }
          />
        </div>
      ) : null}

      {filtered.length === 0 && !isLoading ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
          {allOrders.length === 0
            ? "No orders yet. Create orders from POS."
            : "No orders match your filters."}
        </p>
      ) : (
        <div className="space-y-2">
          {selectedBillIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
              <span className="text-xs text-slate-300">
                {selectedBillIds.size} selected
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                disabled={deleteBillsMutation.isPending}
                onClick={deleteSelectedBills}
              >
                {deleteBillsMutation.isPending ? "Deleting…" : "Delete selected"}
              </Button>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-200"
                disabled={deleteBillsMutation.isPending}
                onClick={() => setSelectedBillIds(new Set())}
              >
                Clear
              </button>
            </div>
          ) : null}
          <SimpleTable
            rowKey={(r) => r.id}
            rows={filtered}
            onRowClick={openOrder}
            columns={[
              {
                key: "select",
                id: "select",
                className: "w-10",
                header: (
                  <input
                    type="checkbox"
                    checked={allDeletableSelected}
                    disabled={deletableBillsInView.length === 0 || deleteBillsMutation.isPending}
                    onChange={toggleSelectAllDeletable}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select all deletable orders"
                    className="h-3.5 w-3.5 accent-red-500"
                  />
                ),
                render: (r) =>
                  r.source === "bill" ? (
                    <input
                      type="checkbox"
                      checked={selectedBillIds.has(r.bill.id)}
                      disabled={deleteBillsMutation.isPending}
                      onChange={() => toggleBillSelected(r.bill.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${unifiedOrderRef(r)}`}
                      className="h-3.5 w-3.5 accent-red-500"
                    />
                  ) : (
                    <span className="inline-block w-3.5" aria-hidden />
                  ),
              },
              {
                key: "ref",
                header: "Order",
                render: (r) => (
                  <div className="min-w-0">
                    <button
                      type="button"
                      className={tableOrderRefClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        openOrder(r);
                      }}
                    >
                      {unifiedOrderRef(r)}
                    </button>
                    {r.source === "bill" && r.bill.praInvoiceNumber ? (
                      <div className="mt-0.5 truncate text-[10px] text-slate-500">
                        PRA Invoice # {r.bill.praInvoiceNumber}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "type",
                header: "Type",
                render: (r) => (
                  <span className="text-xs text-slate-500">
                    {r.source === "bill" ? r.bill.billRef : r.ticket.ticketRef}
                  </span>
                ),
              },
              {
                key: "tableLabel",
                header: "Table",
                render: (r) => unifiedOrderTable(r),
              },
              {
                key: "waiterName",
                header: "Waiter",
                render: (r) => unifiedOrderWaiter(r),
              },
              {
                key: "service",
                header: "Service",
                render: (r) => {
                  const service = unifiedOrderService(r, posSettings);
                  return service ? (
                    <span className="text-xs text-slate-400">
                      {service.servicePct}% · Rs {service.service.toLocaleString()}
                    </span>
                  ) : (
                    "—"
                  );
                },
              },
              {
                key: "payment",
                header: "Payment",
                render: (r) =>
                  r.source === "bill" ? (
                    <span className="text-xs text-slate-400">{formatBillPayments(r.bill)}</span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "total",
                header: "Total",
                render: (r) => {
                  const total = unifiedOrderTotal(r, posSettings);
                  return total != null ? `Rs ${total.toLocaleString()}` : "—";
                },
              },
              {
                key: "createdAt",
                header: "When",
                render: (r) => formatWhen(r.createdAt),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge tone={unifiedOrderStatusTone(r)}>{unifiedOrderStatusLabel(r)}</Badge>
                ),
              },
              {
                key: "actions",
                header: "",
                id: "actions",
                render: (r) => (
                  <span className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()} role="presentation">
                    <button
                      type="button"
                      className={`text-xs ${linkActionClass}`}
                      onClick={() => openOrder(r)}
                    >
                      View
                    </button>
                    {canEditUnifiedOrder(r) ? (
                      <button
                        type="button"
                        className={`text-xs ${linkSuccessClass}`}
                        onClick={() => editInPos(r)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {r.source === "bill" && r.bill.status === "held" ? (
                      <button
                        type="button"
                        className={`text-xs ${linkWarningClass}`}
                        onClick={() => setHeldBillToPay(r.bill)}
                      >
                        Pay
                      </button>
                    ) : null}
                    {r.source === "bill" && r.bill.status === "completed" ? (
                      <button
                        type="button"
                        className={`text-xs ${linkWarningClass}`}
                        onClick={() => reprint(r.bill)}
                        title="Reprint — or press P"
                      >
                        Reprint (P)
                      </button>
                    ) : null}
                    {r.source === "bill" &&
                    r.bill.status === "completed" &&
                    r.bill.praInvoiceNumber ? (
                      <button
                        type="button"
                        className={`text-xs ${linkActionClass}`}
                        disabled={praBusy}
                        onClick={() => void viewPraForBill(r.bill)}
                      >
                        View PRA
                      </button>
                    ) : null}
                    {r.source === "bill" &&
                    r.bill.status === "completed" &&
                    canShowRpraForBill({
                      praFakeEnabled,
                      praRealEnabled,
                      praMode: r.bill.praMode,
                    }) ? (
                      <button
                        type="button"
                        className={`text-xs font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400`}
                        disabled={praBusy}
                        title="Upload to Real PRA and print Real fiscal slip"
                        onClick={() => void requestRpra(r.bill)}
                      >
                        RPRA
                      </button>
                    ) : null}
                    {canManageTables && canChangeOrderTable(r) ? (
                      <button
                        type="button"
                        className={`text-xs ${linkActionClass}`}
                        onClick={() => setChangeTableOrder(r)}
                      >
                        Change table
                      </button>
                    ) : null}
                    {r.source === "bill" && r.bill.status === "completed" ? (
                      <button
                        type="button"
                        className={`text-xs ${linkSuccessClass}`}
                        onClick={() => {
                          const ok = shareBillViaWhatsApp(
                            r.bill,
                            branch?.name ?? "POPS",
                            phoneFromBillNotes(r.bill.notes),
                          );
                          setNotice(ok ? `WhatsApp share opened for ${r.bill.billRef}` : "Could not open WhatsApp.");
                        }}
                      >
                        WhatsApp
                      </button>
                    ) : null}
                    {r.source === "bill" ? (
                      <button
                        type="button"
                        className={`text-xs ${linkDangerClass}`}
                        disabled={deleteBillsMutation.isPending}
                        onClick={() => deleteSingleBill(r.bill)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      {selectedOrder ? (
        <OrderDetailModal
          order={selectedOrder}
          branchName={branch.name}
          canChangeTable={canManageTables}
          onClose={() => setSelectedOrder(null)}
          onReprint={(bill) => reprint(bill)}
          onViewPra={
            selectedOrder.source === "bill" && selectedOrder.bill.praInvoiceNumber
              ? (bill) => void viewPraForBill(bill)
              : undefined
          }
          onRealPra={
            selectedOrder.source === "bill" &&
            selectedOrder.bill.status === "completed" &&
            canShowRpraForBill({
              praFakeEnabled,
              praRealEnabled,
              praMode: selectedOrder.bill.praMode,
            })
              ? (bill) => void requestRpra(bill)
              : undefined
          }
          onCompletePayment={
            selectedOrder.source === "bill" && selectedOrder.bill.status === "held"
              ? () => {
                  setHeldBillToPay(selectedOrder.bill);
                  setSelectedOrder(null);
                }
              : undefined
          }
          onChangeTable={(order) => {
            setSelectedOrder(null);
            setChangeTableOrder(order);
          }}
          onDeleteBill={
            selectedOrder.source === "bill"
              ? () => deleteSingleBill(selectedOrder.bill)
              : undefined
          }
        />
      ) : null}

      {printPreview && branch?.code ? (
        <ReceiptPrintPreviewModal
          input={printPreview.input}
          branchCode={branch.code}
          printerName={printPreview.printerName}
          systemPrinterName={printPreview.systemPrinterName}
          onClose={() => setPrintPreview(null)}
          onPrinted={(ok, error) => {
            setNotice(
              ok
                ? printPreview.systemPrinterName
                  ? `Reprinted ${printPreview.billRef} to ${printPreview.systemPrinterName}`
                  : `Reprinted ${printPreview.billRef}`
                : error?.trim() ||
                    `Reprint failed for ${printPreview.billRef}. Check printer assignment / OS link.`,
            );
          }}
        />
      ) : null}

      {heldBillToPay ? (
        <CompleteHeldBillModal
          bill={heldBillToPay}
          isSubmitting={completeHeldMutation.isPending}
          onClose={() => setHeldBillToPay(null)}
          onConfirm={({ servicePct, taxPct, payments }) =>
            completeHeldMutation.mutate({
              billId: heldBillToPay.id,
              servicePct,
              taxPct,
              payments,
            })
          }
        />
      ) : null}

      {changeTableOrder?.source === "kitchen" ? (
        <ChangeOrderTableModal
          ticket={changeTableOrder.ticket}
          branchCode={branch.code}
          onClose={() => setChangeTableOrder(null)}
          onSuccess={(message) => {
            setChangeTableOrder(null);
            setNotice(message);
          }}
        />
      ) : null}

      <PraModeConfirmDialog
        open={Boolean(praModePromptBill)}
        busy={praBusy}
        onFake={() => {
          if (!praModePromptBill) return;
          void issuePraForOrder(praModePromptBill, "fake");
        }}
        onReal={() => {
          if (!praModePromptBill) return;
          void issuePraForOrder(praModePromptBill, "real");
        }}
        onCancel={() => setPraModePromptBill(null)}
      />

      <PraFiscalInvoiceModal
        fiscal={praFiscal}
        open={praModalOpen}
        printing={praPrinting}
        branchName={branch?.name}
        branchCode={branch?.code}
        onClose={() => {
          setPraModalOpen(false);
          setPraFiscal(null);
        }}
        onPrint={() => {
          if (!praFiscal) return;
          setPraPrinting(true);
          const printUserId = resolvePrintUserId(claims?.sub, null);
          const profile = resolveReceiptPrinter(branch?.code, printUserId);
          const assigned = getWaiterPrinter(branch?.code, printUserId);
          void printIssuedPraSlip(praFiscal, {
            branchName: branch?.name,
            branchCode: branch?.code,
            systemPrinterName:
              profile?.systemPrinterName ?? assigned?.systemPrinterName ?? null,
          })
            .then((res) => {
              if (!res.ok) setNotice(res.error ?? "Invoice print failed.");
            })
            .finally(() => setPraPrinting(false));
        }}
      />
    </div>
  );
}
