import { useMutation, useQuery } from "@tanstack/react-query";
import type { TradeFlowItem } from "@platform/contracts";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { createTradeFlowItem, fetchTradeFlowItems, updateTradeFlowItem } from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, tfSecondaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";

const emptyForm = {
  sku: "",
  name: "",
  unit: "Bag",
  altUnit: "Amount",
  altFactor: "0",
  rate: "",
  qty: "0",
};

export function TradeFlowItemsPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["tradeflow", "items", branch?.code, "master"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowItems(branch!.code),
  });

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(item: TradeFlowItem) {
    setEditId(item.id);
    setForm({
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      altUnit: item.altUnit,
      altFactor: String(item.altFactor),
      rate: String(item.defaultRatePkr),
      qty: String(item.onHandQty),
    });
    setError(null);
    setNotice(null);
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        sku: form.sku.trim() || undefined,
        name: form.name.trim(),
        unit: form.unit.trim() || "Bag",
        altUnit: form.altUnit.trim() || "Amount",
        altFactor: Number(form.altFactor || 0),
        defaultRatePkr: Number(form.rate || 0),
        onHandQty: Number(form.qty || 0),
      };
      if (editId) return updateTradeFlowItem(editId, payload);
      return createTradeFlowItem({ branchCode: branch!.code, ...payload });
    },
    onSuccess: (row) => {
      invalidate();
      resetForm();
      setError(null);
      setNotice(`${row.name} ${editId ? "updated" : "added"}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save item"),
  });

  const editing = (query.data ?? []).find((item) => item.id === editId);

  return (
    <div className="tf-app space-y-5">
      <PageHeader
        title="Items"
        subtitle="Add any material beyond the sample list, then edit name, units, rate, and stock from the same form."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-4">
        <TfField label="Item name">
          <input className={tfInputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Marble chips" />
        </TfField>
        <TfField label="SKU / code">
          <input className={tfInputClass} value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Auto if empty" />
        </TfField>
        <TfField label="Qty unit">
          <input className={tfInputClass} value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Bag, KG, Trolley, Piece" />
        </TfField>
        <TfField label="Amount unit">
          <input className={tfInputClass} value={form.altUnit} onChange={(e) => set("altUnit", e.target.value)} placeholder="Amount" />
        </TfField>
        <TfField label="Alt factor (0 = use rate)">
          <input className={tfInputClass} value={form.altFactor} onChange={(e) => set("altFactor", e.target.value)} placeholder="0" />
        </TfField>
        <TfField label="Default rate Rs">
          <input className={tfInputClass} value={form.rate} onChange={(e) => set("rate", e.target.value)} placeholder="e.g. 1500" />
        </TfField>
        <TfField label="On hand qty">
          <input className={tfInputClass} value={form.qty} onChange={(e) => set("qty", e.target.value)} placeholder="0" />
        </TfField>
        <div className="flex items-end gap-2">
          <button type="button" disabled={!form.name.trim() || !Number.isFinite(Number(form.rate)) || save.isPending} onClick={() => save.mutate()} className={tfPrimaryBtn}>
            {save.isPending ? "Saving..." : editId ? "Update item" : "Add item"}
          </button>
          {editId ? (
            <button type="button" onClick={resetForm} className={tfSecondaryBtn}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      {editing ? (
        <p className="text-sm text-slate-500">
          Editing {editing.name}: {editing.bookedQty} {editing.unit} booked, {editing.freeQty} free. Booked qty stays from bookings.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Sample items (Brick, Cement, Crush, Sand, Steel) can be edited. Use Add item for any new material.
        </p>
      )}
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Qty unit</th>
            <th className="px-3 py-2">On hand</th>
            <th className="px-3 py-2">Amount unit</th>
            <th className="px-3 py-2">Booked</th>
            <th className="px-3 py-2">Free</th>
            <th className="px-3 py-2">Default rate</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {(query.data ?? []).length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No items yet. Add the first material above.</td></tr>
          ) : null}
          {(query.data ?? []).map((item) => (
            <tr key={item.id} className={`border-t border-slate-100 dark:border-slate-800 ${editId === item.id ? "bg-violet-50/60 dark:bg-violet-950/20" : ""}`}>
              <td className="px-3 py-2">{item.name} <span className="text-xs text-slate-500">{item.sku}</span></td>
              <td className="px-3 py-2">{item.unit}</td>
              <td className="px-3 py-2">{item.onHandQty} {item.unit}</td>
              <td className="px-3 py-2">{formatPkr(item.onHandAlt)} {item.altUnit}</td>
              <td className="px-3 py-2">{item.bookedQty}</td>
              <td className="px-3 py-2">{item.freeQty}</td>
              <td className="px-3 py-2">{formatPkr(item.defaultRatePkr)}</td>
              <td className="px-3 py-2">
                <button type="button" className="text-violet-700" onClick={() => startEdit(item)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
