import type { PoStatus, PurchaseOrder, VendorBill } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { fetchVendorBills } from "../../api/accounting";
import { fetchBranchInventory } from "../../api/inventory";
import { formatPkr, useInventoryAccess } from "../../hooks/useInventory";
import {
  cardClass,
  linkActionClass,
  linkDangerClass,
  linkWarningClass,
  mutedClass,
  panelTitleClass,
} from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { InventoryError, InventoryLoading } from "./inventory/InventoryUi";

const OPEN_PO_STATUSES = new Set<PoStatus>([
  "Draft",
  "Pending",
  "Approved",
  "Ordered",
  "Partially Received",
]);

function poTone(status: PoStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "Draft") return "neutral";
  if (status === "Pending" || status === "Partially Received") return "warning";
  if (status === "Approved" || status === "Ordered") return "info";
  if (status === "Received") return "success";
  return "danger";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function supplierSnapshot(bills: VendorBill[]) {
  const today = todayIso();
  const payables = bills.reduce((sum, b) => sum + Math.max(0, b.balance), 0);
  const overdue = bills.reduce((sum, b) => {
    if (b.balance <= 0 || !b.dueDate || b.dueDate >= today) return sum;
    return sum + b.balance;
  }, 0);
  const paidBills = bills
    .filter((b) => b.status === "paid")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastPayment = paidBills[0]?.createdAt ?? null;
  const openBillCount = bills.filter((b) => b.balance > 0).length;
  const supplierCount = new Set(bills.filter((b) => b.balance > 0).map((b) => b.supplierId)).size;
  return { payables, overdue, lastPayment, openBillCount, supplierCount };
}

export function PurchasePage(): JSX.Element {
  const { branch } = useInventoryAccess();

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const payableQuery = useQuery({
    queryKey: ["accounting", "payable", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchVendorBills(branch!.code),
  });

  const openOrders = useMemo(() => {
    const orders = inventoryQuery.data?.purchaseOrders ?? [];
    return [...orders]
      .filter((po) => OPEN_PO_STATUSES.has(po.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [inventoryQuery.data?.purchaseOrders]);

  const suppliers = inventoryQuery.data?.suppliers ?? [];
  const recentGrns = useMemo(() => {
    const receipts = inventoryQuery.data?.goodsReceipts ?? [];
    return [...receipts]
      .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime())
      .slice(0, 5);
  }, [inventoryQuery.data?.goodsReceipts]);

  const snapshot = useMemo(
    () => supplierSnapshot(payableQuery.data ?? []),
    [payableQuery.data],
  );

  if (!branch?.code) {
    return <InventoryError message="Select a branch to view purchase data." />;
  }

  if (inventoryQuery.isLoading || payableQuery.isLoading) return <InventoryLoading />;
  if (inventoryQuery.isError) {
    return <InventoryError message={(inventoryQuery.error as Error).message} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase & suppliers"
        subtitle="Live purchase orders, GRN, supplier ledger, and payables for this branch."
        actions={
          <>
            <Link
              to="/pops/inventory/purchase-orders"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              New PO
            </Link>
            <Link
              to="/pops/inventory/goods-receiving"
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              Record GRN
            </Link>
          </>
        }
      />

      {payableQuery.isError ? (
        <InventoryError message={(payableQuery.error as Error).message} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${cardClass} p-4`}>
          <div className={`text-xs ${mutedClass}`}>Open POs</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{openOrders.length}</div>
        </div>
        <div className={`${cardClass} p-4`}>
          <div className={`text-xs ${mutedClass}`}>Active suppliers</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {suppliers.filter((s) => s.active).length}
          </div>
        </div>
        <div className={`${cardClass} p-4`}>
          <div className={`text-xs ${mutedClass}`}>Open payables</div>
          <div className={`mt-1 text-xl font-semibold ${linkWarningClass}`}>{formatPkr(snapshot.payables)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${cardClass} p-4 lg:col-span-2`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className={panelTitleClass}>Open purchase orders</div>
            <Link to="/pops/inventory/purchase-orders" className={`text-xs ${linkActionClass}`}>
              Manage POs →
            </Link>
          </div>

          {openOrders.length === 0 ? (
            <div className={`rounded-lg border border-dashed border-slate-300 p-6 text-sm ${mutedClass} dark:border-slate-700`}>
              No open purchase orders. Create one from Kitchen demand / Purchase orders.
            </div>
          ) : (
            <SimpleTable<PurchaseOrder>
              rowKey={(r) => r.id}
              columns={[
                { key: "poNumber", header: "PO #" },
                { key: "supplierName", header: "Supplier" },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge tone={poTone(r.status)}>{r.status}</Badge>,
                },
                {
                  key: "expectedDate",
                  header: "Due",
                  render: (r) => formatShortDate(r.expectedDate),
                },
                {
                  key: "totalAmount",
                  header: "Amount",
                  render: (r) => formatPkr(r.totalAmount),
                },
              ]}
              rows={openOrders}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className={`${cardClass} p-4`}>
            <div className={panelTitleClass}>Supplier snapshot</div>
            <ul className={`mt-3 space-y-2 text-sm ${mutedClass}`}>
              <li className="flex justify-between gap-3">
                <span>Payables</span>
                <span className={linkWarningClass}>{formatPkr(snapshot.payables)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Overdue</span>
                <span className={linkDangerClass}>{formatPkr(snapshot.overdue)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Open bills</span>
                <span className="text-slate-800 dark:text-slate-200">{snapshot.openBillCount}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Suppliers owed</span>
                <span className="text-slate-800 dark:text-slate-200">{snapshot.supplierCount}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Last payment</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatShortDate(snapshot.lastPayment)}
                </span>
              </li>
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/pops/accounting/payable"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Supplier payments
              </Link>
              <Link
                to="/pops/inventory/suppliers"
                className={`block w-full text-center text-xs ${linkActionClass}`}
              >
                Manage suppliers →
              </Link>
            </div>
          </div>

          <div className={`${cardClass} p-4`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className={panelTitleClass}>Recent GRN</div>
              <Link to="/pops/inventory/goods-receiving" className={`text-xs ${linkActionClass}`}>
                Receive →
              </Link>
            </div>
            {recentGrns.length === 0 ? (
              <p className={`text-sm ${mutedClass}`}>No goods receipts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentGrns.map((grn) => (
                  <li
                    key={grn.id}
                    className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2 last:border-0 last:pb-0 dark:border-slate-800"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{grn.grnNumber}</div>
                      <div className={mutedClass}>
                        {grn.supplierName}
                        {grn.poNumber ? ` · ${grn.poNumber}` : ""}
                      </div>
                    </div>
                    <div className={`shrink-0 text-right text-xs ${mutedClass}`}>
                      {formatShortDate(grn.deliveryDate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
