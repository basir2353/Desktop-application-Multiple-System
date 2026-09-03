import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { StoreProduct } from "@platform/contracts";
import {
  approveStorePurchaseOrder,
  createStoreGrn,
  createStorePurchaseOrder,
  createStoreRequisition,
  createStoreSupplier,
  fetchStoreGrn,
  fetchStoreProducts,
  fetchStorePurchaseOrders,
  fetchStoreRequisitions,
  fetchStoreSuppliers,
  fetchStoreTransactions,
  fetchStoreWarehouses,
} from "../api/store";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { productMatchesCode } from "../lib/storePosSync";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput, StoreSelect, StoreWorkflowStep } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

function statusTone(status: string): "neutral" | "warning" | "success" | "danger" {
  if (status.includes("Approved") || status === "Received" || status === "Completed") return "success";
  if (status.includes("Pending") || status === "Partially Received") return "warning";
  if (status === "Cancelled") return "danger";
  return "neutral";
}

export function StorePurchaseRequisitionsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const reqQuery = useQuery({ queryKey: ["store", "requisitions", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreRequisitions(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreRequisition({ branchCode: branch!.code, items }),
    onSuccess: () => { invalidate(); setItems([]); setNotice("Requisition submitted"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Purchase requisitions" subtitle="Step 1 — request stock from purchasing department." />
      <div className="grid gap-2 sm:grid-cols-5">
        <StoreWorkflowStep step={1} title="Requisition" description="Request items" active done />
        <StoreWorkflowStep step={2} title="Purchase order" description="Create PO" />
        <StoreWorkflowStep step={3} title="Approval" description="Supplier approval" />
        <StoreWorkflowStep step={4} title="GRN" description="Receive goods" />
        <StoreWorkflowStep step={5} title="Inventory" description="Stock updated" />
      </div>
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="New requisition">
          <StoreField label="Product"><StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Qty"><StoreInput type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></StoreField>
          <div className="col-span-full flex gap-2">
            <button type="button" onClick={() => { if (productId) setItems([...items, { productId, qty }]); }} className="rounded-lg border px-3 py-2 text-xs">Add line</button>
            <button type="button" onClick={() => createMutation.mutate()} disabled={items.length === 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Submit ({items.length} items)</button>
          </div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable columns={["Number", "Status", "Items", "Date"]} rows={(reqQuery.data ?? []).map((r) => [r.requisitionNumber, <Badge tone={statusTone(r.status)}>{r.status}</Badge>, r.itemCount, new Date(r.createdAt).toLocaleDateString()])} />
    </div>
  );
}

export function StorePurchaseOrdersPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [scan, setScan] = useState("");
  const [lines, setLines] = useState<
    Array<{
      product: StoreProduct;
      qty: number;
      unitCost: number;
      saleRate: number;
      lastReceivedQty: number;
    }>
  >([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkQty, setBulkQty] = useState(1);

  const ordersQuery = useQuery({
    queryKey: ["store", "purchase-orders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStorePurchaseOrders(branch!.code),
  });
  const suppliersQuery = useQuery({
    queryKey: ["store", "suppliers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSuppliers(branch!.code),
  });
  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });
  const warehousesQuery = useQuery({
    queryKey: ["store", "warehouses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreWarehouses(branch!.code),
  });

  useEffect(() => {
    if (!warehouseId && warehousesQuery.data?.length) {
      setWarehouseId(
        warehousesQuery.data.find((warehouse) => warehouse.code === "SIMPLE-STORE")?.id ??
          warehousesQuery.data[0].id,
      );
    }
  }, [warehouseId, warehousesQuery.data]);
  const txQuery = useQuery({
    queryKey: ["store", "transactions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreTransactions(branch!.code),
  });

  const lastReceivedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txQuery.data ?? []) {
      if (t.type !== "grn_received") continue;
      if (!map.has(t.productId)) map.set(t.productId, t.qty);
    }
    return map;
  }, [txQuery.data]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveStorePurchaseOrder(id),
    onSuccess: () => {
      invalidate();
      setNotice("PO approved");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Select a supplier first");
      if (lines.length === 0) throw new Error("Scan at least one item");
      const items = lines.map((l) => ({
        productId: l.product.id,
        qty: l.qty,
        unitPrice: l.unitCost,
      }));
      const po = await createStorePurchaseOrder({
        branchCode: branch!.code,
        supplierId,
        warehouseId,
        items,
      });
      await approveStorePurchaseOrder(po.id);
      await createStoreGrn({
        branchCode: branch!.code,
        purchaseOrderId: po.id,
        supplierId,
        warehouseId,
        items: lines.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          unitPrice: l.unitCost,
          sellingPrice: l.saleRate,
        })),
      });
    },
    onSuccess: () => {
      invalidate();
      setLines([]);
      setSelectedIds([]);
      setScan("");
      setNotice("Purchase completed — stock updated and sale rates applied");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function addScanned(code: string): void {
    const q = code.trim();
    if (!q) return;
    if (!supplierId) {
      setError("Select a vendor before scanning items");
      return;
    }
    const products = productsQuery.data ?? [];
    const byCode = products.find((p) => productMatchesCode(p, q));
    if (byCode) {
      setError(null);
      setLines((prev) => {
        const existing = prev.find((l) => l.product.id === byCode.id);
        if (existing) {
          return prev.map((l) =>
            l.product.id === byCode.id ? { ...l, qty: l.qty + 1 } : l,
          );
        }
        return [
          ...prev,
          {
            product: byCode,
            qty: 1,
            unitCost: byCode.purchasePrice || byCode.orderCost || 0,
            saleRate: byCode.sellingPrice || 0,
            lastReceivedQty: lastReceivedByProduct.get(byCode.id) ?? 0,
          },
        ];
      });
      setScan("");
      return;
    }
    const lower = q.toLowerCase();
    const exactName = products.find((p) => p.name.toLowerCase() === lower);
    const partial = products.filter((p) => p.name.toLowerCase().includes(lower));
    const product = exactName ?? (partial.length === 1 ? partial[0] : undefined);
    if (!product) {
      setError(
        partial.length > 1
          ? `Multiple matches for "${q}" — type a more specific name`
          : `No product found for: ${q}`,
      );
      return;
    }
    setError(null);
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          product,
          qty: 1,
          unitCost: product.purchasePrice || product.orderCost || 0,
          saleRate: product.sellingPrice || 0,
          lastReceivedQty: lastReceivedByProduct.get(product.id) ?? 0,
        },
      ];
    });
    setScan("");
  }

  function toggleSelected(productId: string): void {
    setSelectedIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  }

  function applyBulkQty(): void {
    const qty = Math.max(1, Math.round(bulkQty));
    const targets = selectedIds.length > 0 ? new Set(selectedIds) : null;
    setLines((prev) =>
      prev.map((l) => (targets == null || targets.has(l.product.id) ? { ...l, qty } : l)),
    );
  }

  useBarcodeScanner((code) => addScanned(code), Boolean(canManage && supplierId));

  const purchaseTotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchasing"
        subtitle="Select a supplier, scan or search items (qty starts at 1), set sale rate, and update stock."
        actions={
          <Link to="/pops/store/purchase/grn" className="text-xs text-sky-600 hover:underline">
            Go to GRN →
          </Link>
        }
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {canManage ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <StoreFormSection title="New purchase (scan to receive)">
            <StoreField label="Vendor" required>
              <StoreSelect value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select vendor</option>
                {(suppliersQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.openingBalancePkr > 0
                      ? ` · Bal Rs ${s.openingBalancePkr.toLocaleString("en-PK")}`
                      : " · Bal —"}
                  </option>
                ))}
              </StoreSelect>
            </StoreField>
            <StoreField label="Purchase warehouse" required>
              <StoreSelect value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Select warehouse</option>
                {(warehousesQuery.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </StoreSelect>
            </StoreField>
            <StoreField label="Scan or search item" hint="Each scan/search adds qty 1 (or +1 if already listed)">
              <StoreInput
                data-scan-target="true"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addScanned(scan);
                  }
                }}
                placeholder={supplierId ? "Scan barcode or search name, then Enter" : "Select vendor first"}
                disabled={!supplierId}
              />
            </StoreField>
          </StoreFormSection>

          {lines.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={lines.length > 0 && selectedIds.length === lines.length}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? lines.map((l) => l.product.id) : [])
                        }
                        aria-label="Select all lines"
                      />
                    </th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Available stock</th>
                    <th className="px-3 py-2">Last received qty</th>
                    <th className="px-3 py-2">Last purchase rate</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Purchase rate</th>
                    <th className="px-3 py-2">Sale rate</th>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.product.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(line.product.id)}
                          onChange={() => toggleSelected(line.product.id)}
                          aria-label={`Select ${line.product.name}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{line.product.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {line.product.sku}
                          {line.product.barcode ? ` · ${line.product.barcode}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums font-medium">
                        {line.product.isWeighed
                          ? `${(line.product.availableStock / 1000).toFixed(3)} kg`
                          : line.product.availableStock.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                        {line.lastReceivedQty > 0 ? line.lastReceivedQty.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                        {formatPkr(line.product.purchasePrice || line.product.orderCost || 0)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-7 w-7 rounded border"
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.product.id === line.product.id
                                    ? { ...l, qty: Math.max(1, l.qty - 1) }
                                    : l,
                                ),
                              )
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => {
                              const qty = Math.max(1, Math.round(Number(e.target.value) || 1));
                              setLines((prev) =>
                                prev.map((l) => (l.product.id === line.product.id ? { ...l, qty } : l)),
                              );
                            }}
                            className="w-16 rounded border px-2 py-1 text-center"
                          />
                          <button
                            type="button"
                            className="h-7 w-7 rounded border"
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.product.id === line.product.id ? { ...l, qty: l.qty + 1 } : l,
                                ),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={line.unitCost}
                          onChange={(e) => {
                            const unitCost = Math.max(0, Math.round(Number(e.target.value) || 0));
                            setLines((prev) =>
                              prev.map((l) => (l.product.id === line.product.id ? { ...l, unitCost } : l)),
                            );
                          }}
                          className="w-24 rounded border px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={line.saleRate}
                          onChange={(e) => {
                            const saleRate = Math.max(0, Math.round(Number(e.target.value) || 0));
                            setLines((prev) =>
                              prev.map((l) => (l.product.id === line.product.id ? { ...l, saleRate } : l)),
                            );
                          }}
                          className="w-24 rounded border border-sky-300 bg-sky-50 px-2 py-1 dark:border-sky-700 dark:bg-sky-950/30"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{formatPkr(line.qty * line.unitCost)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => {
                            setLines((prev) => prev.filter((l) => l.product.id !== line.product.id));
                            setSelectedIds((prev) => prev.filter((id) => id !== line.product.id));
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {selectedIds.length > 0
                      ? `Update qty for ${selectedIds.length} selected`
                      : "Update qty for all lines"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={bulkQty}
                    onChange={(e) => setBulkQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded border px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyBulkQty}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700"
                  >
                    Apply qty
                  </button>
                  <p className="text-sm font-semibold">
                    {lines.length} item(s) · Total cost {formatPkr(purchaseTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={completeMutation.isPending || !supplierId || lines.length === 0}
                  onClick={() => completeMutation.mutate()}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {completeMutation.isPending ? "Saving…" : "Complete purchase & update stock"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {supplierId
                ? "Scan product barcodes to add lines. Quantity defaults to 1."
                : "Choose a supplier to start scanning."}
            </p>
          )}
        </div>
      ) : null}

      <StoreDataTable
        columns={["PO #", "Supplier", "Status", "Total", "Received", "Date", ""]}
        rows={(ordersQuery.data ?? []).map((o) => [
          o.poNumber,
          o.supplierName ?? "—",
          <Badge tone={statusTone(o.status)}>{o.status}</Badge>,
          formatPkr(o.totalAmount),
          `${o.receivedPct}%`,
          new Date(o.createdAt).toLocaleDateString(),
          canManage && o.status === "Pending Approval" ? (
            <button type="button" onClick={() => approveMutation.mutate(o.id)} className="text-xs text-sky-600 hover:underline">
              Approve
            </button>
          ) : null,
        ])}
      />
    </div>
  );
}

