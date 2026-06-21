import { PO_STATUSES, type PoStatus, type PurchaseOrder } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createPurchaseOrder, fetchBranchInventory, updatePurchaseOrderStatus } from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";
import { InventoryFlowBanner } from "./InventoryFlowBanner";

function poTone(status: PoStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "Draft") return "neutral";
  if (status === "Pending" || status === "Partially Received") return "warning";
  if (status === "Approved" || status === "Ordered") return "info";
  if (status === "Received") return "success";
  return "danger";
}

export function PurchaseOrdersPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    ingredientId: "",
    qty: "1",
    unitCost: "0",
    expectedDate: "",
    requestedBy: "",
    chef: "",
  });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const ing = query.data?.ingredients.find((i) => i.id === form.ingredientId);
      return createPurchaseOrder({
        branchCode: branch!.code,
        supplierId: form.supplierId,
        expectedDate: form.expectedDate || undefined,
        requestedBy: form.requestedBy || undefined,
        chef: form.chef || undefined,
        lines: [{ ingredientId: form.ingredientId, qty: Number(form.qty), unit: ing?.unit ?? "Kg", unitCost: Number(form.unitCost) }],
      });
    },
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PoStatus }) => updatePurchaseOrderStatus(id, { status }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const suppliers = query.data?.suppliers.filter((s) => s.active) ?? [];
  const ingredients = query.data?.ingredients ?? [];
  const orders = query.data?.purchaseOrders ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Purchase orders" subtitle="Kitchen request → PO → supplier → approval." />
      <InventoryFlowBanner />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="New purchase order" submitLabel="Create PO" onSubmit={() => createMutation.mutate()} disabled={!form.supplierId || !form.ingredientId || createMutation.isPending}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select className={selectClass} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={selectClass} value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}>
              <option value="">Ingredient</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input className={inputClass} type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <input className={inputClass} type="number" placeholder="Unit cost (Rs)" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            <input className={inputClass} type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
            <input className={inputClass} placeholder="Requested by" value={form.requestedBy} onChange={(e) => setForm({ ...form, requestedBy: e.target.value })} />
            <input className={inputClass} placeholder="Chef" value={form.chef} onChange={(e) => setForm({ ...form, chef: e.target.value })} />
          </div>
        </InventoryFormPanel>
      ) : null}

      <SimpleTable<PurchaseOrder>
        rowKey={(r) => r.id}
        columns={[
          { key: "poNumber", header: "PO #" },
          { key: "supplierName", header: "Supplier" },
          { key: "status", header: "Status", render: (r) => <Badge tone={poTone(r.status)}>{r.status}</Badge> },
          { key: "items", header: "Items" },
          { key: "totalAmount", header: "Amount", render: (r) => `Rs ${r.totalAmount.toLocaleString()}` },
          { key: "expectedDate", header: "Expected", render: (r) => r.expectedDate ?? "—" },
          { key: "chef", header: "Chef", render: (r) => r.chef ?? "—" },
          ...(canManage ? [{
            id: "actions",
            key: "id" as const,
            header: "Actions",
            render: (r: PurchaseOrder) => (
              <select className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white" value={r.status} onChange={(e) => statusMutation.mutate({ id: r.id, status: e.target.value as PoStatus })}>
                {PO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ),
          }] : []),
        ]}
        rows={orders}
      />
    </div>
  );
}
