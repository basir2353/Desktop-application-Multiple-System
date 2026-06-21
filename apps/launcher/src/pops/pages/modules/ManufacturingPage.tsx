import type { ProductionBatch } from "@platform/contracts";
import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createProductionBatch,
  fetchBranchInventory,
  fetchProductionBatches,
  postProductionBatch,
} from "../../api/inventory";
import {
  formatPkr,
  inputClass,
  selectClass,
  useInventoryAccess,
  useInvalidateInventory,
} from "../../hooks/useInventory";
import { accentValueClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./inventory/InventoryUi";

type NewBatchForm = {
  recipeId: string;
  outputQty: string;
  wastePct: string;
  outputIngredientId: string;
  outputDescription: string;
};

const emptyForm: NewBatchForm = {
  recipeId: "",
  outputQty: "1",
  wastePct: "2",
  outputIngredientId: "",
  outputDescription: "",
};

export function ManufacturingPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<NewBatchForm>(emptyForm);

  const batchesQuery = useQuery({
    queryKey: ["inventory", "production", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchProductionBatches(branch!.code),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createProductionBatch({
        branchCode: branch!.code,
        recipeId: form.recipeId,
        outputQty: Number(form.outputQty),
        wastePct: Number(form.wastePct),
        outputIngredientId: form.outputIngredientId || undefined,
        outputDescription: form.outputDescription.trim() || undefined,
      }),
    onSuccess: (batch) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory", "production"] });
      setShowCreate(false);
      setForm(emptyForm);
      setSelectedId(batch.id);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const postMutation = useMutation({
    mutationFn: (batchId: string) => postProductionBatch(batchId),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["inventory", "production"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const batches = batchesQuery.data ?? [];
  const selected = useMemo(
    () => batches.find((b) => b.id === selectedId) ?? batches.find((b) => b.status === "Draft") ?? batches[0],
    [batches, selectedId],
  );

  const activeRecipes = (inventoryQuery.data?.recipes ?? []).filter((r) => r.active && r.ingredients.length > 0);
  const ingredients = inventoryQuery.data?.ingredients ?? [];
  const draftCount = batches.filter((b) => b.status === "Draft").length;
  const postedToday = batches.filter(
    (b) => b.status === "Posted" && b.postedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10),
  ).length;

  if (batchesQuery.isLoading || inventoryQuery.isLoading) return <InventoryLoading />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production / batch kitchen"
        subtitle="Recipes, production journal, ingredient consumption, finished goods."
        actions={
          canManage ? (
            <>
              <Button variant="ghost" className="text-xs" onClick={() => setShowCreate((v) => !v)}>
                {showCreate ? "Cancel" : "New batch"}
              </Button>
              {selected?.status === "Draft" ? (
                <Button
                  className="text-xs"
                  disabled={postMutation.isPending}
                  onClick={() => postMutation.mutate(selected.id)}
                >
                  Post production
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {error ? <InventoryError message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Draft batches</div>
          <div className="text-xl font-semibold text-white">{draftCount}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Posted today</div>
          <div className={`text-xl font-semibold ${accentValueClass}`}>{postedToday}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-500">Active recipes</div>
          <div className="text-xl font-semibold text-white">{activeRecipes.length}</div>
        </div>
      </div>

      {showCreate && canManage ? (
        <InventoryFormPanel
          title="New production batch"
          submitLabel="Create batch"
          onSubmit={() => createMutation.mutate()}
          disabled={!form.recipeId || !form.outputQty || createMutation.isPending}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select
              className={selectClass}
              value={form.recipeId}
              onChange={(e) => setForm({ ...form, recipeId: e.target.value })}
            >
              <option value="">Recipe *</option>
              {activeRecipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.portionSize ? ` (${r.portionSize})` : ""}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              type="number"
              min={1}
              placeholder="Output units (portions) *"
              value={form.outputQty}
              onChange={(e) => setForm({ ...form, outputQty: e.target.value })}
            />
            <input
              className={inputClass}
              type="number"
              min={0}
              max={50}
              placeholder="Waste %"
              value={form.wastePct}
              onChange={(e) => setForm({ ...form, wastePct: e.target.value })}
            />
            <select
              className={selectClass}
              value={form.outputIngredientId}
              onChange={(e) => setForm({ ...form, outputIngredientId: e.target.value })}
            >
              <option value="">Finished goods ingredient (optional)</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.sku})
                </option>
              ))}
            </select>
            <input
              className={`sm:col-span-2 ${inputClass}`}
              placeholder="Output notes (optional)"
              value={form.outputDescription}
              onChange={(e) => setForm({ ...form, outputDescription: e.target.value })}
            />
          </div>
          {activeRecipes.length === 0 ? (
            <p className="mt-2 text-xs text-amber-300/90">
              Add recipes under Inventory → Recipe management before creating a batch.
            </p>
          ) : null}
        </InventoryFormPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 lg:col-span-1">
          <div className="text-xs font-semibold uppercase text-slate-500">Production journal</div>
          {batches.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No batches yet — create one from a recipe.</p>
          ) : (
            <ul className="mt-2 max-h-[28rem] space-y-1 overflow-y-auto">
              {batches.map((batch) => (
                <li key={batch.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(batch.id)}
                    className={`w-full rounded px-2 py-2 text-left text-sm transition ${
                      selected?.id === batch.id
                        ? "bg-amber-500/15 text-amber-100"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{batch.batchRef}</span>
                      <Badge tone={batch.status === "Posted" ? "success" : "warning"}>{batch.status}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{batch.outputName}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <BatchDetail
            batch={selected}
            canManage={canManage}
            isPosting={postMutation.isPending}
            onPost={() => postMutation.mutate(selected.id)}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-8 text-center text-sm text-slate-500 lg:col-span-2">
            Select a batch or create a new one to see ingredient consumption and finished goods.
          </div>
        )}
      </div>
    </div>
  );
}

function BatchDetail({
  batch,
  canManage,
  isPosting,
  onPost,
}: {
  batch: ProductionBatch;
  canManage: boolean;
  isPosting: boolean;
  onPost: () => void;
}): JSX.Element {
  return (
    <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-white">{batch.batchRef}</div>
            <p className="mt-1 text-xs text-slate-500">
              Output · {batch.outputDescription ?? batch.outputName}
            </p>
            {batch.recipeName ? (
              <p className="mt-1 text-xs text-slate-600">Recipe · {batch.recipeName}</p>
            ) : null}
          </div>
          <Badge tone={batch.status === "Posted" ? "success" : "warning"}>{batch.status}</Badge>
        </div>

        <SimpleTable
          rowKey={(r) => r.id}
          columns={[
            { key: "ingredient", header: "Ingredient" },
            { key: "qty", header: "Qty", render: (r) => `${r.qty} ${r.unit}` },
            { key: "cost", header: "Cost (Rs)", render: (r) => r.cost.toLocaleString() },
          ]}
          rows={batch.lines}
        />

        <div className="mt-3 flex justify-between text-sm text-slate-400">
          <span>Waste (est.)</span>
          <span>{batch.wastePct}%</span>
        </div>
        <div className="mt-1 flex justify-between text-sm text-slate-400">
          <span>Total material cost</span>
          <span className="text-white">{formatPkr(batch.totalCost)}</span>
        </div>

        {canManage && batch.status === "Draft" ? (
          <Button className="mt-4 w-full text-xs" disabled={isPosting} onClick={onPost}>
            Post production
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-medium text-white">Finished goods</div>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li className="flex justify-between gap-3">
            <span>{batch.outputIngredient ? `FG — ${batch.outputIngredient}` : batch.outputName}</span>
            <span>+{batch.outputQty} units</span>
          </li>
          <li className="flex justify-between">
            <span>Unit cost roll-up</span>
            <span className={accentValueClass}>{formatPkr(batch.unitCost)} / unit</span>
          </li>
          {batch.status === "Posted" && batch.postedAt ? (
            <li className="flex justify-between text-xs text-slate-500">
              <span>Posted</span>
              <span>{new Date(batch.postedAt).toLocaleString("en-PK")}</span>
            </li>
          ) : null}
        </ul>

        {batch.status === "Draft" ? (
          <p className="mt-4 text-xs text-slate-500">
            Posting deducts raw materials from stock
            {batch.outputIngredient ? ` and adds ${batch.outputQty} units to ${batch.outputIngredient}` : ""}.
            An inventory journal entry is recorded automatically.
          </p>
        ) : (
          <p className="mt-4 text-xs text-emerald-400/90">
            Batch posted — inventory and accounting updated.
          </p>
        )}
      </div>
    </div>
  );
}
