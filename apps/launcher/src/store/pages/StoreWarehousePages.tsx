import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  approveStoreAdjustment,
  approveStoreAudit,
  completeStoreTransfer,
  createStoreAdjustment,
  createStoreAudit,
  createStoreTransfer,
  createStoreWarehouse,
  fetchStoreAdjustments,
  fetchStoreAudits,
  fetchStoreProducts,
  fetchStoreTransfers,
  fetchStoreWarehouses,
} from "../api/store";
import { useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput, StoreSelect } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { Badge } from "../../pops/ui/Badge";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";

export function StoreWarehousesPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const warehousesQuery = useQuery({ queryKey: ["store", "warehouses", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreWarehouses(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreWarehouse({ branchCode: branch!.code, code, name, isDefault: (warehousesQuery.data ?? []).length === 0 }),
    onSuccess: () => { invalidate(); setCode(""); setName(""); setNotice("Warehouse created"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Warehouse management" subtitle="Multiple warehouses with zones, racks, shelves, and bin locations." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="Add warehouse">
          <StoreField label="Code"><StoreInput value={code} onChange={(e) => setCode(e.target.value)} /></StoreField>
          <StoreField label="Name"><StoreInput value={name} onChange={(e) => setName(e.target.value)} /></StoreField>
          <div className="col-span-full"><button type="button" onClick={() => createMutation.mutate()} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add warehouse</button></div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable
        columns={["Code", "Name", "Default", "Zones", "Stock"]}
        rows={(warehousesQuery.data ?? []).map((w) => [w.code, w.name, w.isDefault ? "Yes" : "No", w.zoneCount, w.totalStock.toLocaleString()])}
      />
    </div>
  );
}

export function StoreTransfersPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const transfersQuery = useQuery({ queryKey: ["store", "transfers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreTransfers(branch!.code) });
  const warehousesQuery = useQuery({ queryKey: ["store", "warehouses", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreWarehouses(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreTransfer({ branchCode: branch!.code, fromWarehouseId: fromId, toWarehouseId: toId, items }),
    onSuccess: () => { invalidate(); setItems([]); setNotice("Transfer created"); },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeStoreTransfer(id),
    onSuccess: () => { invalidate(); setNotice("Transfer completed"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Stock transfers" subtitle="Transfer stock between warehouses — picking, packing, and dispatching." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="New transfer">
          <StoreField label="From warehouse"><StoreSelect value={fromId} onChange={(e) => setFromId(e.target.value)}><option value="">Select</option>{(warehousesQuery.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="To warehouse"><StoreSelect value={toId} onChange={(e) => setToId(e.target.value)}><option value="">Select</option>{(warehousesQuery.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Product"><StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Qty"><StoreInput type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></StoreField>
          <div className="col-span-full flex gap-2">
            <button type="button" onClick={() => { if (productId) setItems([...items, { productId, qty }]); }} className="rounded-lg border px-3 py-2 text-xs">Add line</button>
            <button type="button" onClick={() => createMutation.mutate()} disabled={!fromId || !toId || items.length === 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Create transfer</button>
          </div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable
        columns={["Transfer #", "From", "To", "Status", "Items", "Date", ""]}
        rows={(transfersQuery.data ?? []).map((t) => [
          t.transferNumber, t.fromWarehouseName ?? "—", t.toWarehouseName ?? "—",
          <Badge tone={t.status === "Completed" ? "success" : "warning"}>{t.status}</Badge>,
          t.itemCount, new Date(t.createdAt).toLocaleDateString(),
          canManage && t.status === "Pending" ? <button type="button" onClick={() => completeMutation.mutate(t.id)} className="text-xs text-sky-600 hover:underline">Complete</button> : null,
        ])}
      />
    </div>
  );
}

export function StoreAdjustmentsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [reason, setReason] = useState("expired");
  const [stockType, setStockType] = useState<"available" | "damaged" | "expired">("damaged");
  const [productId, setProductId] = useState("");
  const [qtyChange, setQtyChange] = useState(-1);
  const [items, setItems] = useState<{ productId: string; qtyChange: number; stockType: "available" | "damaged" | "expired" }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const adjQuery = useQuery({ queryKey: ["store", "adjustments", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreAdjustments(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreAdjustment({ branchCode: branch!.code, reason, items }),
    onSuccess: () => { invalidate(); setItems([]); setNotice("Adjustment submitted for approval"); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveStoreAdjustment(id),
    onSuccess: () => { invalidate(); setNotice("Adjustment approved"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Stock adjustments & wastage" subtitle="Record expired, damaged, lost, or theft write-offs with approval workflow." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="New adjustment">
          <StoreField label="Wastage reason">
            <StoreSelect value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="expired">Expired</option>
              <option value="damaged">Damaged / breakage</option>
              <option value="lost">Lost</option>
              <option value="theft">Theft / shrinkage</option>
              <option value="spoilage">Spoilage</option>
            </StoreSelect>
          </StoreField>
          <StoreField label="Stock bucket">
            <StoreSelect value={stockType} onChange={(e) => setStockType(e.target.value as typeof stockType)}>
              <option value="damaged">Damaged stock</option>
              <option value="expired">Expired stock</option>
              <option value="available">Available (general)</option>
            </StoreSelect>
          </StoreField>
          <StoreField label="Product"><StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</StoreSelect></StoreField>
          <StoreField label="Qty change (+/-)"><StoreInput type="number" value={qtyChange} onChange={(e) => setQtyChange(Number(e.target.value))} /></StoreField>
          <div className="col-span-full flex gap-2">
            <button type="button" onClick={() => { if (productId) setItems([...items, { productId, qtyChange, stockType }]); }} className="rounded-lg border px-3 py-2 text-xs">Add line</button>
            <button type="button" onClick={() => createMutation.mutate()} disabled={!reason || items.length === 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Submit adjustment</button>
          </div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable
        columns={["Number", "Reason", "Status", "Items", "Date", ""]}
        rows={(adjQuery.data ?? []).map((a) => [
          a.adjustmentNumber, a.reason, <Badge tone={a.status === "Approved" ? "success" : "warning"}>{a.status}</Badge>,
          a.itemCount, new Date(a.createdAt).toLocaleDateString(),
          canManage && a.status === "Pending" ? <button type="button" onClick={() => approveMutation.mutate(a.id)} className="text-xs text-sky-600 hover:underline">Approve</button> : null,
        ])}
      />
    </div>
  );
}

export function StoreAuditsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [productId, setProductId] = useState("");
  const [systemQty, setSystemQty] = useState(0);
  const [countedQty, setCountedQty] = useState(0);
  const [items, setItems] = useState<{ productId: string; systemQty: number; countedQty: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const auditsQuery = useQuery({ queryKey: ["store", "audits", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreAudits(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreAudit({ branchCode: branch!.code, auditType: "physical", items }),
    onSuccess: () => { invalidate(); setItems([]); setNotice("Audit started"); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveStoreAudit(id),
    onSuccess: () => { invalidate(); setNotice("Audit approved — variances applied"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Stock audit & reconciliation" subtitle="Physical count, cycle count, variance reports, and approval workflow." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="Start physical count">
          <StoreField label="Product"><StoreSelect value={productId} onChange={(e) => { setProductId(e.target.value); const p = (productsQuery.data ?? []).find((x) => x.id === e.target.value); if (p) setSystemQty(p.availableStock); }}><option value="">Select</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} (sys: {p.availableStock})</option>)}</StoreSelect></StoreField>
          <StoreField label="System qty"><StoreInput type="number" value={systemQty} readOnly /></StoreField>
          <StoreField label="Counted qty"><StoreInput type="number" value={countedQty} onChange={(e) => setCountedQty(Number(e.target.value))} /></StoreField>
          <div className="col-span-full flex gap-2">
            <button type="button" onClick={() => { if (productId) setItems([...items, { productId, systemQty, countedQty }]); }} className="rounded-lg border px-3 py-2 text-xs">Add count</button>
            <button type="button" onClick={() => createMutation.mutate()} disabled={items.length === 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Start audit</button>
          </div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable
        columns={["Audit #", "Type", "Status", "Items", "Variances", "Date", ""]}
        rows={(auditsQuery.data ?? []).map((a) => [
          a.auditNumber, a.auditType, <Badge tone={a.status === "Approved" ? "success" : "warning"}>{a.status}</Badge>,
          a.itemCount, a.varianceCount, new Date(a.createdAt).toLocaleDateString(),
          canManage && a.status === "In Progress" ? <button type="button" onClick={() => approveMutation.mutate(a.id)} className="text-xs text-sky-600 hover:underline">Approve & apply</button> : null,
        ])}
      />
    </div>
  );
}
