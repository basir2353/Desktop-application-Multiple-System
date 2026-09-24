export type StockLeftPart = {
  id: string;
  label: string;
  value: number;
};

type StockIngredient = {
  unitCost: number;
  currentStock: number;
  onHandStock?: number;
  storeStock?: number;
  kitchenSections?: { cookingUnitId: string | null; name: string; quantity: number }[];
};

/** On-hand value, plus where that leftover sits: store (back) and each cooking unit. */
export function summarizeIngredientStock(ingredients: StockIngredient[]): {
  total: number;
  parts: StockLeftPart[];
} {
  let total = 0;
  let store = 0;
  const sections = new Map<string, StockLeftPart>();
  for (const ingredient of ingredients) {
    const qty = ingredient.onHandStock ?? ingredient.currentStock;
    const cost = Number(ingredient.unitCost) || 0;
    total += qty * cost;
    store += (ingredient.storeStock ?? 0) * cost;
    for (const section of ingredient.kitchenSections ?? []) {
      if (!(section.quantity > 0)) continue;
      const id = section.cookingUnitId ?? `name:${section.name}`;
      const prev = sections.get(id) ?? { id, label: section.name, value: 0 };
      prev.value += section.quantity * cost;
      sections.set(id, prev);
    }
  }
  const parts: StockLeftPart[] = [{ id: "store", label: "Store (back)", value: store }];
  for (const part of [...sections.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    parts.push(part);
  }
  return { total, parts };
}
