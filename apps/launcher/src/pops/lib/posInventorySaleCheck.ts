import {
  parseRecipePortionConfig,
  recipePortionFactorForLabel,
  type Recipe,
} from "@platform/contracts";
import { fetchBranchInventory } from "../api/inventory";
import { cartLinePrintLabel, type PosCartLine } from "./posCart";

/**
 * Pre-pay checks: missing recipes / low ingredient stock.
 * Sale is never blocked by callers — only warnings for confirm UI.
 */
export async function buildPosInventorySaleWarnings(
  branchCode: string,
  cart: PosCartLine[],
): Promise<string[]> {
  if (!branchCode || cart.length === 0) return [];

  let recipes: Recipe[] = [];
  let ingredients: { id: string; name: string; unit: string; currentStock: number }[] = [];
  try {
    const inventory = await fetchBranchInventory(branchCode);
    recipes = (inventory.recipes ?? []).filter((recipe) => recipe.active !== false);
    ingredients = inventory.ingredients ?? [];
  } catch {
    return ["Could not load inventory for recipe/stock check. Sale can still continue."];
  }

  const recipeByMenuItem = new Map<string, Recipe>();
  for (const recipe of recipes) {
    if (recipe.menuItemId && !recipeByMenuItem.has(recipe.menuItemId)) {
      recipeByMenuItem.set(recipe.menuItemId, recipe);
    }
  }
  const ingredientById = new Map(ingredients.map((ing) => [ing.id, ing]));
  const needByIngredient = new Map<string, number>();
  const warnings: string[] = [];

  for (const line of cart) {
    const label = cartLinePrintLabel(line);
    const recipe = recipeByMenuItem.get(line.item.id);
    if (!recipe) {
      warnings.push(`No recipe linked for "${label}". Create a recipe so inventory can deduct.`);
      continue;
    }
    if (!recipe.ingredients?.length) {
      warnings.push(`Recipe for "${label}" has no ingredients.`);
      continue;
    }

    const portion = parseRecipePortionConfig(recipe.portionSize);
    const factors =
      recipe.portionFactors && Object.keys(recipe.portionFactors).length > 0
        ? { ...portion.factors, ...recipe.portionFactors }
        : portion.factors;
    const factor = recipePortionFactorForLabel(label, factors, portion.base);

    for (const recipeLine of recipe.ingredients) {
      const need = Math.max(1, Math.round(Number(recipeLine.qty) * line.qty * factor));
      needByIngredient.set(
        recipeLine.ingredientId,
        (needByIngredient.get(recipeLine.ingredientId) ?? 0) + need,
      );
    }
  }

  for (const [ingredientId, need] of needByIngredient) {
    const ing = ingredientById.get(ingredientId);
    if (!ing) {
      warnings.push(`Recipe ingredient missing from inventory (id ${ingredientId.slice(0, 8)}…).`);
      continue;
    }
    if (ing.currentStock < need) {
      warnings.push(
        `Low stock for ${ing.name}: need ${need} ${ing.unit}, have ${ing.currentStock}. Transfer to Kitchen / receive stock.`,
      );
    }
  }

  return [...new Set(warnings)];
}
