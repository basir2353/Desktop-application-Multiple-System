import {
  formatMenuItemLabel,
  parseRecipePortionConfig,
  pickRecipeForSale,
  recipePortionFactorForLabel,
  type MenuItem,
  type MenuItemVariant,
  type Recipe,
} from "@platform/contracts";
import { fetchBranchInventoryForPos } from "../api/inventory";
import { cartLinePrintLabel, type PosCartLine } from "./posCart";

export type PosInventorySnapshot = {
  recipes?: Recipe[];
  ingredients?: { id: string; name: string; unit: string; currentStock: number }[];
};

function activeRecipes(recipes: Recipe[] | undefined): Recipe[] {
  return (recipes ?? []).filter((recipe) => recipe.active !== false);
}

/** Sync check used when tapping a dish on POS (before pay). */
export function recipeWarningForMenuAdd(
  recipes: Recipe[] | undefined,
  item: Pick<MenuItem, "id" | "name" | "portion" | "simplePrice">,
  variant: MenuItemVariant | null,
  opts?: { inventoryReady?: boolean; inventoryFailed?: boolean },
): string | null {
  const label = formatMenuItemLabel({
    name: item.name,
    portion: item.portion,
    variantLabel: variant?.label ?? null,
    simplePrice: item.simplePrice,
  });
  if (opts?.inventoryFailed) {
    return `Inventory could not load — cannot verify recipe for "${label}". Check internet / open Inventory, then try again.`;
  }
  // Still loading: don't block the tap.
  if (!opts?.inventoryReady) return null;

  const pool = activeRecipes(recipes);
  const recipe = pickRecipeForSale(pool, {
    menuItemId: item.id,
    itemName: item.name,
    lineLabel: label,
  });
  if (!recipe) {
    return `No recipe for "${label}". Create it in Recipe Management before selling if you want stock to deduct.`;
  }
  if (!recipe.ingredients?.length) {
    return `Recipe for "${label}" has no ingredients. Add ingredients in Recipe Management.`;
  }
  return null;
}

/**
 * Pre-pay checks: missing recipes / low ingredient stock.
 * Sale is never blocked — only warnings for confirm UI.
 * Load failures return [] so a paid sale is not followed by a confusing banner.
 */
export async function buildPosInventorySaleWarnings(
  branchCode: string,
  cart: PosCartLine[],
  preloaded?: PosInventorySnapshot | null,
): Promise<string[]> {
  if (!branchCode || cart.length === 0) return [];

  let recipes: Recipe[] = [];
  let ingredients: { id: string; name: string; unit: string; currentStock: number }[] = [];
  try {
    if (preloaded && ((preloaded.recipes?.length ?? 0) > 0 || (preloaded.ingredients?.length ?? 0) > 0)) {
      recipes = activeRecipes(preloaded.recipes);
      ingredients = preloaded.ingredients ?? [];
    } else {
      const inventory = await fetchBranchInventoryForPos(branchCode);
      recipes = activeRecipes(inventory.recipes);
      ingredients = inventory.ingredients ?? [];
    }
  } catch {
    // Don't scare cashiers after a successful pay — add-time check covers recipe gaps.
    return [];
  }

  if (recipes.length === 0) return [];

  const ingredientById = new Map(ingredients.map((ing) => [ing.id, ing]));
  const needByIngredient = new Map<string, number>();
  const warnings: string[] = [];

  for (const line of cart) {
    const label = cartLinePrintLabel(line);
    const recipe = pickRecipeForSale(recipes, {
      menuItemId: line.item.id,
      itemName: line.item.name,
      lineLabel: label,
    });
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
      const need = Math.round(Number(recipeLine.qty) * line.qty * factor * 1000) / 1000;
      if (!(need > 0)) continue;
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
