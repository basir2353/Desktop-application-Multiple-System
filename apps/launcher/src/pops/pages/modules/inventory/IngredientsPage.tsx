import { INGREDIENT_UNITS, type Ingredient } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  createIngredient,
  deleteIngredient,
  fetchBranchInventory,
} from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { accentValueClass, linkDangerClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

function stockStatus(i: Ingredient): { label: string; tone: "success" | "warning" | "danger" } {
  if (i.currentStock === 0) return { label: "Out of stock", tone: "danger" };
  if (i.currentStock <= i.reorderLevel) return { label: "Low stock", tone: "warning" };
  if (i.currentStock >= i.maxStock && i.maxStock > 0) return { label: "Overstock", tone: "warning" };
  return { label: "OK", tone: "success" };
}

export function IngredientsPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    categoryId: "",
    unit: "Kg" as (typeof INGREDIENT_UNITS)[number],
    currentStock: "0",
    minStock: "0",
    reorderLevel: "0",
    maxStock: "0",
    unitCost: "0",
  });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createIngredient({
        branchCode: branch!.code,
        sku: form.sku.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId || undefined,
        unit: form.unit,
        currentStock: Number(form.currentStock),
        minStock: Number(form.minStock),
        reorderLevel: Number(form.reorderLevel),
        maxStock: Number(form.maxStock),
        unitCost: Number(form.unitCost),
      }),
    onSuccess: () => {
      invalidate();
      setForm({ sku: "", name: "", categoryId: "", unit: "Kg", currentStock: "0", minStock: "0", reorderLevel: "0", maxStock: "0", unitCost: "0" });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIngredient,
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const categories = query.data?.categories ?? [];
  const ingredients = (query.data?.ingredients ?? []).filter((i) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || i.categoryId === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Ingredients" subtitle="Raw materials managed by the kitchen." />

      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="Add ingredient" submitLabel="Save ingredient" onSubmit={() => createMutation.mutate()} disabled={!form.sku.trim() || !form.name.trim() || createMutation.isPending}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className={inputClass} placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <input className={inputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={selectClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as typeof form.unit })}>
              {INGREDIENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input className={inputClass} placeholder="Current stock" type="number" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
            <input className={inputClass} placeholder="Min stock" type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            <input className={inputClass} placeholder="Reorder level" type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            <input className={inputClass} placeholder="Unit cost (Rs)" type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          </div>
        </InventoryFormPanel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input placeholder="Search name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className={`min-w-[12rem] flex-1 sm:max-w-xs ${inputClass}`} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <SimpleTable<Ingredient>
        rowKey={(r) => r.id}
        columns={[
          { key: "sku", header: "SKU" },
          { key: "name", header: "Ingredient" },
          { key: "categoryName", header: "Category", render: (r) => r.categoryName ?? "—" },
          { key: "unit", header: "Unit" },
          { key: "currentStock", header: "Current stock", render: (r) => <span className={r.currentStock <= r.reorderLevel ? accentValueClass : ""}>{r.currentStock} {r.unit}</span> },
          { key: "reorderLevel", header: "Reorder at" },
          { key: "unitCost", header: "Unit cost", render: (r) => `Rs ${r.unitCost.toLocaleString()}` },
          { id: "status", key: "id", header: "Status", render: (r) => { const s = stockStatus(r); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          ...(canManage ? [{
            id: "actions",
            key: "id" as const,
            header: "",
            render: (r: Ingredient) => (
              <button type="button" className={`text-xs ${linkDangerClass}`} onClick={() => deleteMutation.mutate(r.id)}>Delete</button>
            ),
          }] : []),
        ]}
        rows={ingredients}
      />
    </div>
  );
}
