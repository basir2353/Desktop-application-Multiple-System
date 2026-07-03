import * as XLSX from "xlsx";
import type { Ingredient, MenuItem, Recipe } from "@platform/contracts";

export type RecipeImportRow = {
  recipeName: string;
  menuDish: string;
  version: string;
  portionSize: string;
  active: boolean;
  ingredient: string;
  qty: number;
  unit: string;
};

export type RecipeImportSummary = {
  recipesCreated: number;
  recipesUpdated: number;
  skipped: number;
};

const RECIPE_LINES_SHEET = "Recipe Lines";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function yesNo(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return fallback;
  return text === "yes" || text === "y" || text === "true" || text === "1";
}

function cellString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (match && String(match[1] ?? "").trim()) return String(match[1]).trim();
  }
  return "";
}

function cellNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && direct !== "") {
      const n = Number(direct);
      if (Number.isFinite(n)) return n;
    }
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (match && match[1] != null && match[1] !== "") {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function recipeLineRows(recipes: Recipe[]): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];

  for (const recipe of recipes) {
    if (recipe.ingredients.length === 0) {
      rows.push({
        "Recipe Name": recipe.name,
        "Menu Dish": recipe.menuItem ?? "",
        Version: recipe.version,
        "Portion Size": recipe.portionSize ?? "",
        Active: recipe.active ? "Yes" : "No",
        Ingredient: "",
        Qty: "",
        Unit: "",
      });
      continue;
    }

    for (const line of recipe.ingredients) {
      rows.push({
        "Recipe Name": recipe.name,
        "Menu Dish": recipe.menuItem ?? "",
        Version: recipe.version,
        "Portion Size": recipe.portionSize ?? "",
        Active: recipe.active ? "Yes" : "No",
        Ingredient: line.ingredient,
        Qty: line.qty,
        Unit: line.unit,
      });
    }
  }

  return rows;
}

export function exportRecipesExcel(recipes: Recipe[], branchCode: string): void {
  const summaryRows = recipes.map((recipe) => ({
    "Recipe Name": recipe.name,
    "Menu Dish": recipe.menuItem ?? "",
    Version: recipe.version,
    "Portion Size": recipe.portionSize ?? "",
    Active: recipe.active ? "Yes" : "No",
    "Total Cost": recipe.totalCost,
    "Ingredient Count": recipe.ingredients.length,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Recipes");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recipeLineRows(recipes)), RECIPE_LINES_SHEET);

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `recipes-${branchCode}-${date}.xlsx`,
  );
}

export function parseRecipeImportFile(buffer: ArrayBuffer, filename: string): RecipeImportRow[] {
  const lower = filename.toLowerCase();
  const wb = lower.endsWith(".csv")
    ? XLSX.read(new TextDecoder().decode(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });

  const sheetName =
    wb.SheetNames.find((name) => name.toLowerCase() === RECIPE_LINES_SHEET.toLowerCase()) ??
    wb.SheetNames.find((name) => name.toLowerCase().includes("recipe")) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const parsed: RecipeImportRow[] = [];

  for (const row of rawRows) {
    const recipeName = cellString(row, "Recipe Name", "recipe name", "name");
    const menuDish = cellString(row, "Menu Dish", "menu dish", "menu item", "dish");
    const ingredient = cellString(row, "Ingredient", "ingredient");
    const qty = cellNumber(row, "Qty", "qty", "quantity");
    if (!recipeName || !menuDish || !ingredient || qty <= 0) continue;

    parsed.push({
      recipeName,
      menuDish,
      version: cellString(row, "Version", "version") || "v1.0",
      portionSize: cellString(row, "Portion Size", "portion size", "portion") || "1 portion",
      active: yesNo(cellString(row, "Active", "active"), true),
      ingredient,
      qty: Math.round(qty),
      unit: cellString(row, "Unit", "unit") || "g",
    });
  }

  return parsed;
}

function findMenuItem(menuItems: MenuItem[], name: string): MenuItem | undefined {
  const key = normalizeName(name);
  return menuItems.find((item) => normalizeName(item.name) === key);
}

function findIngredient(ingredients: Ingredient[], name: string): Ingredient | undefined {
  const key = normalizeName(name);
  return ingredients.find((item) => normalizeName(item.name) === key);
}

function findRecipe(recipes: Recipe[], recipeName: string, menuItemId: string): Recipe | undefined {
  const nameKey = normalizeName(recipeName);
  return recipes.find(
    (recipe) => normalizeName(recipe.name) === nameKey && recipe.menuItemId === menuItemId,
  );
}

function groupRecipeImportRows(rows: RecipeImportRow[]): Map<string, RecipeImportRow[]> {
  const grouped = new Map<string, RecipeImportRow[]>();
  for (const row of rows) {
    const key = `${normalizeName(row.recipeName)}::${normalizeName(row.menuDish)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }
  return grouped;
}

export type RecipeImportDeps = {
  branchCode: string;
  recipes: Recipe[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  createRecipe: (input: {
    name: string;
    menuItemId: string;
    version: string;
    portionSize: string;
    active: boolean;
    lines: { ingredientId: string; qty: number; unit: string }[];
  }) => Promise<Recipe>;
  updateRecipe: (
    recipeId: string,
    input: {
      name: string;
      menuItemId: string;
      version: string;
      portionSize: string;
      active: boolean;
      lines: { ingredientId: string; qty: number; unit: string }[];
    },
  ) => Promise<Recipe>;
};

export async function importRecipeRows(
  rows: RecipeImportRow[],
  deps: RecipeImportDeps,
): Promise<RecipeImportSummary> {
  const summary: RecipeImportSummary = {
    recipesCreated: 0,
    recipesUpdated: 0,
    skipped: 0,
  };

  if (rows.length === 0) return summary;

  const recipes = [...deps.recipes];
  const grouped = groupRecipeImportRows(rows);

  for (const [, recipeRows] of grouped) {
    const first = recipeRows[0];
    if (!first) continue;

    const menuItem = findMenuItem(deps.menuItems, first.menuDish);
    if (!menuItem) {
      summary.skipped += 1;
      continue;
    }

    const lines: { ingredientId: string; qty: number; unit: string }[] = [];
    for (const row of recipeRows) {
      const ingredient = findIngredient(deps.ingredients, row.ingredient);
      if (!ingredient) continue;
      lines.push({
        ingredientId: ingredient.id,
        qty: row.qty,
        unit: row.unit.trim() || ingredient.unit,
      });
    }

    if (lines.length === 0) {
      summary.skipped += 1;
      continue;
    }

    const payload = {
      name: first.recipeName.trim(),
      menuItemId: menuItem.id,
      version: first.version.trim() || "v1.0",
      portionSize: first.portionSize.trim() || "1 portion",
      active: first.active,
      lines,
    };

    const existing = findRecipe(recipes, first.recipeName, menuItem.id);
    if (existing) {
      await deps.updateRecipe(existing.id, payload);
      summary.recipesUpdated += 1;
    } else {
      const created = await deps.createRecipe(payload);
      recipes.push(created);
      summary.recipesCreated += 1;
    }
  }

  return summary;
}
