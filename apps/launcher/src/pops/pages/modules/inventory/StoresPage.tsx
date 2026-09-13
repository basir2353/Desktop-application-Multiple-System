import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createInventoryWarehouse,
  deleteInventoryWarehouse,
  fetchInventoryWarehouses,
  updateInventoryWarehouse,
} from "../../../api/inventory";
import { inputClass, useInventoryAccess } from "../../../hooks/useInventory";
import { PageHeader } from "../../../ui/PageHeader";
import { InventoryError, InventoryLoading } from "./InventoryUi";

function isProtectedStore(code: string, isDefault: boolean): boolean {
  return isDefault || code === "KITCHEN" || code === "SIMPLE-STORE" || code === "WH-01";
}

export function StoresPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [editingAddress, setEditingAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const storesQuery = useQuery({
    queryKey: ["inventory", "warehouses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryWarehouses(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!branch?.code || !name.trim()) throw new Error("Enter a store name");
      return createInventoryWarehouse({
        branchCode: branch.code,
        name: name.trim(),
        code: code.trim() || undefined,
        address: address.trim() || undefined,
      });
    },
    onSuccess: (created) => {
      setName("");
      setCode("");
      setAddress("");
      setError(null);
      setNotice(`Store “${created.name}” created.`);
      void queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
    },
    onError: (err: Error) => {
      setNotice(null);
      setError(err.message);
    },
  });

  if (storesQuery.isLoading) return <InventoryLoading />;
  if (storesQuery.isError) return <InventoryError message={(storesQuery.error as Error).message} />;

  const stores = storesQuery.data?.warehouses ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stores"
        subtitle="Create extra stores (cold room, freezer, dry store) in addition to Main Warehouse and Kitchen. Use them on GRN and stock transfers."
      />
      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <form
          className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-[1fr_160px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <input
            className={inputClass}
            placeholder="Store name (e.g. Cold Room)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Code (optional)"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Address / note (optional)"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            disabled={createMutation.isPending || !name.trim()}
          >
            {createMutation.isPending ? "Adding…" : "Add store"}
          </button>
        </form>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 text-sm font-medium text-white">Branch stores</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => {
            const protectedStore = isProtectedStore(store.code, store.isDefault);
            return (
              <div
                key={store.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3"
              >
                {editingId === store.id ? (
                  <div className="min-w-0 flex-1 space-y-1.5 pr-2">
                    <input
                      className={`${inputClass} w-full`}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                    <input
                      className={`${inputClass} w-full`}
                      value={editingCode}
                      disabled={protectedStore}
                      onChange={(event) => setEditingCode(event.target.value)}
                    />
                    <input
                      className={`${inputClass} w-full`}
                      value={editingAddress}
                      placeholder="Address"
                      onChange={(event) => setEditingAddress(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-indigo-600 px-2 py-1 text-[11px] text-white"
                        onClick={() => {
                          void updateInventoryWarehouse(store.id, {
                            name: editingName.trim(),
                            ...(protectedStore ? {} : { code: editingCode.trim() }),
                            address: editingAddress.trim() || null,
                          })
                            .then(() => {
                              setEditingId(null);
                              setError(null);
                              setNotice("Store updated.");
                              void queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
                            })
                            .catch((err: Error) => setError(err.message));
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{store.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {store.code}
                      {store.isDefault ? " · Default" : ""}
                      {store.code === "KITCHEN" ? " · Kitchen" : ""}
                      {" · "}
                      {store.totalStock.toLocaleString()} stock
                    </div>
                    {store.address ? (
                      <div className="mt-0.5 truncate text-[11px] text-slate-600">{store.address}</div>
                    ) : null}
                  </div>
                )}
                {canManage && editingId !== store.id ? (
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      type="button"
                      className="text-[11px] text-sky-300 hover:text-sky-200"
                      onClick={() => {
                        setEditingId(store.id);
                        setEditingName(store.name);
                        setEditingCode(store.code);
                        setEditingAddress(store.address ?? "");
                      }}
                    >
                      Edit
                    </button>
                    {!protectedStore ? (
                      <button
                        type="button"
                        className="text-[11px] text-red-300 hover:text-red-200"
                        onClick={() => {
                          if (!window.confirm(`Delete store “${store.name}”? Stock must be empty.`)) return;
                          void deleteInventoryWarehouse(store.id)
                            .then(() => {
                              setError(null);
                              setNotice(`Store “${store.name}” deleted.`);
                              void queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
                            })
                            .catch((err: Error) => setError(err.message));
                        }}
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600">Protected</span>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
