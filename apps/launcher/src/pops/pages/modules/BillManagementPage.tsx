import { Button } from "@platform/ui";
import type { Bill } from "@platform/contracts";
import { PAYMENT_METHOD_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePopsStore } from "../../../stores/popsStore";
import {
  completeBill,
  createBill,
  deleteBill,
  fetchCompletedOrders,
  fetchWaiters,
  updateBill,
  voidBill,
} from "../../api/billing";
import { fetchBranchMenuAdmin } from "../../api/menu";
import { loadBusinessDaySettings } from "../../lib/businessDay";
import { billChannelLabel, businessDateKey, filterOrdersByDateTime, ordersPageBills } from "../../lib/orderSales";
import { loadPosSettings } from "../../lib/posSettings";
import { discountAmountFromPct } from "../../lib/posDiscount";
import { confirmDeleteBill } from "../../lib/confirmDeleteBill";
import { printBill } from "../../lib/printTicket";
import {
  loadBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../../lib/billPrintSettings";
import { getWaiterPrinter } from "../../lib/waiterPrinterSettings";
import { BillCustomizationPanel } from "../../components/BillCustomizationPanel";
import { BillDetailModal } from "../../components/BillDetailModal";
import { BillFormModal, type BillFormValues } from "../../components/BillFormModal";
import { CompleteHeldBillModal } from "../../components/CompleteHeldBillModal";
import { OrderDateFiltersBar } from "../../components/OrderDateFiltersBar";
import {
  linkActionClass,
  linkDangerClass,
  linkSuccessClass,
  linkWarningClass,
  tableOrderRefClass,
} from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSearchInput,
} from "../../ui/ModuleToolbar";
import { SimpleTable } from "../../ui/SimpleTable";
import { BillManagementEmployeesPanel } from "./bills/BillManagementEmployeesPanel";
import { BillManagementSuppliersPanel } from "./bills/BillManagementSuppliersPanel";

type StatusFilter = "all" | "held" | "completed";
type BillManagementTab = "bills" | "suppliers" | "employees";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function billStatusTone(status: Bill["status"]): "success" | "warning" | "neutral" | "danger" {
  if (status === "completed") return "success";
  if (status === "held") return "warning";
  if (status === "void") return "danger";
  return "neutral";
}

