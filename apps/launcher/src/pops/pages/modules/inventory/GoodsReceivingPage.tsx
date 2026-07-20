import type { PurchaseOrder } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createGoodsReceipt, fetchBranchInventory } from "../../../api/inventory";
import { GrnIngredientPickerModal } from "../../../components/GrnIngredientPickerModal";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";
import { InventoryFlowBanner } from "./InventoryFlowBanner";

type LineDefaults = {
  qty: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
};

type GrnLine = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  qty: number;
  unitCost: number;
  batchNumber: string;
  expiryDate: string;
  orderedQty?: number;
  alreadyReceivedQty?: number;
};

const DEFAULT_LINE_VALUES = (): LineDefaults => ({
  qty: "1",
  unitCost: "0",
  batchNumber: "",
  expiryDate: "",
});

function remainingPoQty(po: PurchaseOrder): GrnLine[] {
  return (po.lines ?? [])
    .map((line) => {
      const remaining = Math.max(0, line.qty - line.receivedQty);
      if (remaining <= 0) return null;
      return {
        id: crypto.randomUUID(),
        ingredientId: line.ingredientId,
        ingredientName: line.ingredientName,
        unit: line.unit,
        qty: remaining,
        unitCost: line.unitCost,
        batchNumber: "",
        expiryDate: "",
        orderedQty: line.qty,
        alreadyReceivedQty: line.receivedQty,
      } satisfies GrnLine;
    })
    .filter((line): line is GrnLine => line != null);
}

