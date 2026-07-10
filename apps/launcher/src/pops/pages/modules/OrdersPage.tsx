import { Button } from "@platform/ui";
import type { Bill } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchCompletedOrders, completeBill, deleteBill } from "../../api/billing";
import { fetchKitchenTickets } from "../../api/kitchen";
import { loadBusinessDaySettings } from "../../lib/businessDay";
import { loadPosSettings } from "../../lib/posSettings";
import { karachiYear, businessDateKey } from "../../lib/orderSales";
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
import { printBill } from "../../lib/printTicket";
import { shareBillViaWhatsApp, phoneFromBillNotes } from "../../lib/whatsappShare";
import { getWaiterPrinter } from "../../lib/waiterPrinterSettings";
import { PAYMENT_METHOD_LABELS } from "@platform/contracts";
import { linkActionClass, linkDangerClass, linkSuccessClass, linkWarningClass, tableOrderRefClass } from "../../lib/themeClasses";
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
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const canManageTables = displayRole === "admin" || displayRole === "manager";
  const canBulkDelete = displayRole === "admin";
  const businessDay = useMemo(
    () => loadBusinessDaySettings(branch?.code),
    [branch?.code],
  );
  const posSettings = useMemo(
    () => loadPosSettings(branch?.code),
    [branch?.code],
  );
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeFrom, setFilterTimeFrom] = useState("");
  const [filterTimeTo, setFilterTimeTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [heldBillToPay, setHeldBillToPay] = useState<Bill | null>(null);
  const [changeTableOrder, setChangeTableOrder] = useState<UnifiedOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkDeleteFrom, setBulkDeleteFrom] = useState("");
  const [bulkDeleteTo, setBulkDeleteTo] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    onSuccess: (bill) => {
      setHeldBillToPay(null);
      void ordersQuery.refetch();
      setNotice(`Payment completed — ${bill.billRef}`);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const deleteBillMutation = useMutation({
    mutationFn: (billId: string) => deleteBill(billId),
    onSuccess: (result) => {
      setSelectedOrder(null);
      void ordersQuery.refetch();
      setNotice(`Order deleted — ${result.billRef}`);
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
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const ref = unifiedOrderRef(o).toLowerCase();
      const table = unifiedOrderTable(o).toLowerCase();
      const waiter = unifiedOrderWaiter(o).toLowerCase();
      const extra =
        o.source === "bill"
          ? o.bill.billRef.toLowerCase()
          : o.ticket.ticketRef.toLowerCase() + o.ticket.itemsSummary.toLowerCase();
      return ref.includes(q) || table.includes(q) || waiter.includes(q) || extra.includes(q);
    });
  }, [allOrders, search, dateFilters, businessDay]);

  const salesSummary = useMemo(
    () => summarizeOrderSales(filtered, posSettings),
    [filtered, posSettings],
  );

  function reprint(bill: Bill): void {
    const printerName = getWaiterPrinter(branch?.code, bill.waiterId)?.printerName;
    const ok = printBill(branch?.name ?? "POPS", branch?.code ?? "—", bill, { printerName });
    setNotice(
      ok
        ? printerName
          ? `Reprinting ${bill.billRef} to ${printerName}…`
          : `Reprinting ${bill.billRef}…`
        : "Could not open print dialog.",
    );
  }

  function openOrder(order: UnifiedOrder): void {
    setSelectedOrder(order);
  }

  function editInPos(order: UnifiedOrder): void {
    if (order.source === "kitchen") {
      navigate("/pops/pos", { state: { editTicketId: order.ticket.id } });
      return;
    }
    if (order.bill.status === "held") {
      navigate("/pops/pos", { state: { editBillId: order.bill.id } });
    }
  }

  function confirmDeleteOrder(bill: Bill): void {
    if (!confirmDeleteBill(bill)) return;
    deleteBillMutation.mutate(bill.id);
  }

  async function bulkDeleteByDateRange(): Promise<void> {
    if (!bulkDeleteFrom || !bulkDeleteTo) {
      setNotice("Select both from and to dates for bulk delete.");
      return;
    }
    const billsToDelete = (ordersQuery.data ?? []).filter((bill) => {
      const key = businessDateKey(bill.createdAt, businessDay);
      return key >= bulkDeleteFrom && key <= bulkDeleteTo;
    });
    if (billsToDelete.length === 0) {
      setNotice("No bills found in the selected date range.");
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete ${billsToDelete.length} bill(s) from ${bulkDeleteFrom} to ${bulkDeleteTo}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBulkDeleting(true);
    let deleted = 0;
    try {
      for (const bill of billsToDelete) {
        await deleteBill(bill.id);
        deleted += 1;
      }
      void ordersQuery.refetch();
      setNotice(`Bulk delete complete — ${deleted} order(s) removed.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Bulk delete failed.");
    } finally {
      setBulkDeleting(false);
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

      {canBulkDelete ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="text-xs font-medium text-red-300">Bulk delete (admin only)</div>
          <label className="text-xs text-slate-400">
            From
            <input
              type="date"
              value={bulkDeleteFrom}
              onChange={(e) => setBulkDeleteFrom(e.target.value)}
              className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            To
            <input
              type="date"
              value={bulkDeleteTo}
              onChange={(e) => setBulkDeleteTo(e.target.value)}
              className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs text-red-300"
            disabled={bulkDeleting}
            onClick={() => void bulkDeleteByDateRange()}
          >
            {bulkDeleting ? "Deleting…" : "Delete orders in range"}
          </Button>
        </div>
      ) : null}

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
        <SimpleTable
          rowKey={(r) => r.id}
          rows={filtered}
          onRowClick={openOrder}
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
                    openOrder(r);
                  }}
                >
                  {unifiedOrderRef(r)}
                </button>
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
                <span className="flex gap-2" onClick={(e) => e.stopPropagation()} role="presentation">
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
                    >
                      Reprint
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
                  {canBulkDelete && r.source === "bill" ? (
                    <button
                      type="button"
                      className={`text-xs ${linkDangerClass}`}
                      onClick={() => confirmDeleteOrder(r.bill)}
                    >
                      Delete
                    </button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      )}

      {selectedOrder ? (
        <OrderDetailModal
          order={selectedOrder}
          branchName={branch.name}
          canChangeTable={canManageTables}
          onClose={() => setSelectedOrder(null)}
          onReprint={(bill) => reprint(bill)}
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
            canBulkDelete && selectedOrder.source === "bill"
              ? () => confirmDeleteOrder(selectedOrder.bill)
              : undefined
          }
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
    </div>
  );
}
