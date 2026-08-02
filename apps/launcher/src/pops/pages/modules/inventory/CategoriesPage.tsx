import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createInventoryCategory,
  deleteInventoryCategory,
  fetchBranchInventory,
  updateInventoryCategory,
} from "../../../api/inventory";
import { inputClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { linkActionClass, linkDangerClass, mutedClass } from "../../../lib/themeClasses";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { ModuleCountBadge, ModuleFilterBar } from "../../../ui/ModuleToolbar";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
};

export function CategoriesPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  function resetForm(): void {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  function startEdit(c: CategoryRow): void {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? "");
    setError(null);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createInventoryCategory({
        branchCode: branch!.code,
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      resetForm();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error("No category selected");
      return updateInventoryCategory(editingId, {
        name: name.trim(),
        description: description.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      resetForm();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryCategory,
    onSuccess: () => {
      invalidate();
      if (editingId) resetForm();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const categories = (query.data?.categories ?? []) as CategoryRow[];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q),
    );
  }, [categories, search]);

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const formBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <PageHeader title="Categories" subtitle="Organize ingredients — meat, vegetables, dairy, and more." />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel
          title={editingId ? `Edit category · ${name || "…"}` : "Add category"}
          submitLabel={editingId ? (updateMutation.isPending ? "Saving…" : "Save changes") : "Save category"}
          onSubmit={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
          disabled={!name.trim() || formBusy}
        >
          <input
            className={inputClass}
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {editingId ? (
            <button type="button" className={`text-xs ${linkActionClass}`} onClick={() => resetForm()}>
              Cancel edit
            </button>
          ) : null}
        </InventoryFormPanel>
      ) : null}

      <ModuleFilterBar>
        <input
          className={`min-w-[12rem] flex-1 sm:max-w-xs ${inputClass}`}
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ModuleCountBadge shown={filtered.length} total={categories.length} />
      </ModuleFilterBar>

      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Category" },
          { key: "description", header: "Description", render: (r) => r.description ?? "—" },
          { key: "itemCount", header: "Ingredients", render: (r) => `${r.itemCount} items` },
          ...(canManage
            ? [
                {
                  id: "actions",
                  key: "id" as const,
                  header: "",
                  render: (r: CategoryRow) => (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`text-xs ${linkActionClass}`}
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`text-xs ${linkDangerClass}`}
                        disabled={r.itemCount > 0}
                        title={r.itemCount > 0 ? "Remove ingredients first" : undefined}
                        onClick={() => {
                          if (window.confirm(`Delete category “${r.name}”?`)) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        rows={filtered}
      />
      {filtered.length === 0 ? (
        <p className={`text-sm ${mutedClass}`}>
          {search ? "No categories match your search." : "No categories yet."}
        </p>
      ) : null}
    </div>
  );
}