export function GoodsReceivingPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [header, setHeader] = useState({
    supplierId: "",
    purchaseOrderId: "",
    invoiceNumber: "",
    deliveryDate: new Date().toISOString().slice(0, 10),
    receivedBy: "",
  });
  const [lineDefaults, setLineDefaults] = useState<LineDefaults>(DEFAULT_LINE_VALUES);
  const [lines, setLines] = useState<GrnLine[]>([]);

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const ingredients = query.data?.ingredients ?? [];
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ing) => [ing.id, ing])),
    [ingredients],
  );
  const stagedIngredientIds = useMemo(() => new Set(lines.map((line) => line.ingredientId)), [lines]);
  const openPos =
    query.data?.purchaseOrders.filter((p) => p.status !== "Received" && p.status !== "Cancelled") ?? [];

  function applyPurchaseOrder(poId: string): void {
    if (!poId) {
      setHeader((prev) => ({ ...prev, purchaseOrderId: "", supplierId: prev.supplierId }));
      return;
    }
    const po = openPos.find((p) => p.id === poId) ?? query.data?.purchaseOrders.find((p) => p.id === poId);
    if (!po) {
      setError("Purchase order not found.");
      return;
    }
    const remaining = remainingPoQty(po);
    setHeader((prev) => ({
      ...prev,
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
    }));
    setLines(remaining);
    setError(null);
    setNotice(
      remaining.length > 0
        ? `Loaded ${remaining.length} open line(s) from ${po.poNumber} (${po.supplierName}). Edit qty, then Receive goods.`
        : `${po.poNumber} has no remaining quantity to receive.`,
    );
  }

  // Deep-link from Kitchen Demand / PO history: /goods-receiving?poId=...
  useEffect(() => {
    const poId = searchParams.get("poId");
    if (!poId || !query.data) return;
    const po =
      query.data.purchaseOrders.find((p) => p.id === poId) ??
      null;
    if (!po) return;
    const remaining = remainingPoQty(po);
    setHeader((prev) => ({
      ...prev,
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
    }));
    setLines(remaining);
    setNotice(
      remaining.length > 0
        ? `Loaded ${remaining.length} open line(s) from ${po.poNumber} (${po.supplierName}). Edit qty, then Receive goods.`
        : `${po.poNumber} has no remaining quantity to receive.`,
    );
    setSearchParams({}, { replace: true });
  }, [query.data, searchParams, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: () =>
      createGoodsReceipt({
        branchCode: branch!.code,
        supplierId: header.supplierId,
        purchaseOrderId: header.purchaseOrderId || undefined,
        invoiceNumber: header.invoiceNumber || undefined,
        deliveryDate: header.deliveryDate,
        receivedBy: header.receivedBy || undefined,
        lines: lines.map((line) => ({
          ingredientId: line.ingredientId,
          qty: line.qty,
          unit: line.unit,
          unitCost: line.unitCost,
          batchNumber: line.batchNumber || undefined,
          expiryDate: line.expiryDate || undefined,
        })),
      }),
    onSuccess: () => {
      invalidate();
      setError(null);
      setNotice("Goods received — inventory updated.");
      setLines([]);
      setLineDefaults(DEFAULT_LINE_VALUES());
      setHeader((prev) => ({
        ...prev,
        purchaseOrderId: "",
        invoiceNumber: "",
      }));
    },
    onError: (e: Error) => {
      setNotice(null);
      setError(e.message);
    },
  });

  function parseLineDefaults(): { qty: number; unitCost: number; batchNumber: string; expiryDate: string } | null {
    const qty = Number(lineDefaults.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a valid quantity.");
      return null;
    }
    const unitCost = Number(lineDefaults.unitCost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError("Enter a valid unit cost.");
      return null;
    }
    return {
      qty: Math.round(qty),
      unitCost: Math.round(unitCost),
      batchNumber: lineDefaults.batchNumber.trim(),
      expiryDate: lineDefaults.expiryDate,
    };
  }

  function addIngredients(ingredientIds: string[]): void {
    const defaults = parseLineDefaults();
    if (!defaults) return;

    const newLines: GrnLine[] = [];
    for (const ingredientId of ingredientIds) {
      if (stagedIngredientIds.has(ingredientId)) continue;
      const ing = ingredientById.get(ingredientId);
      if (!ing) continue;
      const unitCost = defaults.unitCost > 0 ? defaults.unitCost : Math.round(ing.unitCost);
      newLines.push({
        id: crypto.randomUUID(),
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        qty: defaults.qty,
        unitCost,
        batchNumber: defaults.batchNumber,
        expiryDate: defaults.expiryDate,
      });
    }

    if (newLines.length === 0) {
      setError("Selected ingredients are already on the list.");
      return;
    }

    setLines((prev) => [...prev, ...newLines]);
    setPickerOpen(false);
    setError(null);
    setNotice(null);
  }

  function updateLine(lineId: string, patch: Partial<GrnLine>): void {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function removeLine(lineId: string): void {
    setLines((prev) => prev.filter((line) => line.id !== lineId));
  }

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const suppliers = query.data?.suppliers.filter((s) => s.active) ?? [];
  const receipts = query.data?.goodsReceipts ?? [];
  const stagedTotal = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
  const linkedPo = openPos.find((p) => p.id === header.purchaseOrderId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Goods receiving"
        subtitle="Receive against a purchase order (Kitchen Demand) or record an ad-hoc delivery."
      />
      <InventoryFlowBanner activeStep="Goods Receiving" />
      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel
          title="Record GRN"
          submitLabel="Receive goods"
          onSubmit={() => createMutation.mutate()}
          disabled={!header.supplierId || lines.length === 0 || createMutation.isPending}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className={selectClass}
              value={header.purchaseOrderId}
              onChange={(e) => applyPurchaseOrder(e.target.value)}
            >
              <option value="">Select purchase order…</option>
              {openPos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber} · {p.supplierName} · {p.status}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={header.supplierId}
              onChange={(e) => setHeader({ ...header, supplierId: e.target.value })}
            >
              <option value="">Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder="Invoice #"
              value={header.invoiceNumber}
              onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })}
            />
            <input
              className={inputClass}
              type="date"
              value={header.deliveryDate}
              onChange={(e) => setHeader({ ...header, deliveryDate: e.target.value })}
            />
          </div>

          {linkedPo ? (
            <p className="text-[11px] text-slate-400">
              Receiving against <span className="font-medium text-amber-200">{linkedPo.poNumber}</span>
              {" · "}
              {linkedPo.supplierName}
              {" · "}
              <Link to="/pops/inventory/purchase-orders" className="text-sky-400 hover:text-sky-300">
                Back to Kitchen Demand
              </Link>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Tip: pick a PO to auto-fill supplier and remaining quantities, or add ingredients manually.
            </p>
          )}

          <div className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Add extra items (optional)
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={`${inputClass} flex items-center justify-between text-left`}
              >
                <span className={lines.length > 0 ? "text-slate-200" : "text-slate-500"}>
                  {lines.length > 0
                    ? `${lines.length} ingredient${lines.length === 1 ? "" : "s"} on list`
                    : "Select ingredients…"}
                </span>
                <span className="text-slate-500" aria-hidden>
                  ▾
                </span>
              </button>
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="Default qty"
                value={lineDefaults.qty}
                onChange={(e) => setLineDefaults({ ...lineDefaults, qty: e.target.value })}
              />
              <input
                className={inputClass}
                type="number"
                min={0}
                placeholder="Default unit cost"
                value={lineDefaults.unitCost}
                onChange={(e) => setLineDefaults({ ...lineDefaults, unitCost: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Batch #"
                value={lineDefaults.batchNumber}
                onChange={(e) => setLineDefaults({ ...lineDefaults, batchNumber: e.target.value })}
              />
              <input
                className={inputClass}
                type="date"
                placeholder="Expiry"
                value={lineDefaults.expiryDate}
                onChange={(e) => setLineDefaults({ ...lineDefaults, expiryDate: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
              >
                + Add item
              </button>
            </div>
          </div>

          {lines.length > 0 ? (
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/20">
              <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2">
                <span className="text-xs font-medium text-slate-300">
                  {lines.length} item{lines.length === 1 ? "" : "s"} to receive — edit qty as needed
                </span>
                <span className="text-xs font-semibold text-amber-200">Rs {stagedTotal.toLocaleString()}</span>
              </div>
              <SimpleTable
                rowKey={(row) => row.id}
                columns={[
                  { key: "name", header: "Ingredient", render: (row) => row.ingredientName },
                  {
                    key: "ordered",
                    header: "Ordered",
                    render: (row) =>
                      row.orderedQty != null ? `${row.orderedQty} ${row.unit}` : "—",
                  },
                  {
                    key: "prev",
                    header: "Already recv.",
                    render: (row) =>
                      row.alreadyReceivedQty != null ? `${row.alreadyReceivedQty} ${row.unit}` : "—",
                  },
                  {
                    key: "qty",
                    header: "Receive qty",
                    render: (row) => (
                      <input
                        className={`${inputClass} w-24 py-1`}
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) =>
                          updateLine(row.id, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })
                        }
                      />
                    ),
                  },
                  {
                    key: "cost",
                    header: "Unit cost",
                    render: (row) => (
                      <input
                        className={`${inputClass} w-28 py-1`}
                        type="number"
                        min={0}
                        value={row.unitCost}
                        onChange={(e) =>
                          updateLine(row.id, {
                            unitCost: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          })
                        }
                      />
                    ),
                  },
                  {
                    key: "lineTotal",
                    header: "Line total",
                    render: (row) => `Rs ${(row.qty * row.unitCost).toLocaleString()}`,
                  },
                  {
                    key: "batch",
                    header: "Batch",
                    render: (row) => (
                      <input
                        className={`${inputClass} w-28 py-1`}
                        value={row.batchNumber}
                        onChange={(e) => updateLine(row.id, { batchNumber: e.target.value })}
                      />
                    ),
                  },
                  {
                    key: "expiry",
                    header: "Expiry",
                    render: (row) => (
                      <input
                        className={`${inputClass} w-36 py-1`}
                        type="date"
                        value={row.expiryDate}
                        onChange={(e) => updateLine(row.id, { expiryDate: e.target.value })}
                      />
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    render: (row) => (
                      <button
                        type="button"
                        onClick={() => removeLine(row.id)}
                        className="text-[11px] text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    ),
                  },
                ]}
                rows={lines}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Select a purchase order to load remaining quantities, or add ingredients manually.
            </p>
          )}
        </InventoryFormPanel>
      ) : null}

      {pickerOpen ? (
        <GrnIngredientPickerModal
          ingredients={ingredients}
          excludedIds={stagedIngredientIds}
          onClose={() => setPickerOpen(false)}
          onConfirm={addIngredients}
        />
      ) : null}

      {receipts.map((gr) => (
        <div key={gr.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-white">{gr.grnNumber}</div>
              <div className="mt-1 text-xs text-slate-500">
                {gr.supplierName}
                {gr.poNumber ? ` · PO ${gr.poNumber}` : ""} · Invoice {gr.invoiceNumber ?? "—"} · {gr.deliveryDate}
              </div>
            </div>
            <div className="text-sm text-amber-200">Rs {gr.totalCost.toLocaleString()}</div>
          </div>
          <div className="mt-3">
            <SimpleTable
              rowKey={(r) => r.id}
              columns={[
                { key: "name", header: "Ingredient" },
                { key: "qty", header: "Qty", render: (r) => `${r.qty} ${r.unit}` },
                { key: "batch", header: "Batch", render: (r) => r.batch ?? "—" },
                { key: "expiry", header: "Expiry", render: (r) => r.expiry ?? "—" },
              ]}
              rows={gr.items}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
