import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createRecipe, deleteRecipe, fetchBranchInventory } from "../../../api/inventory";
import { fetchBranchMenuAdmin } from "../../../api/menu";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { linkDangerClass, linkWarningClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

type IngredientLineRow = {
  ingredientId: string;
  qty: string;
  unit: string;
};

function emptyIngredientLine(): IngredientLineRow {
  return { ingredientId: "", qty: "", unit: "" };
}

export function RecipeManagementPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    menuItemId: "",
    portionSize: "1 portion",
    version: "v1.0",
    lines: [emptyIngredientLine()] as IngredientLineRow[],
  });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const menuQuery = useQuery({
    queryKey: ["menu", "admin", branch?.code],
    enabled: Boolean(branch?.code && canManage),
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
  });

  const ingredients = query.data?.ingredients ?? [];
  const recipes = query.data?.recipes ?? [];
  const menuItems = menuQuery.data?.items ?? [];

  const ingredientById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );

  const validLines = useMemo(
    () =>
      form.lines
        .filter((row) => row.ingredientId && Number(row.qty) > 0)
        .map((row) => ({
          ingredientId: row.ingredientId,
          qty: Number(row.qty),
          unit: row.unit.trim() || ingredientById.get(row.ingredientId)?.unit || "g",
        })),
    [form.lines, ingredientById],
  );

  const canSubmit =
    form.name.trim().length > 0 &&
    form.menuItemId.length > 0 &&
    validLines.length > 0;

  const createMutation = useMutation({
    mutationFn: () => {
      if (validLines.length === 0) {
        throw new Error("Add at least one ingredient with a quantity.");
      }
      return createRecipe({
        branchCode: branch!.code,
        name: form.name.trim(),
        menuItemId: form.menuItemId,
        version: form.version,
        portionSize: form.portionSize,
        lines: validLines,
      });
    },
    onSuccess: () => {
      invalidate();
      setForm({
        name: "",
        menuItemId: "",
        portionSize: "1 portion",
        version: "v1.0",
        lines: [emptyIngredientLine()],
      });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function updateLine(index: number, patch: Partial<IngredientLineRow>): void {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.ingredientId !== undefined) {
          const ing = ingredientById.get(patch.ingredientId);
          if (ing) next.unit = ing.unit;
        }
        return next;
      }),
    }));
  }

  function onMenuItemChange(menuItemId: string): void {
    const dish = menuItems.find((m) => m.id === menuItemId);
    setForm((prev) => ({
      ...prev,
      menuItemId,
      name: prev.name.trim() || dish?.name || prev.name,
    }));
  }

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recipe management"
        subtitle="Link menu dishes to ingredients — each sale deducts the quantities below from stock."
      />
      {error ? <InventoryError message={error} /> : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        Add every ingredient used in one portion of the dish. When the linked menu item is sold on POS,
        these amounts are deducted automatically and logged in inventory audit.
      </div>

      {canManage ? (
        <InventoryFormPanel
          title="Create recipe"
          submitLabel="Save recipe"
          onSubmit={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
        >
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs text-slate-400">
                Menu dish
                <select
                  className={`${selectClass} mt-1`}
                  value={form.menuItemId}
                  onChange={(e) => onMenuItemChange(e.target.value)}
                >
                  <option value="">Select dish</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                Recipe name
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. Chicken Karahi"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Portion size
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="1 portion"
                  value={form.portionSize}
                  onChange={(e) => setForm((prev) => ({ ...prev, portionSize: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Version
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="v1.0"
                  value={form.version}
                  onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                />
              </label>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-300">Ingredients per portion</div>
              <p className="mt-1 text-[10px] text-slate-500">
                Select each ingredient and the quantity used for one sale of this dish.
              </p>
              <ul className="mt-2 space-y-2">
                {form.lines.map((row, index) => {
                  const ing = row.ingredientId ? ingredientById.get(row.ingredientId) : null;
                  return (
                    <li
                      key={index}
                      className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 sm:grid-cols-12"
                    >
                      <label className="block text-[10px] text-slate-500 sm:col-span-5">
                        Ingredient
                        <select
                          className={`${selectClass} mt-1 text-xs`}
                          value={row.ingredientId}
                          onChange={(e) => updateLine(index, { ingredientId: e.target.value })}
                        >
                          <option value="">Select ingredient</option>
                          {ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-[10px] text-slate-500 sm:col-span-3">
                        Quantity
                        <input
                          className={`${inputClass} mt-1 text-xs`}
                          type="number"
                          min={1}
                          step={1}
                          placeholder="e.g. 500"
                          value={row.qty}
                          onChange={(e) => updateLine(index, { qty: e.target.value })}
                        />
                      </label>
                      <label className="block text-[10px] text-slate-500 sm:col-span-3">
                        Unit
                        <input
                          className={`${inputClass} mt-1 text-xs`}
                          placeholder="g, Kg, Piece…"
                          value={row.unit}
                          onChange={(e) => updateLine(index, { unit: e.target.value })}
                        />
                      </label>
                      <div className="flex items-end sm:col-span-1">
                        {form.lines.length > 1 ? (
                          <button
                            type="button"
                            className={`pb-1.5 text-[10px] ${linkDangerClass}`}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                lines: prev.lines.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      {ing ? (
                        <p className="text-[10px] text-slate-600 sm:col-span-12">
                          In stock: {ing.currentStock.toLocaleString()} {ing.unit}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className={`mt-2 text-xs ${linkWarningClass}`}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    lines: [...prev.lines, emptyIngredientLine()],
                  }))
                }
              >
                + Add ingredient
              </button>
            </div>
          </div>
        </InventoryFormPanel>
      ) : null}

      {recipes.map((recipe) => (
        <div key={recipe.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{recipe.name}</span>
                <Badge tone="info">{recipe.version}</Badge>
                <Badge tone={recipe.active ? "success" : "neutral"}>
                  {recipe.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Menu: {recipe.menuItem ?? "Not linked"} · Portion: {recipe.portionSize ?? "—"} · Cost:
                Rs {recipe.totalCost.toLocaleString()}
              </div>
            </div>
            {canManage ? (
              <button
                type="button"
                className={`text-xs ${linkDangerClass}`}
                onClick={() => deleteMutation.mutate(recipe.id)}
              >
                Delete
              </button>
            ) : null}
          </div>
          <div className="mt-3">
            <SimpleTable
              rowKey={(r) => r.id}
              columns={[
                { key: "ingredient", header: "Ingredient" },
                { key: "qty", header: "Qty per sale", render: (r) => `${r.qty} ${r.unit}` },
              ]}
              rows={recipe.ingredients}
            />
          </div>
        </div>
      ))}

      {recipes.length === 0 ? (
        <p className="text-sm text-slate-500">
          No recipes yet. Link a menu dish to its ingredients so orders update stock automatically.
        </p>
      ) : null}
    </div>
  );
}
