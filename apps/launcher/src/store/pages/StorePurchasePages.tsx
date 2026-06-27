import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  approveStorePurchaseOrder,
  createStoreGrn,
  createStorePurchaseOrder,
  createStoreRequisition,
  fetchStoreGrn,
  fetchStoreProducts,
  fetchStorePurchaseOrders,
  fetchStoreRequisitions,
  fetchStoreSuppliers,
  fetchStoreWarehouses,
} from "../api/store";
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
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [items, setItems] = useState<{ productId: string; qty: number; unitPrice: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const ordersQuery = useQuery({ queryKey: ["store", "purchase-orders", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStorePurchaseOrders(branch!.code) });
  const suppliersQuery = useQuery({ queryKey: ["store", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreSuppliers(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStorePurchaseOrder({ branchCode: branch!.code, supplierId, items }),
    onSuccess: () => { invalidate(); setItems([]); setNotice("Purchase order created"); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveStorePurchaseOrder(id),
    onSuccess: () => { invalidate(); setNotice("PO approved"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Purchase orders" subtitle="Step 2 — create and approve purchase orders for suppliers." actions={<Link to="/pops/store/purchase/grn" className="text-xs text-sky-600 hover:underline">Go to GRN →</Link>} />
      <div className="grid gap-2 sm:grid-cols-5">
        <StoreWorkflowStep step={1} title="Requisition" description="Request items" done />
        <StoreWorkflowStep step={2} title="Purchase order" description="Create PO" active />
        <StoreWorkflowStep step={3} title="Approval" description="Supplier approval" />
        <StoreWorkflowStep step={4} title="GRN" description="Receive goods" />
        <StoreWorkflowStep step={5} title="Inventory" description="Stock updated" />
      </div>
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="New purchase order">
          <StoreField label="Supplier"><StoreSelect value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select supplier</option>{(suppliersQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Product"><StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Qty"><StoreInput type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></StoreField>
          <StoreField label="Unit price"><StoreInput type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} /></StoreField>
          <div className="col-span-full flex gap-2">
            <button type="button" onClick={() => { if (productId) setItems([...items, { productId, qty, unitPrice }]); }} className="rounded-lg border px-3 py-2 text-xs">Add line</button>
            <button type="button" onClick={() => createMutation.mutate()} disabled={!supplierId || items.length === 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Create PO</button>
          </div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable
        columns={["PO #", "Supplier", "Status", "Total", "Received", "Date", ""]}
        rows={(ordersQuery.data ?? []).map((o) => [
          o.poNumber, o.supplierName ?? "—", <Badge tone={statusTone(o.status)}>{o.status}</Badge>,
          formatPkr(o.totalAmount), `${o.receivedPct}%`, new Date(o.createdAt).toLocaleDateString(),
          canManage && o.status === "Pending Approval" ? <button type="button" onClick={() => approveMutation.mutate(o.id)} className="text-xs text-sky-600 hover:underline">Approve</button> : null,
        ])}
      />
    </div>
  );
}

export function StoreGrnPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [poId, setPoId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [items, setItems] = useState<{ productId: string; qty: number; unitPrice: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grnQuery = useQuery({ queryKey: ["store", "grn", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreGrn(branch!.code) });
  const ordersQuery = useQuery({ queryKey: ["store", "purchase-orders", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStorePurchaseOrders(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });
  const warehousesQuery = useQuery({ queryKey: ["store", "warehouses", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreWarehouses(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreGrn({
      branchCode: branch!.code,
      purchaseOrderId: poId || undefined,
      warehouseId: warehousesQuery.data?.[0]?.id,
      items,
    }),
    onSuccess: () => { invalidate(); setItems([]); setNotice("GRN recorded — inventory updated"); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Goods Received Note (GRN)" subtitle="Step 4 — receive goods, update inventory, and process supplier invoice." />
      <div className="grid gap-2 sm:grid-cols-5">
        <StoreWorkflowStep step={1} title="Requisition" description="Request items" done />
        <StoreWorkflowStep step={2} title="Purchase order" description="Create PO" done />
        <StoreWorkflowStep step={3} title="Approval" description="Supplier approval" done />
        <StoreWorkflowStep step={4} title="GRN" description="Receive goods" active />
        <StoreWorkflowStep step={5} title="Inventory" description="Stock updated" />
      </div>
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      {canManage ? (
        <StoreFormSection title="Receive goods">
          <StoreField label="Purchase order"><StoreSelect value={poId} onChange={(e) => setPoId(e.target.value)}><option value="">Optional — link to PO</option>{(ordersQuery.data ?? []).filter((o) => o.status === "Approved" || o.status === "Partially Received").map((o) => <option key={o.id} value={o.id}>{o.poNumber}</option>)}</StoreSelect></StoreField>
          <StoreField label="Product"><StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Qty received"><StoreInput type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></StoreField>
          <StoreField label="Unit price"><StoreInput type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} /></StoreField>
          <div className="col-span-full flex gap-2">
            <button type="button" onClick={() => { if (productId) setItems([...items, { productId, qty, unitPrice }]); }} className="rounded-lg border px-3 py-2 text-xs">Add line</button>
            <button type="button" onClick={() => createMutation.mutate()} disabled={items.length === 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Receive & update stock</button>
          </div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable columns={["GRN #", "PO", "Supplier", "Items", "Total", "Date"]} rows={(grnQuery.data ?? []).map((g) => [g.grnNumber, g.poNumber ?? "—", g.supplierName ?? "—", g.itemCount, formatPkr(g.totalAmount), new Date(g.createdAt).toLocaleDateString()])} />
    </div>
  );
}
