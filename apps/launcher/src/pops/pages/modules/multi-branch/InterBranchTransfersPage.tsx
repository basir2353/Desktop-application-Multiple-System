import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPopsBranches } from "../../../api/operations";
import {
  createBranchTransfer,
  fetchBranchTransfers,
  fetchTransferIngredients,
  updateBranchTransfer,
} from "../../../api/multi-branch";
import { mbInputClass, useMultiBranchAccess } from "../../../hooks/useMultiBranch";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { MbError, MbLoading } from "./MultiBranchUi";

export function InterBranchTransfersPage(): JSX.Element {
  const { canManage } = useMultiBranchAccess();
  const queryClient = useQueryClient();
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches"],
    queryFn: fetchPopsBranches,
  });

  const transfersQuery = useQuery({
    queryKey: ["multi-branch", "transfers"],
    queryFn: fetchBranchTransfers,
  });

  const ingredientsQuery = useQuery({
    queryKey: ["multi-branch", "ingredients", fromCode],
    enabled: Boolean(fromCode),
    queryFn: () => fetchTransferIngredients(fromCode),
  });

  const createMutation = useMutation({
    mutationFn: createBranchTransfer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["multi-branch"] });
      setQty("");
      setNotes("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "dispatched" | "received" | "cancelled" }) =>
      updateBranchTransfer(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["multi-branch"] }),
  });

  if (transfersQuery.isLoading || branchesQuery.isLoading) return <MbLoading />;
  if (transfersQuery.isError) return <MbError message={(transfersQuery.error as Error).message} />;

  const branches = branchesQuery.data ?? [];
  const transfers = transfersQuery.data ?? [];
  const ingredients = ingredientsQuery.data?.ingredients ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inter-branch transfers"
        subtitle="Move inventory between branches. Dispatch reduces source stock; receive adds to destination."
        actions={
          <Link to="/pops/multi-branch" className="text-xs text-slate-400 hover:text-white">
            ← Overview
          </Link>
        }
      />

      {canManage ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="text-sm font-medium text-white">New transfer</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select className={mbInputClass} value={fromCode} onChange={(e) => { setFromCode(e.target.value); setIngredientId(""); }}>
              <option value="">From branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.code}>{b.code} — {b.name}</option>
              ))}
            </select>
            <select className={mbInputClass} value={toCode} onChange={(e) => setToCode(e.target.value)}>
              <option value="">To branch</option>
              {branches.filter((b) => b.code !== fromCode).map((b) => (
                <option key={b.id} value={b.code}>{b.code} — {b.name}</option>
              ))}
            </select>
            <select className={mbInputClass} value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} disabled={!fromCode}>
              <option value="">Ingredient</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>
              ))}
            </select>
            <input className={mbInputClass} type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <input className={mbInputClass} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            type="button"
            disabled={createMutation.isPending || !fromCode || !toCode || !ingredientId || !qty}
            onClick={() =>
              createMutation.mutate({
                fromBranchCode: fromCode,
                toBranchCode: toCode,
                ingredientId,
                qty: Number(qty),
                notes: notes || undefined,
              })
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Create transfer
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          rows={transfers as unknown as Record<string, unknown>[]}
          columns={[
            { key: "transferRef", header: "Ref" },
            { key: "fromBranchCode", header: "From" },
            { key: "toBranchCode", header: "To" },
            { key: "ingredientName", header: "Item" },
            { key: "qty", header: "Qty", render: (r) => `${String(r.qty)} ${String(r.unit)}` },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "received" ? "success" : r.status === "dispatched" ? "info" : r.status === "cancelled" ? "neutral" : "warning"}>
                  {String(r.status)}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage ? (
                  <span className="flex gap-2">
                    {r.status === "pending" ? (
                      <button type="button" className="text-xs text-emerald-400" onClick={() => updateMutation.mutate({ id: String(r.id), status: "dispatched" })}>Dispatch</button>
                    ) : null}
                    {r.status === "dispatched" ? (
                      <button type="button" className="text-xs text-emerald-400" onClick={() => updateMutation.mutate({ id: String(r.id), status: "received" })}>Receive</button>
                    ) : null}
                    {r.status === "pending" || r.status === "dispatched" ? (
                      <button type="button" className="text-xs text-red-400" onClick={() => updateMutation.mutate({ id: String(r.id), status: "cancelled" })}>Cancel</button>
                    ) : null}
                  </span>
                ) : null,
            },
          ]}
        />
      </div>
    </div>
  );
}
