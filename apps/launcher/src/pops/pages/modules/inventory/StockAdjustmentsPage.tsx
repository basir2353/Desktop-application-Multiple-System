import { ADJUSTMENT_TYPES, type StockAdjustment } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createStockAdjustment, fetchBranchInventory, updateAdjustmentStatus } from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { linkDangerClass, linkSuccessClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

export function StockAdjustmentsPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ingredientId: "", type: "Add" as "Add" | "Remove", qty: "1", reason: "" });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStockAdjustment({
        branchCode: branch!.code,
        ingredientId: form.ingredientId,
        type: form.type,
        qty: Number(form.qty),
        reason: form.reason.trim(),
      }),
    onSuccess: () => { invalidate(); setForm({ ingredientId: "", type: "Add", qty: "1", reason: "" }); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Rejected" }) =>
      updateAdjustmentStatus(id, { status }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const ingredients = query.data?.ingredients ?? [];
  const adjustments = query.data?.adjustments ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Stock adjustments" subtitle="Correct physical stock — damage, spoilage, manual correction." />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="New adjustment" submitLabel="Submit for approval" onSubmit={() => createMutation.mutate()} disabled={!form.ingredientId || !form.reason.trim() || createMutation.isPending}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select className={selectClass} value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}>
              <option value="">Ingredient</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select className={selectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
              {ADJUSTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputClass} type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <input className={inputClass} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
        </InventoryFormPanel>
      ) : null}

      <SimpleTable<StockAdjustment>
        rowKey={(r) => r.id}
        columns={[
          { key: "date", header: "Date" },
          { key: "ingredient", header: "Ingredient" },
          { key: "type", header: "Type", render: (r) => <Badge tone={r.type === "Add" ? "success" : "danger"}>{r.type === "Add" ? "+ Add" : "− Remove"}</Badge> },
          { key: "qty", header: "Qty", render: (r) => `${r.qty} ${r.unit}` },
          { key: "reason", header: "Reason" },
          { key: "status", header: "Approval", render: (r) => <Badge tone={r.status === "Approved" ? "success" : r.status === "Pending" ? "warning" : "danger"}>{r.status}</Badge> },
          ...(canManage ? [{
            id: "actions",
            key: "id" as const,
            header: "",
            render: (r: StockAdjustment) =>
              r.status === "Pending" ? (
                <div className="flex gap-2">
                  <button type="button" className={`text-xs ${linkSuccessClass}`} onClick={() => statusMutation.mutate({ id: r.id, status: "Approved" })}>Approve</button>
                  <button type="button" className={`text-xs ${linkDangerClass}`} onClick={() => statusMutation.mutate({ id: r.id, status: "Rejected" })}>Reject</button>
                </div>
              ) : null,
          }] : []),
        ]}
        rows={adjustments}
      />
    </div>
  );
}
