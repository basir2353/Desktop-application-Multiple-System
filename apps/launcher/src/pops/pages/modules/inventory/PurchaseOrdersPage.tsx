import { PO_STATUSES, type PoStatus, type PurchaseOrder } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPurchaseOrder, fetchBranchInventory, updatePurchaseOrderStatus } from "../../../api/inventory";
import { formatPkr, inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import {
  cardClass,
  emptyStateBoxClass,
  linkDangerClass,
  mutedClass,
  tableCellAmountClass,
  tableOrderRefClass,
} from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryLoading } from "./InventoryUi";
import { InventoryFlowBanner } from "./InventoryFlowBanner";

function poTone(status: PoStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "Draft") return "neutral";
  if (status === "Pending" || status === "Partially Received") return "warning";
  if (status === "Approved" || status === "Ordered") return "info";
  if (status === "Received") return "success";
  return "danger";
}

type PoLineRow = { ingredientId: string; qty: string; unitCost: string };

function emptyLine(): PoLineRow {
  return { ingredientId: "", qty: "1", unitCost: "0" };
}

function FieldLabel({ children }: { children: string }): JSX.Element {
  return (
    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {children}
    </span>
  );
}

export function PurchaseOrdersPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    supplierId: "",
    expectedDate: "",
    requestedBy: "",
    chef: "",
  });
  const [lines, setLines] = useState<PoLineRow[]>([emptyLine()]);

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  function updateLine(index: number, patch: Partial<PoLineRow>): void {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine(): void {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number): void {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function resetForm(): void {
    setMeta({ supplierId: "", expectedDate: "", requestedBy: "", chef: "" });
    setLines([emptyLine()]);
  }

  const validLines = lines.filter((line) => line.ingredientId && Number(line.qty) > 0);

  const createMutation = useMutation({
    mutationFn: () => {
      const ingredients = query.data?.ingredients ?? [];
      return createPurchaseOrder({
        branchCode: branch!.code,
        supplierId: meta.supplierId,
        expectedDate: meta.expectedDate || undefined,
        requestedBy: meta.requestedBy || undefined,
        chef: meta.chef || undefined,
        lines: validLines.map((line) => {
          const ing = ingredients.find((i) => i.id === line.ingredientId);
          return {
            ingredientId: line.ingredientId,
            qty: Number(line.qty),
            unit: ing?.unit ?? "Kg",
            unitCost: Number(line.unitCost),
          };
        }),
      });
    },
    onSuccess: () => {
      invalidate();
      setError(null);
      resetForm();
    },
    onError: (e: Error) => setError(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PoStatus }) => updatePurchaseOrderStatus(id, { status }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const suppliers = query.data?.suppliers.filter((s) => s.active) ?? [];
  const ingredients = query.data?.ingredients ?? [];
  const orders = query.data?.purchaseOrders ?? [];

  const stats = useMemo(() => {
    const pending = orders.filter((o) => ["Draft", "Pending", "Approved", "Ordered"].includes(o.status)).length;
    const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    return { total: orders.length, pending, totalValue };
  }, [orders]);

  const estimatedTotal = validLines.reduce((sum, line) => sum + Number(line.qty) * Number(line.unitCost), 0);

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen demand"
        subtitle="Create supplier purchase orders from kitchen demand, then receive goods with quantities."
        actions={
          <Link
            to="/pops/inventory/goods-receiving"
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500"
          >
            Receive goods
          </Link>
        }
      />

      <InventoryFlowBanner activeStep="Purchase Order" />

      <div className="grid gap-3 sm:grid-cols-3">
        <div data-ui="dashboard-stat-card">
          <div className="dashboard-stat-label">Total orders</div>
          <div className="dashboard-stat-value text-2xl">{stats.total}</div>
        </div>
        <div data-ui="dashboard-stat-card">
          <div className="dashboard-stat-label">Pending approval</div>
          <div className="dashboard-stat-value text-2xl text-amber-700 dark:text-amber-300">{stats.pending}</div>
        </div>
        <div data-ui="dashboard-stat-card">
          <div className="dashboard-stat-label">Total order value</div>
          <div className="dashboard-stat-value text-2xl">{formatPkr(stats.totalValue)}</div>
        </div>
      </div>

      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <form
          className={`${cardClass} overflow-hidden shadow-sm`}
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">New kitchen demand / PO</h2>
              <p className={`mt-0.5 text-xs ${mutedClass}`}>
                Choose a supplier (e.g. Kitchen Fresh Pvt. Ltd.), add items and quantities, then approve and receive.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-200"
              onClick={() => {
                const low = ingredients.filter((i) => i.currentStock <= i.reorderLevel);
                if (low.length === 0) {
                  setError("No low-stock ingredients to fill from kitchen demand.");
                  return;
                }
                setLines(
                  low.map((ing) => ({
                    ingredientId: ing.id,
                    qty: String(Math.max(1, ing.reorderLevel - ing.currentStock + ing.reorderLevel)),
                    unitCost: String(ing.unitCost),
                  })),
                );
                setError(null);
              }}
            >
              Fill from low stock
            </button>
          </div>

          <div className="space-y-6 p-5">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Order details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label>
                  <FieldLabel>Supplier</FieldLabel>
                  <select className={selectClass} value={meta.supplierId} onChange={(e) => setMeta({ ...meta, supplierId: e.target.value })} required>
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label>
                  <FieldLabel>Expected date</FieldLabel>
                  <input className={inputClass} type="date" value={meta.expectedDate} onChange={(e) => setMeta({ ...meta, expectedDate: e.target.value })} />
                </label>
                <label>
                  <FieldLabel>Requested by</FieldLabel>
                  <input className={inputClass} placeholder="Staff name" value={meta.requestedBy} onChange={(e) => setMeta({ ...meta, requestedBy: e.target.value })} />
                </label>
                <label>
                  <FieldLabel>Chef</FieldLabel>
                  <input className={inputClass} placeholder="Chef name" value={meta.chef} onChange={(e) => setMeta({ ...meta, chef: e.target.value })} />
                </label>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Line items
                </h3>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estimated total</div>
                  <div className={`text-lg font-bold tabular-nums ${tableCellAmountClass}`}>{formatPkr(estimatedTotal)}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Ingredient</th>
                      <th className="w-24 px-3 py-2.5 text-left">Qty</th>
                      <th className="w-32 px-3 py-2.5 text-left">Unit cost</th>
                      <th className="w-20 px-3 py-2.5 text-left">Unit</th>
                      <th className="w-16 px-3 py-2.5 text-right">Line total</th>
                      <th className="w-10 px-2 py-2.5" aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.map((line, index) => {
                      const ing = ingredients.find((i) => i.id === line.ingredientId);
                      const lineTotal = Number(line.qty) * Number(line.unitCost);
                      return (
                        <tr key={index} className="bg-white dark:bg-slate-900/20">
                          <td className="px-3 py-2 text-xs text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2">
                            <select className={selectClass} value={line.ingredientId} onChange={(e) => updateLine(index, { ingredientId: e.target.value })}>
                              <option value="">Select ingredient</option>
                              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputClass} type="number" min={1} placeholder="Qty" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputClass} type="number" min={0} placeholder="0" value={line.unitCost} onChange={(e) => updateLine(index, { unitCost: e.target.value })} />
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">{ing?.unit ?? "—"}</td>
                          <td className={`px-3 py-2 text-right text-xs tabular-nums ${line.ingredientId ? tableCellAmountClass : "text-slate-400"}`}>
                            {line.ingredientId ? formatPkr(lineTotal) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              className={`rounded p-1 text-xs ${linkDangerClass} hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30`}
                              onClick={() => removeLine(index)}
                              disabled={lines.length === 1}
                              aria-label="Remove item"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addLine}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              >
                <span className="text-base leading-none">+</span> Add item
              </button>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <span className={`text-xs ${mutedClass}`}>
              {validLines.length} item{validLines.length === 1 ? "" : "s"} ready to submit
            </span>
            <button
              type="submit"
              disabled={!meta.supplierId || validLines.length === 0 || createMutation.isPending}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : `Create purchase order`}
            </button>
          </div>
        </form>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Order history</h2>
          <span className={`text-xs ${mutedClass}`}>{orders.length} total</span>
        </div>

        {orders.length === 0 ? (
          <div className={emptyStateBoxClass}>
            No purchase orders yet. Create your first kitchen demand request above.
          </div>
        ) : (
          <SimpleTable<PurchaseOrder>
            rowKey={(r) => r.id}
            columns={[
              {
                key: "poNumber",
                header: "PO #",
                render: (r) => <span className={tableOrderRefClass}>{r.poNumber}</span>,
              },
              { key: "supplierName", header: "Supplier", render: (r) => <span className="font-medium">{r.supplierName}</span> },
              { key: "status", header: "Status", render: (r) => <Badge tone={poTone(r.status)}>{r.status}</Badge> },
              { key: "items", header: "Items", render: (r) => <span className="tabular-nums">{r.items}</span> },
              {
                key: "lines",
                header: "Demand lines",
                render: (r) =>
                  r.lines && r.lines.length > 0 ? (
                    <span className="text-[11px] text-slate-400">
                      {r.lines
                        .slice(0, 3)
                        .map((l) => `${l.ingredientName} ×${l.qty}`)
                        .join(", ")}
                      {r.lines.length > 3 ? ` +${r.lines.length - 3}` : ""}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "totalAmount",
                header: "Amount",
                render: (r) => <span className={tableCellAmountClass}>{formatPkr(r.totalAmount)}</span>,
              },
              { key: "expectedDate", header: "Expected", render: (r) => r.expectedDate ?? "—" },
              { key: "chef", header: "Chef", render: (r) => r.chef ?? "—" },
              ...(canManage
                ? [
                    {
                      id: "actions",
                      key: "id" as const,
                      header: "Actions",
                      render: (r: PurchaseOrder) => (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className={`${selectClass} py-1.5 text-xs`}
                            value={r.status}
                            onChange={(e) =>
                              statusMutation.mutate({ id: r.id, status: e.target.value as PoStatus })
                            }
                          >
                            {PO_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {r.status !== "Received" && r.status !== "Cancelled" ? (
                            <Link
                              to={`/pops/inventory/goods-receiving?poId=${r.id}`}
                              className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                            >
                              Receive
                            </Link>
                          ) : null}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={orders}
          />
        )}
      </section>
    </div>
  );
}