function billStatusLabel(status: Bill["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "held") return "Held";
  if (status === "void") return "Void";
  return status;
}

function SummaryCard({
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
          "mt-1 text-2xl font-semibold tracking-tight",
          accent ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white",
        ].join(" ")}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function BillManagementPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const businessDay = useMemo(() => loadBusinessDaySettings(branch?.code), [branch?.code]);
  const posSettings = useMemo(() => loadPosSettings(branch?.code), [branch?.code]);
  const [billPrintSettings, setBillPrintSettings] = useState<BillPrintSettings>(() =>
    loadBillPrintSettings(branch?.code),
  );
  const [showCustomization, setShowCustomization] = useState(false);

  useEffect(() => {
    setBillPrintSettings(loadBillPrintSettings(branch?.code));
  }, [branch?.code]);

  function persistBillSettings(next: BillPrintSettings): void {
    if (!branch?.code) return;
    setBillPrintSettings(next);
    saveBillPrintSettings(branch.code, next);
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeFrom, setFilterTimeFrom] = useState("");
  const [filterTimeTo, setFilterTimeTo] = useState("");
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [heldToPay, setHeldToPay] = useState<Bill | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BillManagementTab>("bills");

  const billsQuery = useQuery({
    queryKey: ["bills", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCompletedOrders(branch!.code),
    refetchInterval: 10_000,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", "admin", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
  });

  const waitersQuery = useQuery({
    queryKey: ["waiters", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchWaiters(branch!.code),
  });

  const allBills = useMemo(() => ordersPageBills(billsQuery.data ?? []), [billsQuery.data]);

  const filteredBills = useMemo(() => {
    let rows = filterOrdersByDateTime(allBills, {
      year: filterYear,
      date: filterDate,
      timeFrom: filterTimeFrom,
      timeTo: filterTimeTo,
    }, businessDay);

    if (statusFilter !== "all") {
      rows = rows.filter((b) => b.status === statusFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          b.billRef.toLowerCase().includes(q) ||
          (b.orderRef?.toLowerCase().includes(q) ?? false) ||
          b.tableLabel.toLowerCase().includes(q) ||
          b.waiterName.toLowerCase().includes(q),
      );
    }

    return rows;
  }, [allBills, statusFilter, search, filterYear, filterDate, filterTimeFrom, filterTimeTo, businessDay]);

  const todayKey = businessDateKey(new Date(), businessDay);
  const todayBills = useMemo(
    () => allBills.filter((b) => businessDateKey(b.createdAt, businessDay) === todayKey),
    [allBills, todayKey, businessDay],
  );

  const summary = useMemo(() => {
    const held = allBills.filter((b) => b.status === "held");
    const completedToday = todayBills.filter((b) => b.status === "completed");
    const revenueToday = completedToday.reduce((s, b) => s + b.total, 0);
    return {
      heldCount: held.length,
      heldTotal: held.reduce((s, b) => s + b.total, 0),
      completedToday: completedToday.length,
      revenueToday,
    };
  }, [allBills, todayBills]);

  const availableYears = useMemo(() => {
    const years = new Set(allBills.map((b) => new Date(b.createdAt).getFullYear().toString()));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allBills]);

  const hasDateFilters =
    filterYear !== "all" || Boolean(filterDate) || Boolean(filterTimeFrom) || Boolean(filterTimeTo);

  function clearDateFilters(): void {
    setFilterYear("all");
    setFilterDate("");
    setFilterTimeFrom("");
    setFilterTimeTo("");
  }

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["bills"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  const createMutation = useMutation({
    mutationFn: async (values: BillFormValues) => {
      const discount = discountAmountFromPct(values.discountPct, values.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
      const waiter = waitersQuery.data?.find((w) => w.name === values.waiterName);
      return createBill({
        branchCode: branch!.code,
        orderRef: values.orderRef.trim() || undefined,
        tableLabel: values.tableLabel.trim(),
        waiterId: waiter?.id,
        waiterName: values.waiterName.trim(),
        notes: values.notes.trim() || undefined,
        lines: values.lines,
        discountPkr: discount > 0 ? discount : undefined,
        servicePct: values.servicePct,
        taxPct: values.taxPct,
        deliveryChargePkr: values.deliveryChargePkr > 0 ? values.deliveryChargePkr : undefined,
        status: values.saveAs,
        payments: values.saveAs === "completed" ? values.payments : undefined,
      });
    },
    onSuccess: (bill) => {
      invalidate();
      setFormMode(null);
      setFormError(null);
      setNotice(`Bill ${bill.billRef} created${bill.status === "held" ? " (held)" : ""}.`);
      if (bill.status === "completed" && branch) {
        printBill(branch.name, branch.code, bill, { billPrintSettings });
      }
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ billId, values }: { billId: string; values: BillFormValues }) => {
      const subtotal = values.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      const discount = discountAmountFromPct(values.discountPct, subtotal);
      return updateBill(billId, {
        tableLabel: values.tableLabel.trim(),
        lines: values.lines,
        notes: values.notes.trim() || null,
        discountPkr: discount,
        servicePct: values.servicePct,
        taxPct: values.taxPct,
        deliveryChargePkr: values.deliveryChargePkr,
      });
    },
    onSuccess: (bill) => {
      invalidate();
      setFormMode(null);
      setEditingBill(null);
      setFormError(null);
      setNotice(`Bill ${bill.billRef} updated.`);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const completeMutation = useMutation({
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
      setHeldToPay(null);
      invalidate();
      setNotice(`Payment completed — ${bill.billRef}`);
      if (branch) printBill(branch.name, branch.code, bill, { billPrintSettings });
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const voidMutation = useMutation({
    mutationFn: (billId: string) => voidBill(billId),
    onSuccess: (bill) => {
      invalidate();
      setDetailBill(null);
      setNotice(`Bill ${bill.billRef} voided.`);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (billId: string) => deleteBill(billId),
    onSuccess: (result) => {
      invalidate();
      setDetailBill(null);
      setNotice(`Order deleted — ${result.billRef}`);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  function reprint(bill: Bill): void {
    if (!branch) return;
    const printerName = getWaiterPrinter(branch.code, bill.waiterId)?.printerName;
    printBill(branch.name, branch.code, bill, { printerName, billPrintSettings });
    setNotice(`Invoice reprinted — ${bill.billRef}`);
  }

  function openEdit(bill: Bill, appendItem = false): void {
    if (bill.status !== "held") return;
    const nextBill = appendItem
      ? { ...bill, lines: [...bill.lines, { label: "", qty: 1, unitPrice: 0 }] }
      : bill;
    setEditingBill(nextBill);
    setFormMode("edit");
    setFormError(null);
    setDetailBill(null);
  }

  function confirmVoid(bill: Bill): void {
    if (!confirm(`Void bill ${bill.billRef}? This cannot be undone.`)) return;
    voidMutation.mutate(bill.id);
  }

  function confirmDelete(bill: Bill): void {
    if (!confirmDeleteBill(bill)) return;
    deleteMutation.mutate(bill.id);
  }

  if (!branch?.code) {
    return <PageHeader title="Bill management" subtitle="Select a branch to manage bills." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill management"
        subtitle={`Bills, suppliers, and employees for ${branch.name}.`}
        actions={
          activeTab === "bills" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="text-xs"
                onClick={() => setShowCustomization((v) => !v)}
              >
                {showCustomization ? "Hide customization" : "Bill customization"}
              </Button>
              <Button className="text-xs" onClick={() => { setFormMode("create"); setFormError(null); }}>
                Create bill
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900/60">
        {(
          [
            { id: "bills" as const, label: "Bills & orders" },
            { id: "suppliers" as const, label: "Suppliers" },
            { id: "employees" as const, label: "Employees" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      {activeTab === "suppliers" ? <BillManagementSuppliersPanel /> : null}
      {activeTab === "employees" ? <BillManagementEmployeesPanel /> : null}

      {activeTab === "bills" ? (
      <>
      {showCustomization ? (
        <BillCustomizationPanel
          branchName={branch.name}
          branchCode={branch.code}
          settings={billPrintSettings}
          onChange={setBillPrintSettings}
          onSave={() => {
            persistBillSettings(billPrintSettings);
            setNotice("Bill customization saved for this branch.");
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Held bills"
          value={String(summary.heldCount)}
          hint={summary.heldCount > 0 ? `Rs ${summary.heldTotal.toLocaleString()} pending` : "None pending"}
          accent={summary.heldCount > 0}
        />
        <SummaryCard
          label="Completed today"
          value={String(summary.completedToday)}
          hint={`Business day ${todayKey}`}
        />
        <SummaryCard
          label="Revenue today"
          value={`Rs ${summary.revenueToday.toLocaleString()}`}
          hint="Completed bills only"
          accent
        />
        <SummaryCard
          label="All bills"
          value={String(allBills.length)}
          hint="Held + completed"
        />
      </div>

      <ModuleFilterBar>
        <ModuleSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search bill ref, order, table, waiter…"
        />
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="held">Held</option>
          <option value="completed">Completed</option>
        </select>
        <ModuleCountBadge shown={filteredBills.length} total={allBills.length} />
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

      {billsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading bills…</p>
      ) : filteredBills.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
          No bills match your filters.
        </p>
      ) : (
        <SimpleTable
          rowKey={(r) => r.id}
          onRowClick={(r) => setDetailBill(r)}
          columns={[
            {
              key: "ref",
              header: "Bill",
              render: (r) => (
                <div>
                  <div className={tableOrderRefClass}>{r.billRef}</div>
                  {r.orderRef ? <div className="text-[10px] text-slate-500">{r.orderRef}</div> : null}
                </div>
              ),
            },
            {
              key: "channel",
              header: "Type",
              render: (r) => (
                <span className="text-xs text-slate-500">{billChannelLabel(r.tableLabel)}</span>
              ),
            },
            {
              key: "table",
              header: "Table",
              render: (r) => r.tableLabel,
            },
            {
              key: "waiter",
              header: "Waiter",
              render: (r) => <span className="text-xs text-slate-500">{r.waiterName}</span>,
            },
            {
              key: "items",
              header: "Items",
              render: (r) => (
                <span className="text-xs text-slate-500">
                  {r.lines.length} · {r.lines.reduce((s, l) => s + l.qty, 0)} qty
                </span>
              ),
            },
            {
              key: "payment",
              header: "Payment",
              render: (r) =>
                r.status === "completed" && r.payments.length > 0 ? (
                  <span className="text-xs text-slate-500">
                    {r.payments.map((p) => PAYMENT_METHOD_LABELS[p.method] ?? p.method).join(", ")}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "total",
              header: "Total",
              render: (r) => (
                <span className="tabular-nums font-medium">Rs {r.total.toLocaleString()}</span>
              ),
            },
            {
              key: "when",
              header: "When",
              render: (r) => <span className="text-xs text-slate-500">{formatWhen(r.createdAt)}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <Badge tone={billStatusTone(r.status)}>{billStatusLabel(r.status)}</Badge>,
            },
            {
              key: "actions",
              header: "",
              id: "actions",
              render: (r) => (
                <span className="flex gap-2" onClick={(e) => e.stopPropagation()} role="presentation">
                  <button type="button" className={`text-xs ${linkActionClass}`} onClick={() => setDetailBill(r)}>
                    View
                  </button>
                  {r.status === "held" ? (
                    <>
                      <button type="button" className={`text-xs ${linkSuccessClass}`} onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className={`text-xs ${linkWarningClass}`} onClick={() => setHeldToPay(r)}>
                        Pay
                      </button>
                    </>
                  ) : null}
                  {r.status === "completed" ? (
                    <button type="button" className={`text-xs ${linkWarningClass}`} onClick={() => reprint(r)}>
                      Reprint
                    </button>
                  ) : null}
                  {r.status === "held" || r.status === "completed" ? (
                    <button type="button" className={`text-xs ${linkDangerClass}`} onClick={() => confirmVoid(r)}>
                      Void
                    </button>
                  ) : null}
                  <button type="button" className={`text-xs ${linkDangerClass}`} onClick={() => confirmDelete(r)}>
                    Delete
                  </button>
                </span>
              ),
            },
          ]}
          rows={filteredBills}
        />
      )}

      {detailBill ? (
        <BillDetailModal
          bill={detailBill}
          branchName={branch.name}
          branchCode={branch.code}
          billPrintSettings={billPrintSettings}
          onClose={() => setDetailBill(null)}
          onReprint={detailBill.status === "completed" ? () => reprint(detailBill) : undefined}
          onEdit={detailBill.status === "held" ? () => openEdit(detailBill) : undefined}
          onAddItem={detailBill.status === "held" ? () => openEdit(detailBill, true) : undefined}
          onPay={detailBill.status === "held" ? () => { setHeldToPay(detailBill); setDetailBill(null); } : undefined}
          onVoid={
            detailBill.status === "held" || detailBill.status === "completed"
              ? () => confirmVoid(detailBill)
              : undefined
          }
          onDelete={() => confirmDelete(detailBill)}
        />
      ) : null}

      {formMode === "create" ? (
        <BillFormModal
          mode="create"
          branchName={branch.name}
          branchCode={branch.code}
          menuItems={menuQuery.data?.items ?? []}
          waiters={waitersQuery.data ?? []}
          defaultServicePct={posSettings.servicePct}
          defaultTaxPct={posSettings.taxPct}
          billPrintSettings={billPrintSettings}
          loading={createMutation.isPending}
          error={formError}
          onClose={() => { setFormMode(null); setFormError(null); }}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      {formMode === "edit" && editingBill ? (
        <BillFormModal
          key={`${editingBill.id}-${editingBill.lines.length}`}
          mode="edit"
          bill={editingBill}
          branchName={branch.name}
          branchCode={branch.code}
          menuItems={menuQuery.data?.items ?? []}
          waiters={waitersQuery.data ?? []}
          defaultServicePct={posSettings.servicePct}
          defaultTaxPct={posSettings.taxPct}
          billPrintSettings={billPrintSettings}
          loading={updateMutation.isPending}
          error={formError}
          onClose={() => { setFormMode(null); setEditingBill(null); setFormError(null); }}
          onSubmit={(values) => updateMutation.mutate({ billId: editingBill.id, values })}
        />
      ) : null}

      {heldToPay ? (
        <CompleteHeldBillModal
          bill={heldToPay}
          isSubmitting={completeMutation.isPending}
          onClose={() => setHeldToPay(null)}
          onConfirm={({ servicePct, taxPct, payments }) =>
            completeMutation.mutate({ billId: heldToPay.id, servicePct, taxPct, payments })
          }
        />
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
        Need full POS checkout with menu grid?{" "}
        <button type="button" className={linkActionClass} onClick={() => navigate("/pops/pos")}>
          Open POS
        </button>
        {" · "}
        <button type="button" className={linkActionClass} onClick={() => navigate("/pops/orders")}>
          View all orders
        </button>
      </div>
      </>
      ) : null}
    </div>
  );
}
