import { Button } from "@platform/ui";
import {
  DEFAULT_RECIPE_PORTION_FACTORS,
  RECIPE_PORTION_PRESETS,
} from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { createRecipe, deleteRecipe, fetchBranchInventory, updateRecipe } from "../../../api/inventory";
import { fetchBranchMenuAdmin } from "../../../api/menu";
import { IngredientPickerModal } from "../../../components/IngredientPickerModal";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { linkDangerClass, linkWarningClass, noticeSuccessClass } from "../../../lib/themeClasses";
import {
  exportRecipesExcel,
  downloadRecipeImportTemplateExcel,
  importRecipeRows,
  parseRecipeImportFile,
} from "../../../lib/recipeImportExport";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SearchableSelect } from "../../../ui/SearchableSelect";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

type IngredientLineRow = {
  ingredientId: string;
  qty: string;
  unit: string;
};

export function RecipeManagementPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [previewPortion, setPreviewPortion] = useState("Full");
  const [form, setForm] = useState({
    name: "",
    menuItemId: "",
    portionSize: "Full",
    portionFactors: { ...DEFAULT_RECIPE_PORTION_FACTORS } as Record<string, number>,
    version: "v1.0",
    lines: [] as IngredientLineRow[],
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

  const selectedDish = menuItems.find((item) => item.id === form.menuItemId);
  const dishPortionLabels = useMemo(() => {
    const fromVariants = (selectedDish?.variants ?? [])
      .map((variant) => variant.label?.trim())
      .filter((label): label is string => Boolean(label));
    const merged = [...RECIPE_PORTION_PRESETS, ...fromVariants];
    return [...new Set(merged)];
  }, [selectedDish]);

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

  const previewFactor = form.portionFactors[previewPortion] ?? 1;

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
        portionFactors: form.portionFactors,
        lines: validLines,
      });
    },
    onSuccess: () => {
      invalidate();
      setForm({
        name: "",
        menuItemId: "",
        portionSize: "Full",
        portionFactors: { ...DEFAULT_RECIPE_PORTION_FACTORS },
        version: "v1.0",
        lines: [],
      });
      setPreviewPortion("Full");
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
    const variantLabels = (dish?.variants ?? [])
      .map((variant) => variant.label?.trim())
      .filter((label): label is string => Boolean(label));
    const factors = { ...DEFAULT_RECIPE_PORTION_FACTORS };
    for (const label of variantLabels) {
      if (factors[label] == null) factors[label] = 1;
    }
    const preferredBase =
      variantLabels.find((label) => /full/i.test(label)) ??
      variantLabels[0] ??
      "Full";
    setForm((prev) => ({
      ...prev,
      menuItemId,
      name: prev.name.trim() || dish?.name || prev.name,
      portionSize: preferredBase,
      portionFactors: factors,
    }));
    setPreviewPortion(preferredBase);
  }

  function setPortionFactor(label: string, value: string): void {
    const n = Number(value);
    setForm((prev) => ({
      ...prev,
      portionFactors: {
        ...prev.portionFactors,
        [label]: Number.isFinite(n) && n > 0 ? n : prev.portionFactors[label] ?? 1,
      },
    }));
  }

  function handleExportRecipesExcel(): void {
    if (!branch?.code) return;
    exportRecipesExcel(recipes, branch.code);
    setTransferNotice("Recipes exported to Excel.");
  }

  function handleDownloadRecipeImportTemplate(): void {
    if (!branch?.code) return;
    downloadRecipeImportTemplateExcel(branch.code);
    setTransferNotice("Recipe import template downloaded.");
  }

  async function handleImportRecipesFile(file: File): Promise<void> {
    if (!branch?.code) return;
    setTransferBusy(true);
    setTransferNotice(null);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseRecipeImportFile(buffer, file.name);
      if (parsed.rows.length === 0) {
        throw new Error(
          "No recipe rows found. Use our Download template (Recipe Lines sheet)." +
            (parsed.skipReasons[0] ? ` ${parsed.skipReasons[0]}` : ""),
        );
      }

      const summary = await importRecipeRows(parsed.rows, {
        branchCode: branch.code,
        recipes,
        menuItems,
        ingredients,
        createRecipe: (input) =>
          createRecipe({
            branchCode: branch.code,
            name: input.name,
            menuItemId: input.menuItemId,
            version: input.version,
            portionSize: input.portionSize,
            active: input.active,
            lines: input.lines,
          }),
        updateRecipe: (recipeId, input) =>
          updateRecipe(recipeId, {
            name: input.name,
            menuItemId: input.menuItemId,
            version: input.version,
            portionSize: input.portionSize,
            active: input.active,
            lines: input.lines,
          }),
      });

      invalidate();
      const totalSkipped = summary.skipped + parsed.skipped;
      const reasons = [...parsed.skipReasons, ...summary.skipReasons].slice(0, 5);
      setTransferNotice(
        `Import complete — ${summary.recipesCreated} new recipe${summary.recipesCreated === 1 ? "" : "s"}, ${summary.recipesUpdated} updated${totalSkipped > 0 ? `, ${totalSkipped} skipped` : ""}.`,
      );
      if (reasons.length) setError(reasons.join(" · "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recipe import failed");
    } finally {
      setTransferBusy(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportRecipesFile(file);
        }}
      />

      <PageHeader
        title="Recipe management"
        subtitle="Link menu dishes to ingredients — each sale deducts the quantities below from stock."
        actions={
          canManage ? (
            <>
              <Button
                variant="ghost"
                className="text-xs"
                disabled={transferBusy || query.isLoading || recipes.length === 0}
                onClick={handleExportRecipesExcel}
              >
                Export Excel
              </Button>
              <Button
                variant="ghost"
                className="text-xs"
                disabled={transferBusy || query.isLoading}
                onClick={handleDownloadRecipeImportTemplate}
              >
                Download template
              </Button>
              <Button
                className="text-xs"
                disabled={transferBusy || query.isLoading || menuQuery.isLoading}
                onClick={() => importFileRef.current?.click()}
              >
                {transferBusy ? "Importing…" : "Import Excel"}
              </Button>
            </>
          ) : undefined
        }
      />

      {transferNotice ? <p className={noticeSuccessClass}>{transferNotice}</p> : null}
      {error ? <InventoryError message={error} /> : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        Enter ingredient quantities for the <span className="text-slate-200">base portion</span> (usually Full).
        Half / Small / Medium / Large multipliers scale those quantities when POS sells that size.
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
                <SearchableSelect
                  className="mt-1"
                  options={menuItems.map((item) => ({
                    value: item.id,
                    label: item.name,
                    searchText: item.secondaryName ?? "",
                  }))}
                  value={form.menuItemId}
                  onChange={onMenuItemChange}
                  placeholder="Select dish"
                  searchPlaceholder="Search dish…"
                />
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
                Base portion
                <select
                  className={`${selectClass} mt-1`}
                  value={form.portionSize}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((prev) => ({ ...prev, portionSize: next }));
                    setPreviewPortion(next);
                  }}
                >
                  {dishPortionLabels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
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
              <div className="text-xs font-medium text-slate-300">Portion sizes & ingredient scale</div>
              <p className="mt-1 text-[10px] text-slate-500">
                Base qty is for {form.portionSize}. Other sizes multiply ingredients (Half 0.5, Large 1.25…).
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dishPortionLabels.map((label) => (
                  <label
                    key={label}
                    className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
                      form.portionSize === label
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                        : "border-slate-700 bg-slate-950/50 text-slate-300"
                    }`}
                  >
                    <span className="font-medium">{label}</span>
                    <input
                      className={`${inputClass} w-16 py-1 text-[11px]`}
                      type="number"
                      min={0.1}
                      step={0.05}
                      value={form.portionFactors[label] ?? 1}
                      onChange={(e) => setPortionFactor(label, e.target.value)}
                    />
                    <span className="text-slate-500">×</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>Preview ingredients as</span>
                <select
                  className={`${selectClass} w-auto py-1`}
                  value={previewPortion}
                  onChange={(e) => setPreviewPortion(e.target.value)}
                >
                  {dishPortionLabels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500">
                  (×{previewFactor}
                  {previewPortion !== form.portionSize ? ` vs base ${form.portionSize}` : ""})
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-300">
                Ingredients per {form.portionSize}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Enter quantities for the base portion. Preview column shows scaled qty for {previewPortion}.
              </p>
              <ul className="mt-2 space-y-2">
                {form.lines
                  .filter((row) => row.ingredientId)
                  .map((row) => {
                    const ing = ingredientById.get(row.ingredientId);
                    const index = form.lines.findIndex((l) => l.ingredientId === row.ingredientId);
                    const baseQty = Number(row.qty) || 0;
                    const scaledQty = Math.max(0, Math.round(baseQty * previewFactor));
                    return (
                      <li
                        key={row.ingredientId}
                        className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-4">
                          <div className="text-[10px] text-slate-500">Ingredient</div>
                          <div className="mt-1 text-xs font-medium text-white">{ing?.name ?? "—"}</div>
                          {ing ? (
                            <div className="text-[10px] text-slate-500">
                              {ing.sku}
                              {ing.categoryName ? ` · ${ing.categoryName}` : ""}
                              {` · stock ${ing.currentStock} ${ing.unit}`}
                            </div>
                          ) : null}
                        </div>
                        <label className="block text-[10px] text-slate-500 sm:col-span-2">
                          Qty ({form.portionSize})
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
                        <label className="block text-[10px] text-slate-500 sm:col-span-2">
                          Unit
                          <input
                            className={`${inputClass} mt-1 text-xs`}
                            placeholder="g, Kg, Piece…"
                            value={row.unit}
                            onChange={(e) => updateLine(index, { unit: e.target.value })}
                          />
                        </label>
                        <div className="sm:col-span-3">
                          <div className="text-[10px] text-slate-500">{previewPortion} uses</div>
                          <div className="mt-1 text-xs font-medium text-emerald-300">
                            {scaledQty} {row.unit || ing?.unit || ""}
                          </div>
                          {ing?.categoryName ? (
                            <div className="text-[10px] text-slate-500">Category · {ing.categoryName}</div>
                          ) : null}
                        </div>
                        <div className="flex items-end sm:col-span-1">
                          <button
                            type="button"
                            className={`pb-1.5 text-[10px] ${linkDangerClass}`}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                lines: prev.lines.filter((l) => l.ingredientId !== row.ingredientId),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
              <button
                type="button"
                className={`mt-2 text-xs ${linkWarningClass}`}
                onClick={() => setPickerOpen(true)}
              >
                + Select ingredients…
              </button>
            </div>
          </div>
        </InventoryFormPanel>
      ) : null}

      {pickerOpen ? (
        <IngredientPickerModal
          ingredients={ingredients}
          excludedIds={new Set(form.lines.map((l) => l.ingredientId).filter(Boolean))}
          title="Select ingredients"
          subtitle="Choose one or more items for this recipe."
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            setForm((prev) => {
              const existing = new Set(prev.lines.map((l) => l.ingredientId));
              const added = ids
                .filter((id) => !existing.has(id))
                .map((id) => {
                  const ing = ingredientById.get(id);
                  return {
                    ingredientId: id,
                    qty: "1",
                    unit: ing?.unit ?? "g",
                  };
                });
              const kept = prev.lines.filter((l) => l.ingredientId);
              return { ...prev, lines: [...kept, ...added] };
            });
            setPickerOpen(false);
          }}
        />
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
