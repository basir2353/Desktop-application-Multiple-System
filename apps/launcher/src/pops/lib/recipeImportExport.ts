import type { Ingredient, MenuItem, Recipe } from "@platform/contracts";
import {
  cellNumber,
  cellString,
  instructionsRows,
  isoDateStamp,
  moneyNumber,
  pickSheet,
  readWorkbook,
  sheetRows,
  writeWorkbookDownload,
  yesNo,
} from "../../lib/excelTransfer";

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
  skipReasons: string[];
};

const RECIPES_SHEET = "Recipes";
const RECIPE_LINES_SHEET = "Recipe Lines";
const INSTRUCTIONS_SHEET = "Instructions";

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

const RECIPE_TEMPLATE_INSTRUCTIONS = [
  "Fill the Recipe Lines sheet — one row per ingredient line for each recipe.",
  "Required: Recipe Name, Menu Dish (exact menu item name), Ingredient (exact ingredient name), Qty.",
  "Menu dishes and ingredients must already exist in the system before import.",
  "Optional: Version (default v1.0), Portion Size, Active (Yes/No), Unit (defaults to ingredient unit).",
  "The Recipes summary sheet is for reference/export only — import reads Recipe Lines.",
  "Re-importing the same Recipe Name + Menu Dish updates that recipe.",
  "Save as .xlsx (recommended) or .csv. Keep sheet name: Recipe Lines.",
  "Qty supports decimals (e.g. 0.5). Unknown dish/ingredient rows are skipped with a reason.",
];

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

  writeWorkbookDownload(
    [
      { name: INSTRUCTIONS_SHEET, rows: instructionsRows(RECIPE_TEMPLATE_INSTRUCTIONS) },
      {
        name: RECIPES_SHEET,
        rows:
          summaryRows.length > 0
            ? summaryRows
            : [
                {
                  "Recipe Name": "",
                  "Menu Dish": "",
                  Version: "",
                  "Portion Size": "",
                  Active: "",
                  "Total Cost": 0,
                  "Ingredient Count": 0,
                },
              ],
      },
      {
        name: RECIPE_LINES_SHEET,
        rows:
          recipeLineRows(recipes).length > 0
            ? recipeLineRows(recipes)
            : [
                {
                  "Recipe Name": "",
                  "Menu Dish": "",
                  Version: "",
                  "Portion Size": "",
                  Active: "",
                  Ingredient: "",
                  Qty: 0,
                  Unit: "g",
                },
              ],
      },
    ],
    `recipes-${branchCode}-${isoDateStamp()}.xlsx`,
  );
}

export function downloadRecipeImportTemplateExcel(branchCode?: string): void {
  const code = branchCode ? `-${branchCode}` : "";
  writeWorkbookDownload(
    [
      { name: INSTRUCTIONS_SHEET, rows: instructionsRows(RECIPE_TEMPLATE_INSTRUCTIONS) },
      {
        name: RECIPES_SHEET,
        rows: [
          {
            "Recipe Name": "Chicken Karahi",
            "Menu Dish": "Chicken Karahi",
            Version: "v1.0",
            "Portion Size": "1 portion",
            Active: "Yes",
            "Total Cost": 0,
            "Ingredient Count": 2,
          },
        ],
      },
      {
        name: RECIPE_LINES_SHEET,
        rows: [
          {
            "Recipe Name": "Chicken Karahi",
            "Menu Dish": "Chicken Karahi",
            Version: "v1.0",
            "Portion Size": "1 portion",
            Active: "Yes",
            Ingredient: "Chicken",
            Qty: 500,
            Unit: "g",
          },
          {
            "Recipe Name": "Chicken Karahi",
            "Menu Dish": "Chicken Karahi",
            Version: "v1.0",
            "Portion Size": "1 portion",
            Active: "Yes",
            Ingredient: "Tomato",
            Qty: 200,
            Unit: "g",
          },
        ],
      },
    ],
    `recipes-import-template${code}-${isoDateStamp()}.xlsx`,
  );
}

export function parseRecipeImportFile(
  buffer: ArrayBuffer,
  filename: string,
): { rows: RecipeImportRow[]; skipped: number; skipReasons: string[] } {
  const wb = readWorkbook(buffer, filename);
  const sheet = pickSheet(wb, [RECIPE_LINES_SHEET], ["recipe", "line"]);
  if (!sheet) {
    return { rows: [], skipped: 0, skipReasons: ["Recipe Lines sheet not found"] };
  }

  const rawRows = sheetRows(sheet);
  const parsed: RecipeImportRow[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]!;
    const recipeName = cellString(row, "Recipe Name", "recipe name", "name");
    const menuDish = cellString(row, "Menu Dish", "menu dish", "menu item", "dish");
    const ingredient = cellString(row, "Ingredient", "ingredient");
    const qty = moneyNumber(cellNumber(row, "Qty", "qty", "quantity"));
    const line = i + 2;

    if (!recipeName && !menuDish && !ingredient && qty <= 0) continue;
    if (!recipeName || !menuDish || !ingredient || qty <= 0) {
      skipped += 1;
      if (skipReasons.length < 8) {
        skipReasons.push(
          `Row ${line}: Recipe Name, Menu Dish, Ingredient, and Qty > 0 are required`,
        );
      }
      continue;
    }

    parsed.push({
      recipeName,
      menuDish,
      version: cellString(row, "Version", "version") || "v1.0",
      portionSize: cellString(row, "Portion Size", "portion size", "portion") || "1 portion",
      active: yesNo(cellString(row, "Active", "active"), true),
      ingredient,
      qty,
      unit: cellString(row, "Unit", "unit") || "g",
    });
  }

  return { rows: parsed, skipped, skipReasons };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
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
    skipReasons: [],
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
      if (summary.skipReasons.length < 8) {
        summary.skipReasons.push(`Menu dish not found: "${first.menuDish}"`);
      }
      continue;
    }

    const lines: { ingredientId: string; qty: number; unit: string }[] = [];
    const missingIngredients: string[] = [];
    for (const row of recipeRows) {
      const ingredient = findIngredient(deps.ingredients, row.ingredient);
      if (!ingredient) {
        missingIngredients.push(row.ingredient);
        continue;
      }
      lines.push({
        ingredientId: ingredient.id,
        qty: moneyNumber(row.qty),
        unit: row.unit.trim() || ingredient.unit,
      });
    }

    if (lines.length === 0) {
      summary.skipped += 1;
      if (summary.skipReasons.length < 8) {
        summary.skipReasons.push(
          `Recipe "${first.recipeName}": no matching ingredients` +
            (missingIngredients.length ? ` (${missingIngredients.slice(0, 3).join(", ")})` : ""),
        );
      }
      continue;
    }

    if (missingIngredients.length > 0 && summary.skipReasons.length < 8) {
      summary.skipReasons.push(
        `Recipe "${first.recipeName}": skipped unknown ingredients: ${missingIngredients
          .slice(0, 3)
          .join(", ")}`,
      );
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