export function StoreGrnPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [scan, setScan] = useState("");
  const [pickProductId, setPickProductId] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [lines, setLines] = useState<
    Array<{
      product: StoreProduct;
      qty: number;
      unitCost: number;
      saleRate: number;
      lastReceivedQty: number;
    }>
  >([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<StoreProduct[]>([]);

  const grnQuery = useQuery({
    queryKey: ["store", "grn", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreGrn(branch!.code),
  });
  const suppliersQuery = useQuery({
    queryKey: ["store", "suppliers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSuppliers(branch!.code),
  });
  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });
  const warehousesQuery = useQuery({
    queryKey: ["store", "warehouses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreWarehouses(branch!.code),
  });
  const txQuery = useQuery({
    queryKey: ["store", "transactions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreTransactions(branch!.code),
  });

  useEffect(() => {
    if (!warehouseId && warehousesQuery.data?.length) {
      setWarehouseId(
        warehousesQuery.data.find((warehouse) => warehouse.code === "SIMPLE-STORE")?.id ??
          warehousesQuery.data[0].id,
      );
    }
  }, [warehouseId, warehousesQuery.data]);

  const suppliers = suppliersQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const lastReceivedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txQuery.data ?? []) {
      if (t.type !== "grn_received") continue;
      if (!map.has(t.productId)) map.set(t.productId, t.qty);
    }
    return map;
  }, [txQuery.data]);

  // Auto-select first vendor once suppliers load.
  useEffect(() => {
    if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0]!.id);
    }
  }, [suppliers, supplierId]);

  const createVendorMutation = useMutation({
    mutationFn: () =>
      createStoreSupplier({
        branchCode: branch!.code,
        name: newVendorName.trim(),
      }),
    onSuccess: (vendor) => {
      invalidate();
      setSupplierId(vendor.id);
      setNewVendorName("");
      setNotice(`Vendor "${vendor.name}" added`);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!supplierId) throw new Error("Select a vendor first");
      if (!warehouseId) throw new Error("Select a receiving warehouse");
      if (lines.length === 0) throw new Error("Scan or search at least one item");
      return createStoreGrn({
        branchCode: branch!.code,
        supplierId,
        warehouseId,
        items: lines.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          unitPrice: l.unitCost,
          sellingPrice: l.saleRate,
        })),
      });
    },
    onSuccess: () => {
      invalidate();
      setLines([]);
      setScan("");
      setPickProductId("");
      setNameSuggestions([]);
      setNotice("Goods received — stock and sale rates updated");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function addProduct(product: StoreProduct): void {
    if (!supplierId) {
      setError("Select a vendor before adding items");
      return;
    }
    setError(null);
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          product,
          qty: 1,
          unitCost: product.purchasePrice || product.orderCost || 0,
          saleRate: product.sellingPrice || 0,
          lastReceivedQty: lastReceivedByProduct.get(product.id) ?? 0,
        },
      ];
    });
    setScan("");
    setPickProductId("");
    setNameSuggestions([]);
  }

  function addFromScanOrSearch(raw: string): void {
    const q = raw.trim();
    if (!q) return;
    if (!supplierId) {
      setError("Select a vendor before scanning items");
      return;
    }
    const byCode = products.find((p) => productMatchesCode(p, q));
    if (byCode) {
      addProduct(byCode);
      return;
    }
    const lower = q.toLowerCase();
    const exactName = products.find((p) => p.name.toLowerCase() === lower);
    if (exactName) {
      addProduct(exactName);
      return;
    }
    const partial = products.filter((p) => p.name.toLowerCase().includes(lower));
    if (partial.length === 1) {
      addProduct(partial[0]!);
      return;
    }
    if (partial.length > 1) {
      setNameSuggestions(partial.slice(0, 8));
      setError(`Multiple matches for "${q}" — tap one below to add`);
      return;
    }
    setNameSuggestions([]);
    setError(`No product found for: ${q}`);
  }

  function onScanChange(value: string): void {
    setScan(value);
    const q = value.trim().toLowerCase();
    if (!supplierId || q.length < 2) {
      setNameSuggestions([]);
      return;
    }
    if (products.some((p) => productMatchesCode(p, value.trim()))) {
      setNameSuggestions([]);
      return;
    }
    setNameSuggestions(products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8));
  }

  useBarcodeScanner((code) => addFromScanOrSearch(code), Boolean(branch && supplierId));

  const purchaseTotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const allowEdit = Boolean(branch);

  if (!branch) {
    return (
      <div className="space-y-4">
        <PageHeader title="Goods receiving (GRN)" subtitle="Select a store branch first to receive goods." />
        <div className={noticeErrorClass}>No branch selected. Open Multi-branch / Settings and choose a store branch.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goods receiving (GRN)"
        subtitle="1) Select vendor → 2) Scan/search item (qty = 1) → 3) Review stock & rates → 4) Receive."
        actions={
          <Link to="/pops/store/suppliers" className="text-xs font-semibold text-sky-600 hover:underline">
            Manage vendors →
          </Link>
        }
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="grid gap-3 lg:grid-cols-3">
          <StoreField label="Vendor" required>
            <StoreSelect
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setError(null);
              }}
              disabled={suppliersQuery.isLoading}
            >
              <option value="">{suppliersQuery.isLoading ? "Loading vendors…" : "Select vendor"}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.openingBalancePkr > 0
                    ? ` · Bal Rs ${s.openingBalancePkr.toLocaleString("en-PK")}`
                    : " · Bal —"}
                </option>
              ))}
            </StoreSelect>
          </StoreField>

          <StoreField label="Receiving warehouse" required>
            <StoreSelect value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select warehouse</option>
              {(warehousesQuery.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </StoreSelect>
          </StoreField>

          <StoreField label="Scan or search item" hint="Barcode or name + Enter — adds with qty 1">
            <StoreInput
              data-scan-target="true"
              value={scan}
              onChange={(e) => onScanChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFromScanOrSearch(scan);
                }
              }}
              placeholder={supplierId ? "Scan barcode or type product name…" : "Select vendor first"}
              disabled={!supplierId}
              autoFocus={Boolean(supplierId)}
            />
          </StoreField>

          <StoreField label="Or pick product" hint="Manual add if barcode not available">
            <div className="flex gap-2">
              <StoreSelect
                value={pickProductId}
                onChange={(e) => setPickProductId(e.target.value)}
                disabled={!supplierId || products.length === 0}
              >
                <option value="">{productsQuery.isLoading ? "Loading…" : "Select product"}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · Qty {p.availableStock}
                  </option>
                ))}
              </StoreSelect>
              <button
                type="button"
                disabled={!supplierId || !pickProductId}
                onClick={() => {
                  const p = products.find((x) => x.id === pickProductId);
                  if (p) addProduct(p);
                }}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-slate-700"
              >
                Add
              </button>
            </div>
          </StoreField>
        </div>

        {allowEdit && (suppliers.length === 0 || !supplierId) ? (
          <div className="rounded-xl border border-dashed border-amber-400/50 bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
              {suppliers.length === 0
                ? "No vendors yet — add one to start receiving."
                : "Quick add vendor"}
            </p>
            <div className="flex flex-wrap gap-2">
              <StoreInput
                className="min-w-[200px] flex-1"
                placeholder="Vendor name"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newVendorName.trim()) {
                    e.preventDefault();
                    createVendorMutation.mutate();
                  }
                }}
              />
              <button
                type="button"
                disabled={!newVendorName.trim() || createVendorMutation.isPending}
                onClick={() => createVendorMutation.mutate()}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {createVendorMutation.isPending ? "Saving…" : "Add vendor"}
              </button>
            </div>
          </div>
        ) : null}

        {nameSuggestions.length > 0 ? (
          <ul className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/40">
            {nameSuggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white dark:hover:bg-slate-900"
                  onClick={() => addProduct(p)}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    Stock {p.availableStock.toLocaleString()} · Cost {formatPkr(p.purchasePrice)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Available stock</th>
                <th className="px-3 py-2">Last received qty</th>
                <th className="px-3 py-2">Last purchase rate</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Purchase rate</th>
                <th className="px-3 py-2">Sale rate</th>
                <th className="px-3 py-2">Line</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    {supplierId
                      ? "No items yet — scan, search, or pick a product. Quantity starts at 1."
                      : "Select a vendor, then scan or search items. They will appear here with stock & rates."}
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.product.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{line.product.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {line.product.sku}
                        {line.product.barcode ? ` · ${line.product.barcode}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {line.product.isWeighed
                        ? `${(line.product.availableStock / 1000).toFixed(3)} kg`
                        : line.product.availableStock.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                      {line.lastReceivedQty > 0 ? line.lastReceivedQty.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatPkr(line.product.purchasePrice || line.product.orderCost || 0)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-slate-200 dark:border-slate-700"
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.product.id === line.product.id
                                  ? { ...l, qty: Math.max(1, l.qty - 1) }
                                  : l,
                              ),
                            )
                          }
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) => {
                            const qty = Math.max(1, Math.round(Number(e.target.value) || 1));
                            setLines((prev) =>
                              prev.map((l) => (l.product.id === line.product.id ? { ...l, qty } : l)),
                            );
                          }}
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-slate-200 dark:border-slate-700"
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.product.id === line.product.id ? { ...l, qty: l.qty + 1 } : l,
                              ),
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={line.unitCost}
                        onChange={(e) => {
                          const unitCost = Math.max(0, Math.round(Number(e.target.value) || 0));
                          setLines((prev) =>
                            prev.map((l) => (l.product.id === line.product.id ? { ...l, unitCost } : l)),
                          );
                        }}
                        className="w-24 rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={line.saleRate}
                        onChange={(e) => {
                          const saleRate = Math.max(0, Math.round(Number(e.target.value) || 0));
                          setLines((prev) =>
                            prev.map((l) => (l.product.id === line.product.id ? { ...l, saleRate } : l)),
                          );
                        }}
                        className="w-24 rounded border border-sky-300 bg-sky-50 px-2 py-1 dark:border-sky-700 dark:bg-sky-950/30"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{formatPkr(line.qty * line.unitCost)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() =>
                          setLines((prev) => prev.filter((l) => l.product.id !== line.product.id))
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {lines.length} item(s) · Total {formatPkr(purchaseTotal)}
            </p>
            <button
              type="button"
              disabled={createMutation.isPending || !supplierId || !warehouseId || lines.length === 0 || !canManage}
              onClick={() => createMutation.mutate()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              title={!canManage ? "Needs inventory manage permission" : undefined}
            >
              {createMutation.isPending ? "Saving…" : "Receive & update stock"}
            </button>
          </div>
        </div>
      </div>

      <StoreDataTable
        columns={["GRN #", "Supplier", "Items", "Total", "Date"]}
        rows={(grnQuery.data ?? []).map((g) => [
          g.grnNumber,
          g.supplierName ?? "—",
          g.itemCount,
          formatPkr(g.totalAmount),
          new Date(g.createdAt).toLocaleDateString(),
        ])}
      />
    </div>
  );
}
