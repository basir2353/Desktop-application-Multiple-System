import { WASTE_TYPES, type WasteRecord } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createWasteRecord,
  fetchBranchInventory,
  fetchInventoryCookingUnits,
  updateWasteStatus,
} from "../../../api/inventory";
import { IngredientPickerModal } from "../../../components/IngredientPickerModal";
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({
    ingredientId: "",
    cookingUnitId: "",
    qty: "1",
    wasteType: "Kitchen Waste" as (typeof WASTE_TYPES)[number],
    reason: "",
  });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const cookingUnitsQuery = useQuery({
    queryKey: ["inventory-cooking-units", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnits(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWasteRecord({
        branchCode: branch!.code,
        ingredientId: form.ingredientId,
        qty: Math.round(Number(form.qty) * 1000) / 1000,
        wasteType: form.wasteType,
        reason: form.reason || undefined,
        cookingUnitId: form.cookingUnitId || null,
      }),
    onSuccess: () => {
      invalidate();
      setForm({
        ingredientId: "",
        cookingUnitId: "",
        qty: "1",
        wasteType: "Kitchen Waste",
        reason: "",
      });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" }) => updateWasteStatus(id, { status }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const ingredients = query.data?.ingredients ?? [];
  const wasteRecords = query.data?.wasteRecords ?? [];
  const selectedIng = ingredients.find((i) => i.id === form.ingredientId);
  const sectionOptions = useMemo(() => {
    const fromIngredient = (selectedIng?.kitchenSections ?? []).filter(
      (s) => s.cookingUnitId && s.quantity > 0,
    );
    if (fromIngredient.length > 0) {
      return fromIngredient.map((s) => ({
        id: s.cookingUnitId!,
        name: s.name,
        quantity: s.quantity,
      }));
    }
    return (cookingUnitsQuery.data?.units ?? [])
      .filter((u) => u.isActive)
      .map((u) => ({ id: u.id, name: u.name, quantity: null as number | null }));
  }, [selectedIng, cookingUnitsQuery.data?.units]);

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

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
        <InventoryFormPanel
          title="Record waste & deduct stock"
          submitLabel="Save & deduct"
          onSubmit={() => createMutation.mutate()}
          disabled={!form.ingredientId || createMutation.isPending}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${inputClass} flex items-center justify-between text-left`}
            >
              <span className={selectedIng ? "truncate text-white" : "text-slate-500"}>
                {selectedIng
                  ? `${selectedIng.name} (${selectedIng.onHandStock ?? selectedIng.currentStock} ${selectedIng.unit})`
                  : "Select ingredient…"}
              </span>
              <span className="text-slate-500" aria-hidden>▾</span>
            </button>
            <select
              className={selectClass}
              value={form.cookingUnitId}
              onChange={(e) => setForm({ ...form, cookingUnitId: e.target.value })}
            >
              <option value="">Kitchen (no section)</option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.quantity != null ? ` (${s.quantity})` : ""}
                </option>
              ))}
            </select>
            <input className={inputClass} type="number" min={0.01} step="any" placeholder="Qty to remove" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <select className={selectClass} value={form.wasteType} onChange={(e) => setForm({ ...form, wasteType: e.target.value as typeof form.wasteType })}>
              {WASTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputClass} placeholder="Reason (e.g. expired)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Section choose karo to stock usi kitchen section se minus hoga (POS sale jaisa). Blank = overall kitchen/store.
          </p>
        </InventoryFormPanel>
      ) : null}

      {pickerOpen ? (
        <IngredientPickerModal
          ingredients={ingredients}
          single
          title="Select ingredient"
          subtitle="Search and pick one ingredient for this waste record."
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            setForm((f) => ({ ...f, ingredientId: ids[0] ?? "", cookingUnitId: "" }));
            setPickerOpen(false);
          }}
        />
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
