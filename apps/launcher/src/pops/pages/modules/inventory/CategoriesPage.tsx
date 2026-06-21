import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createInventoryCategory, deleteInventoryCategory, fetchBranchInventory } from "../../../api/inventory";
import { inputClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { linkDangerClass } from "../../../lib/themeClasses";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

export function CategoriesPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () => createInventoryCategory({ branchCode: branch!.code, name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => { invalidate(); setName(""); setDescription(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryCategory,
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const categories = query.data?.categories ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Categories" subtitle="Organize ingredients — meat, vegetables, dairy, and more." />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="Add category" submitLabel="Save category" onSubmit={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
          <input className={inputClass} placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </InventoryFormPanel>
      ) : null}

      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Category" },
          { key: "description", header: "Description", render: (r) => r.description ?? "—" },
          { key: "itemCount", header: "Ingredients", render: (r) => `${r.itemCount} items` },
          ...(canManage ? [{
            id: "actions",
            key: "id" as const,
            header: "",
            render: (r: { id: string; itemCount: number }) => (
              <button type="button" className={`text-xs ${linkDangerClass}`} disabled={r.itemCount > 0} onClick={() => deleteMutation.mutate(r.id)}>
                Delete
              </button>
            ),
          }] : []),
        ]}
        rows={categories}
      />
    </div>
  );
}
