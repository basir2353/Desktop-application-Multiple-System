import { describe, expect, it } from "vitest";
import { summarizeIngredientStock } from "../stockLeftTotal";

describe("summarizeIngredientStock", () => {
  it("sums leftover value and splits store from cooking units", () => {
    const summary = summarizeIngredientStock([
      {
        unitCost: 100,
        currentStock: 0,
        onHandStock: 10,
        storeStock: 4,
        kitchenSections: [
          { cookingUnitId: "continental", name: "Continental", quantity: 6 },
        ],
      },
      {
        unitCost: 50,
        currentStock: 2,
        onHandStock: 2,
        storeStock: 0,
        kitchenSections: [
          { cookingUnitId: "continental", name: "Continental", quantity: 1 },
          { cookingUnitId: null, name: "Unassigned", quantity: 1 },
        ],
      },
    ]);

    expect(summary.total).toBe(10 * 100 + 2 * 50);
    expect(summary.parts).toEqual([
      { id: "store", label: "Store (back)", value: 400 },
      { id: "continental", label: "Continental", value: 650 },
      { id: "name:Unassigned", label: "Unassigned", value: 50 },
    ]);
  });
});
