import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createInventoryCookingUnit,
  fetchInventoryCookingUnitStock,
  fetchInventoryCookingUnits,
  updateInventoryCookingUnit,
} from "../../../api/inventory";
import { inputClass, useInventoryAccess } from "../../../hooks/useInventory";
import { PageHeader } from "../../../ui/PageHeader";
import { InventoryError, InventoryLoading } from "./InventoryUi";

export function CookingUnitsPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const unitsQuery = useQuery({
    queryKey: ["inventory", "cooking-units", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnits(branch!.code),
  });
  const stockQuery = useQuery({
    queryKey: ["inventory", "cooking-unit-stock", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnitStock(branch!.code),
  });
  const createMutation = useMutation({
    mutationFn: () => {
      if (!branch?.code || !name.trim()) throw new Error("Enter a Cooking Unit name");
      return createInventoryCookingUnit({
        branchCode: branch.code,
        name: name.trim(),
        code: code.trim() || undefined,
      });
    },
    onSuccess: () => {
      setName("");
      setCode("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["inventory", "cooking-units"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (unitsQuery.isLoading) return <InventoryLoading />;
  if (unitsQuery.isError) return <InventoryError message={(unitsQuery.error as Error).message} />;

  const units = unitsQuery.data?.units ?? [];
  const stock = stockQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cooking Units"
        subtitle="Kitchen sections for Pakistani, Fast Food, Chinese, Continental, Grill, and your own custom sections."
      />
      {error ? <InventoryError message={error} /> : null}
      {canManage ? (
        <form
          className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <input className={inputClass} placeholder="Cooking Unit name" value={name} onChange={(event) => setName(event.target.value)} />
          <input className={inputClass} placeholder="Code (optional)" value={code} onChange={(event) => setCode(event.target.value)} />
          <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50" disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending ? "Adding…" : "Add unit"}
          </button>
        </form>
      ) : null}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 text-sm font-medium text-white">Configured Kitchen sections</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <div key={unit.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 p-3">
              {editingId === unit.id ? (
                <div className="min-w-0 flex-1 space-y-1.5 pr-2">
                  <input className={`${inputClass} w-full`} value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                  <input className={`${inputClass} w-full`} value={editingCode} onChange={(event) => setEditingCode(event.target.value)} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-2 py-1 text-[11px] text-white"
                      onClick={() => {
                        void updateInventoryCookingUnit(unit.id, { name: editingName.trim(), code: editingCode.trim() })
                          .then(() => {
                            setEditingId(null);
                            setError(null);
                            void queryClient.invalidateQueries({ queryKey: ["inventory", "cooking-units"] });
                          })
                          .catch((err: Error) => setError(err.message));
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-white">{unit.name}</div>
                  <div className="text-[11px] text-slate-500">{unit.code} · {unit.totalStock.toLocaleString()} stock units</div>
                </div>
              )}
              {canManage ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${unit.isActive ? "border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-500"}`}
                    onClick={() => {
                      void updateInventoryCookingUnit(unit.id, { isActive: !unit.isActive })
                        .then(() => {
                          setError(null);
                          void queryClient.invalidateQueries({ queryKey: ["inventory", "cooking-units"] });
                        })
                        .catch((err: Error) => setError(err.message));
                    }}
                  >
                    {unit.isActive ? "Active" : "Inactive"}
                  </button>
                  {editingId !== unit.id ? (
                    <button
                      type="button"
                      className="text-[11px] text-sky-300 hover:text-sky-200"
                      onClick={() => {
                        setEditingId(unit.id);
                        setEditingName(unit.name);
                        setEditingCode(unit.code);
                      }}
                    >
                      Rename
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 text-sm font-medium text-white">Kitchen stock by section</div>
        {stock.length === 0 ? (
          <p className="text-xs text-slate-500">No unit stock has been transferred yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-2 py-2">Cooking Unit</th>
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stock.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2 text-slate-300">{units.find((unit) => unit.id === row.cookingUnitId)?.name ?? "Unassigned"}</td>
                    <td className="px-2 py-2 text-white">{row.productName}</td>
                    <td className="px-2 py-2 text-slate-500">{row.sku}</td>
                    <td className="px-2 py-2 text-slate-400">{row.unit}</td>
                    <td className="px-2 py-2 text-right font-medium text-amber-200">{row.quantity.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
