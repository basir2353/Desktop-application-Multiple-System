import type { BranchTransfer } from "@platform/contracts";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPopsBranches } from "../../../api/operations";
import {
  createManualBranchReceive,
  fetchBranchTransfers,
  fetchTransferIngredients,
  updateBranchTransfer,
} from "../../../api/multi-branch";
import { mbInputClass, useMultiBranchAccess } from "../../../hooks/useMultiBranch";
import { accentValueClass, mutedClass, panelClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { MbError, MbLoading } from "./MultiBranchUi";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type ItemEntryMode = "inventory" | "manual";

export function BranchReceivePage(): JSX.Element {
  const { branch, canManage } = useMultiBranchAccess();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"incoming" | "received">("incoming");
  const [formError, setFormError] = useState<string | null>(null);
  const [fromCode, setFromCode] = useState("");
  const [itemMode, setItemMode] = useState<ItemEntryMode>("inventory");
  const [ingredientId, setIngredientId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemUnit, setItemUnit] = useState("Kg");
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
    queryKey: ["multi-branch", "ingredients", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTransferIngredients(branch!.code),
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => updateBranchTransfer(id, "received"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["multi-branch"] }),
  });

  const manualReceiveMutation = useMutation({
    mutationFn: createManualBranchReceive,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["multi-branch"] });
      setQty("");
      setNotes("");
      setIngredientId("");
      setItemName("");
      setItemSku("");
      setFormError(null);
      setView("received");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const incoming = useMemo(() => {
    if (!branch?.code) return [];
    return (transfersQuery.data ?? []).filter(
      (t) => t.toBranchCode === branch.code && t.status === "dispatched",
    );
  }, [transfersQuery.data, branch?.code]);

  const received = useMemo(() => {
    if (!branch?.code) return [];
    return (transfersQuery.data ?? []).filter(
      (t) => t.toBranchCode === branch.code && t.status === "received",
    );
  }, [transfersQuery.data, branch?.code]);

  const pendingFromOthers = useMemo(() => {
    if (!branch?.code) return [];
    return (transfersQuery.data ?? []).filter(
      (t) => t.toBranchCode === branch.code && t.status === "pending",
    );
  }, [transfersQuery.data, branch?.code]);

  const displayed = view === "incoming" ? incoming : received;
  const branches = branchesQuery.data ?? [];
  const ingredients = ingredientsQuery.data?.ingredients ?? [];

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  function submitManualReceive(): void {
    if (!branch?.code) return;
    if (!fromCode) {
      setFormError("Select the branch goods came from.");
      return;
    }
    if (itemMode === "inventory" && !ingredientId) {
      setFormError("Select an item from your inventory.");
      return;
    }
    if (itemMode === "manual" && (!itemName.trim() || !itemSku.trim() || !itemUnit.trim())) {
      setFormError("Enter item name, SKU, and unit.");
      return;
    }
    if (!qty || Number(qty) <= 0) {
      setFormError("Enter a valid quantity.");
      return;
    }

    manualReceiveMutation.mutate({
      toBranchCode: branch.code,
      fromBranchCode: fromCode,
      ingredientId: itemMode === "inventory" ? ingredientId : undefined,
      ingredientName: itemMode === "inventory" ? selectedIngredient?.name ?? itemName : itemName.trim(),
      ingredientSku: itemMode === "inventory" ? selectedIngredient?.sku ?? itemSku : itemSku.trim(),
      unit: itemMode === "inventory" ? selectedIngredient?.unit ?? itemUnit : itemUnit.trim(),
      qty: Number(qty),
      notes: notes.trim() || undefined,
    });
  }

  if (transfersQuery.isLoading || branchesQuery.isLoading) return <MbLoading />;
  if (transfersQuery.isError) {
    return <MbError message={(transfersQuery.error as Error).message} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Receive from branches"
        subtitle={
          branch
            ? `Goods arriving at ${branch.name} (${branch.code}) from other branches.`
            : "Select a branch to view incoming transfers."
        }
        actions={
          <Link to="/pops/multi-branch" className="text-xs text-slate-400 hover:text-white">
            ← Overview
          </Link>
        }
      />

      {!branch ? (
        <p className={`text-sm ${mutedClass}`}>Choose a branch from the header to see incoming goods.</p>
      ) : (
        <>
          {canManage ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div>
                <div className="text-sm font-medium text-white">Log received goods</div>
                <p className={`mt-0.5 text-xs ${mutedClass}`}>
                  Record goods received from another branch and add them to this branch&apos;s inventory.
                </p>
              </div>

              {formError ? <MbError message={formError} /> : null}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  className={mbInputClass}
                  value={fromCode}
                  onChange={(e) => setFromCode(e.target.value)}
                >
                  <option value="">From branch *</option>
                  {branches
                    .filter((b) => b.code !== branch.code)
                    .map((b) => (
                      <option key={b.id} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                </select>

                <select
                  className={mbInputClass}
                  value={itemMode}
                  onChange={(e) => {
                    setItemMode(e.target.value as ItemEntryMode);
                    setIngredientId("");
                    setItemName("");
                    setItemSku("");
                  }}
                >
                  <option value="inventory">From my inventory</option>
                  <option value="manual">Enter item manually</option>
                </select>

                {itemMode === "inventory" ? (
                  <select
                    className={`${mbInputClass} sm:col-span-2`}
                    value={ingredientId}
                    onChange={(e) => setIngredientId(e.target.value)}
                  >
                    <option value="">Select item *</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku}) · {i.currentStock} {i.unit}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      className={mbInputClass}
                      placeholder="Item name *"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                    />
                    <input
                      className={mbInputClass}
                      placeholder="SKU *"
                      value={itemSku}
                      onChange={(e) => setItemSku(e.target.value)}
                    />
                    <input
                      className={mbInputClass}
                      placeholder="Unit *"
                      value={itemUnit}
                      onChange={(e) => setItemUnit(e.target.value)}
                    />
                  </>
                )}

                <input
                  className={mbInputClass}
                  type="number"
                  min={1}
                  placeholder="Quantity *"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>

              <input
                className={mbInputClass}
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <button
                type="button"
                disabled={manualReceiveMutation.isPending}
                onClick={submitManualReceive}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Save receive & add to stock
              </button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={panelClass + " p-4"}>
              <div className={`text-xs ${mutedClass}`}>Ready to receive</div>
              <div className={`text-xl font-semibold ${accentValueClass}`}>{incoming.length}</div>
              <p className={`mt-1 text-[11px] ${mutedClass}`}>Dispatched and in transit</p>
            </div>
            <div className={panelClass + " p-4"}>
              <div className={`text-xs ${mutedClass}`}>Awaiting dispatch</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white">
                {pendingFromOthers.length}
              </div>
              <p className={`mt-1 text-[11px] ${mutedClass}`}>Created but not sent yet</p>
            </div>
            <div className={panelClass + " p-4"}>
              <div className={`text-xs ${mutedClass}`}>Received total</div>
              <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {received.length}
              </div>
              <p className={`mt-1 text-[11px] ${mutedClass}`}>Added to your inventory</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("incoming")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                view === "incoming"
                  ? "bg-amber-500 text-slate-950"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Incoming ({incoming.length})
            </button>
            <button
              type="button"
              onClick={() => setView("received")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                view === "received"
                  ? "bg-amber-500 text-slate-950"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Received history ({received.length})
            </button>
          </div>

          {view === "incoming" && pendingFromOthers.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              {pendingFromOthers.length} transfer{pendingFromOthers.length === 1 ? "" : "s"} heading
              here but not dispatched yet — they will appear below once the sending branch dispatches
              them.
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            {displayed.length === 0 ? (
              <p className={`text-sm ${mutedClass}`}>
                {view === "incoming"
                  ? "No goods in transit to this branch right now."
                  : "No received transfers yet for this branch."}
              </p>
            ) : (
              <SimpleTable<BranchTransfer>
                rowKey={(r) => r.id}
                rows={displayed}
                columns={[
                  { key: "transferRef", header: "Ref" },
                  {
                    key: "fromBranchCode",
                    header: "From",
                    render: (r) => (
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {r.fromBranchCode}
                        </div>
                        <div className={`text-xs ${mutedClass}`}>{r.fromBranchName}</div>
                      </div>
                    ),
                  },
                  {
                    key: "ingredientName",
                    header: "Goods / item",
                    render: (r) => (
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {r.ingredientName}
                        </div>
                        <div className={`text-xs ${mutedClass}`}>SKU {r.ingredientSku}</div>
                      </div>
                    ),
                  },
                  {
                    key: "qty",
                    header: "Quantity",
                    render: (r) => (
                      <span className="font-semibold tabular-nums">
                        {r.qty.toLocaleString()} {r.unit}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => (
                      <Badge tone={r.status === "received" ? "success" : "info"}>{r.status}</Badge>
                    ),
                  },
                  {
                    key: "dispatchedAt",
                    header: view === "incoming" ? "Dispatched" : "Received",
                    render: (r) =>
                      view === "incoming"
                        ? formatWhen(r.dispatchedAt)
                        : formatWhen(r.receivedAt),
                  },
                  {
                    key: "notes",
                    header: "Notes",
                    render: (r) => r.notes ?? "—",
                  },
                  {
                    key: "createdBy",
                    header: "Logged by",
                    render: (r) => r.createdBy ?? "—",
                  },
                  ...(view === "incoming" && canManage
                    ? [
                        {
                          id: "actions",
                          key: "id" as const,
                          header: "",
                          render: (r: BranchTransfer) => (
                            <button
                              type="button"
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                              disabled={receiveMutation.isPending}
                              onClick={() => receiveMutation.mutate(r.id)}
                            >
                              Confirm receive
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>

          {view === "incoming" && pendingFromOthers.length > 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <div className="mb-3 text-sm font-medium text-white">Pending from other branches</div>
              <SimpleTable<BranchTransfer>
                rowKey={(r) => r.id}
                rows={pendingFromOthers}
                columns={[
                  { key: "transferRef", header: "Ref" },
                  { key: "fromBranchCode", header: "From" },
                  { key: "ingredientName", header: "Item" },
                  {
                    key: "qty",
                    header: "Qty",
                    render: (r) => `${r.qty} ${r.unit}`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: () => <Badge tone="warning">pending dispatch</Badge>,
                  },
                  {
                    key: "createdAt",
                    header: "Created",
                    render: (r) => formatWhen(r.createdAt),
                  },
                  { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
                ]}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
