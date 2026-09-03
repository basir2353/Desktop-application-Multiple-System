import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchStoreProducts } from "../../../../store/api/store";
import {
  createInventoryTransfer,
  fetchInventoryCookingUnits,
  fetchInventoryTransfers,
  fetchInventoryWarehouses,
} from "../../../api/inventory";
import { StoreProductPickerModal } from "../../../components/StoreProductPickerModal";
import { useInventoryAccess, inputClass, selectClass } from "../../../hooks/useInventory";
import { PageHeader } from "../../../ui/PageHeader";

type TransferRow = {
  id: string;
  productId: string;
  qty: string;
  cookingUnitId: string;
};

function newTransferRow(): TransferRow {
  return { id: `${Date.now()}-${Math.random()}`, productId: "", qty: "1", cookingUnitId: "" };
}

export function InventoryWarehousePanel(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const queryClient = useQueryClient();
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [defaultCookingUnitId, setDefaultCookingUnitId] = useState("");

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "warehouses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryWarehouses(branch!.code),
  });
  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });
  const unitsQuery = useQuery({
    queryKey: ["inventory", "cooking-units", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnits(branch!.code),
  });
  const transfersQuery = useQuery({
    queryKey: ["inventory", "transfers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryTransfers(branch!.code),
  });

  useEffect(() => {
    const warehouses = warehousesQuery.data?.warehouses ?? [];
    if (!fromWarehouseId) {
      setFromWarehouseId(
        warehouses.find((warehouse) => warehouse.isDefault)?.id ??
          warehouses.find((warehouse) => warehouse.code === "SIMPLE-STORE" || warehouse.code === "WH-01")?.id ??
          warehouses.find((warehouse) => /main warehouse|simple store/i.test(warehouse.name))?.id ??
          "",
      );
    }
    if (!toWarehouseId) {
      setToWarehouseId(warehouses.find((warehouse) => warehouse.code === "KITCHEN")?.id ?? "");
    }
  }, [fromWarehouseId, toWarehouseId, warehousesQuery.data]);

  const transferMutation = useMutation({
    mutationFn: () => {
      if (!branch?.code || !fromWarehouseId || !toWarehouseId) {
        throw new Error("Select source and destination warehouses");
      }
      const kitchen = warehousesQuery.data?.warehouses.find((warehouse) => warehouse.id === toWarehouseId);
      const items = rows.map((row) => ({
        productId: row.productId,
        qty: Number(row.qty),
        cookingUnitId: row.cookingUnitId || null,
      }));
      if (items.length === 0) {
        throw new Error("Add at least one item to this transfer");
      }
      if (items.some((item) => !item.productId || !Number.isInteger(item.qty) || item.qty < 1)) {
        throw new Error("Select an item and enter a whole quantity for every row");
      }
      if (kitchen?.code === "KITCHEN" && items.some((item) => !item.cookingUnitId)) {
        throw new Error("Select the Cooking Unit for every Kitchen transfer row");
      }
      return createInventoryTransfer({
        branchCode: branch.code,
        fromWarehouseId,
        toWarehouseId,
        notes: notes.trim() || undefined,
        items,
      });
    },
    onSuccess: (result) => {
      setNotice(`${result.reference} completed · ${result.itemCount} lines`);
      setRows([]);
      setNotes("");
      setDefaultCookingUnitId("");
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["store"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const warehouses = warehousesQuery.data?.warehouses ?? [];
  const warehouseStock = warehousesQuery.data?.stock ?? [];
  const stockQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of warehouseStock) {
      if (row.warehouseId !== fromWarehouseId) continue;
      map.set(row.productId, (map.get(row.productId) ?? 0) + row.quantity);
    }
    return map;
  }, [fromWarehouseId, warehouseStock]);
  const products = useMemo(() => {
    const all = productsQuery.data ?? [];
    // Prefer products that actually have stock in the selected "From" warehouse.
    const withStock = all.filter((product) => (stockQtyByProduct.get(product.id) ?? 0) > 0);
    return withStock.length > 0 ? withStock : all;
  }, [productsQuery.data, stockQtyByProduct]);
  const activeUnits = (unitsQuery.data?.units ?? []).filter((unit) => unit.isActive);
  const destination = warehouses.find((warehouse) => warehouse.id === toWarehouseId);
  const selectedProductIds = useMemo(
    () => new Set(rows.map((row) => row.productId).filter(Boolean)),
    [rows],
  );

  function addProducts(productIds: string[]): void {
    if (productIds.length === 0) return;
    const sectionId = destination?.code === "KITCHEN" ? defaultCookingUnitId : "";
    setRows((current) => {
      const existing = new Set(current.map((row) => row.productId));
      const additions = productIds
        .filter((productId) => !existing.has(productId))
        .map((productId) => ({
          ...newTransferRow(),
          productId,
          cookingUnitId: sectionId,
        }));
      return [...current, ...additions];
    });
    setPickerOpen(false);
  }

  function applySectionToAllRows(sectionId: string): void {
    setDefaultCookingUnitId(sectionId);
    setRows((current) => current.map((row) => ({ ...row, cookingUnitId: sectionId })));
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">Stock Transfer Voucher</div>
          <p className="mt-1 text-xs text-slate-500">
            Transfer multiple products from Simple Store to Kitchen sections in one auditable voucher.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {warehouses.map((warehouse) => (
            <span key={warehouse.id} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">
              {warehouse.name}: <strong className="text-white">{warehouse.totalStock.toLocaleString()}</strong>
            </span>
          ))}
        </div>
      </div>
      {canManage ? (
        <>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <select className={selectClass} value={fromWarehouseId} onChange={(event) => setFromWarehouseId(event.target.value)}>
              <option value="">From warehouse</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
            <select className={selectClass} value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)}>
              <option value="">To warehouse</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
            {destination?.code === "KITCHEN" ? (
              <select
                className={selectClass}
                value={defaultCookingUnitId}
                onChange={(event) => applySectionToAllRows(event.target.value)}
              >
                <option value="">Default kitchen section (for new rows)</option>
                {activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            ) : (
              <div className="hidden xl:block" />
            )}
            <input
              className={inputClass}
              placeholder="Voucher notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Item / product</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Destination Cooking Unit</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      No items yet. Use <span className="text-white">Select multiple items</span> to pick products in bulk.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row, index) => {
                  const product = products.find((item) => item.id === row.productId);
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          className={`${selectClass} min-w-[220px]`}
                          value={row.productId}
                          onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, productId: event.target.value } : item))}
                        >
                          <option value="">Select item</option>
                          {products.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                              {(stockQtyByProduct.get(item.id) ?? 0) > 0
                                ? ` · stock ${stockQtyByProduct.get(item.id)}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{product?.unitName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <input
                          className={`${inputClass} w-24`}
                          type="number"
                          min={1}
                          step={1}
                          value={row.qty}
                          onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, qty: event.target.value } : item))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className={`${selectClass} min-w-[190px]`}
                          value={row.cookingUnitId}
                          onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, cookingUnitId: event.target.value } : item))}
                          disabled={destination?.code !== "KITCHEN"}
                        >
                          <option value="">{destination?.code === "KITCHEN" ? "Select section" : "Optional"}</option>
                          {activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => setRows((current) => current.length > 1 ? current.filter((item) => item.id !== row.id) : current)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                onClick={() => setPickerOpen(true)}
              >
                Select multiple items
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => setRows((current) => [...current, { ...newTransferRow(), cookingUnitId: defaultCookingUnitId }])}
              >
                + Add blank line
              </button>
            </div>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              disabled={transferMutation.isPending || !fromWarehouseId || !toWarehouseId}
              onClick={() => transferMutation.mutate()}
            >
              {transferMutation.isPending ? "Posting…" : "Save & Complete Voucher"}
            </button>
          </div>
        </>
      ) : null}
      {pickerOpen ? (
        <StoreProductPickerModal
          products={products}
          excludedIds={selectedProductIds}
          title="Select items for transfer"
          subtitle="Check all products to move in this voucher. Each gets its own quantity and kitchen section."
          onClose={() => setPickerOpen(false)}
          onConfirm={addProducts}
        />
      ) : null}
      {notice ? <p className="mt-2 text-xs text-amber-300">{notice}</p> : null}
      {(transfersQuery.data?.transfers.length ?? 0) > 0 ? (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Recent transfer vouchers</div>
          <div className="space-y-2">
            {transfersQuery.data?.transfers.slice(0, 5).map((transfer) => (
              <details key={transfer.id} className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                <summary className="cursor-pointer text-xs text-slate-300">
                  <span className="font-medium text-white">{transfer.reference}</span>
                  {" · "}{transfer.fromWarehouseName ?? "—"} → {transfer.toWarehouseName ?? "—"}
                  {" · "}{new Date(transfer.createdAt).toLocaleString()}
                </summary>
                <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                  {transfer.items.map((item) => (
                    <div key={item.id} className="flex flex-wrap justify-between gap-2">
                      <span>{item.productName} · {item.qty} {item.unit}</span>
                      <span className="text-amber-200">{item.cookingUnitName ?? "Kitchen / Unassigned"}</span>
                    </div>
                  ))}
                  {transfer.notes ? <div className="pt-1 text-slate-500">Notes: {transfer.notes}</div> : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StockTransfersPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock transfers"
        subtitle="Move multiple products from Simple Store to Kitchen sections in one voucher."
      />
      <InventoryWarehousePanel />
    </div>
  );
}
