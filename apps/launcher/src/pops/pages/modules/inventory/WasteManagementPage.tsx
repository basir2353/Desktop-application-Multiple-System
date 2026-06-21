import { WASTE_TYPES, type WasteRecord } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createWasteRecord, fetchBranchInventory, updateWasteStatus } from "../../../api/inventory";
import { formatPkr, inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { accentValueClass, linkDangerClass, linkSuccessClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

export function WasteManagementPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ingredientId: "", qty: "1", wasteType: "Kitchen Waste" as (typeof WASTE_TYPES)[number], reason: "" });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWasteRecord({
        branchCode: branch!.code,
        ingredientId: form.ingredientId,
        qty: Number(form.qty),
        wasteType: form.wasteType,
        reason: form.reason || undefined,
      }),
    onSuccess: () => { invalidate(); setForm({ ingredientId: "", qty: "1", wasteType: "Kitchen Waste", reason: "" }); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" }) => updateWasteStatus(id, { status }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const ingredients = query.data?.ingredients ?? [];
  const wasteRecords = query.data?.wasteRecords ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayWaste = wasteRecords.filter((w) => w.date === today && w.status === "Approved").reduce((s, w) => s + w.costImpact, 0);
  const totalWaste = wasteRecords.filter((w) => w.status === "Approved").reduce((s, w) => s + w.costImpact, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Waste management" subtitle="Track expired items, burnt food, kitchen waste, and returns." />
      {error ? <InventoryError message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Daily waste (approved)</div>
          <div className={`text-xl font-semibold ${linkDangerClass}`}>{formatPkr(todayWaste)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Total waste (approved)</div>
          <div className={`text-xl font-semibold ${accentValueClass}`}>{formatPkr(totalWaste)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Records</div>
          <div className="text-xl font-semibold text-white">{wasteRecords.length}</div>
        </div>
      </div>

      {canManage ? (
        <InventoryFormPanel title="Record waste" submitLabel="Save waste record" onSubmit={() => createMutation.mutate()} disabled={!form.ingredientId || createMutation.isPending}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select className={selectClass} value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}>
              <option value="">Ingredient</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input className={inputClass} type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <select className={selectClass} value={form.wasteType} onChange={(e) => setForm({ ...form, wasteType: e.target.value as typeof form.wasteType })}>
              {WASTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputClass} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
        </InventoryFormPanel>
      ) : null}

      <SimpleTable<WasteRecord>
        rowKey={(r) => r.id}
        columns={[
          { key: "date", header: "Date" },
          { key: "ingredient", header: "Item" },
          { key: "qty", header: "Qty", render: (r) => `${r.qty} ${r.unit}` },
          { key: "wasteType", header: "Type" },
          { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
          { key: "costImpact", header: "Cost", render: (r) => <span className={linkDangerClass}>{formatPkr(r.costImpact)}</span> },
          { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "Approved" ? "success" : "warning"}>{r.status}</Badge> },
          ...(canManage ? [{
            id: "actions",
            key: "id" as const,
            header: "",
            render: (r: WasteRecord) =>
              r.status === "Pending" ? (
                <button type="button" className={`text-xs ${linkSuccessClass}`} onClick={() => statusMutation.mutate({ id: r.id, status: "Approved" })}>Approve</button>
              ) : null,
          }] : []),
        ]}
        rows={wasteRecords}
      />
    </div>
  );
}
