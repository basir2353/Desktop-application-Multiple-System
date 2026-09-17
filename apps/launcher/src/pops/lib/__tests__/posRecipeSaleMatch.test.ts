import { describe, expect, it } from "vitest";
import { pickRecipeForSale } from "@platform/contracts";
import type { MenuItem as ApiMenuItem } from "@platform/contracts";
import { cartFromStoredLines, splitLineLabelNote } from "../posLoadOrder";
import { recipeWarningForMenuAdd } from "../posInventorySaleCheck";

const MENU_ID = "72be5305-1111-4000-8000-000000000001";
const HALF_VARIANT_ID = "72be5305-1111-4000-8000-000000000002";
const FULL_VARIANT_ID = "72be5305-1111-4000-8000-000000000003";

function handiItem(): ApiMenuItem {
  return {
    id: MENU_ID,
    categoryId: "00000000-0000-4000-8000-000000000010",
    name: "Mutton Handi",
    secondaryName: null,
    imageUrl: null,
    portion: null,
    price: 3200,
    barcode: null,
    happyHour: false,
    featured: false,
    isActive: true,
    sortOrder: 0,
    variants: [
      {
        id: HALF_VARIANT_ID,
        label: "Half",
        price: 1600,
        barcode: null,
        happyHour: false,
        isActive: true,
        sortOrder: 0,
      },
      {
        id: FULL_VARIANT_ID,
        label: "Full",
        price: 3200,
        barcode: null,
        happyHour: false,
        isActive: true,
        sortOrder: 1,
      },
    ],
    discountable: true,
    nonDiscountable: false,
    nonTaxable: false,
    askForPrice: false,
    askForQty: false,
    allowManualDiscount: false,
    defaultDiscountPct: 0,
    simplePrice: false,
  };
}

describe("pickRecipeForSale", () => {
  const recipe = {
    id: "recipe-1",
    name: "Mutton Handi (Half)",
    menuItemId: MENU_ID,
    menuItem: "Mutton Handi",
    portionSize: "Half",
    ingredients: [{ id: "line-1" }],
  };

  it("finds the recipe when POS line id does not match (orphan / old ticket)", () => {
    const found = pickRecipeForSale([recipe], {
      menuItemId: "orphan:0:Mutton Handi (Half)",
      itemName: "Mutton Handi",
      lineLabel: "Mutton Handi (Half)",
    });
    expect(found?.id).toBe("recipe-1");
  });

  it("still prefers the id-linked recipe when ids match", () => {
    const other = {
      ...recipe,
      id: "recipe-other",
      name: "Chicken Handi (Half)",
      menuItemId: "00000000-0000-4000-8000-000000000099",
      menuItem: "Chicken Handi",
    };
    const found = pickRecipeForSale([other, recipe], {
      menuItemId: MENU_ID,
      itemName: "Mutton Handi",
      lineLabel: "Mutton Handi (Half)",
    });
    expect(found?.id).toBe("recipe-1");
  });

  it("does not match a different dish", () => {
    const found = pickRecipeForSale([recipe], {
      menuItemId: "orphan:1:Chicken Karahi",
      itemName: "Chicken Karahi",
      lineLabel: "Chicken Karahi (Full)",
    });
    expect(found).toBeUndefined();
  });
});

describe("splitLineLabelNote / reload ticket", () => {
  it("keeps Half as portion instead of a kitchen note", () => {
    expect(splitLineLabelNote("Mutton Handi (Half)")).toEqual({
      baseLabel: "Mutton Handi (Half)",
    });
  });

  it("still splits real kitchen notes", () => {
    expect(splitLineLabelNote("Burger (بدون مرچ)")).toEqual({
      baseLabel: "Burger",
      lineNote: "بدون مرچ",
    });
  });

  it("reloads Mutton Handi (Half) onto the catalog item, not an orphan", () => {
    const cart = cartFromStoredLines([handiItem()], [
      { label: "Mutton Handi (Half)", qty: 1, unitPrice: 1600 },
    ]);
    expect(cart).toHaveLength(1);
    expect(cart[0]?.item.id).toBe(MENU_ID);
    expect(cart[0]?.variant?.label).toBe("Half");
    expect(cart[0]?.lineNote).toBeUndefined();
  });
});

describe("recipeWarningForMenuAdd (POS add-time)", () => {
  const recipe = {
    id: "recipe-1",
    name: "Mutton Handi (Half)",
    menuItemId: MENU_ID,
    menuItem: "Mutton Handi",
    portionSize: "Half",
    version: "1",
    ingredients: [{ id: "line-1", ingredientId: "ing-1", ingredient: "mutton", qty: 0.5, unit: "Kg" }],
    totalCost: 0,
    active: true,
  };

  it("warns when inventory failed to load", () => {
    const item = handiItem();
    const warn = recipeWarningForMenuAdd([], item, item.variants[0]!, {
      inventoryReady: false,
      inventoryFailed: true,
    });
    expect(warn).toMatch(/Inventory could not load/i);
  });

  it("warns when recipe is missing after inventory loaded", () => {
    const item = handiItem();
    const warn = recipeWarningForMenuAdd([], item, item.variants[0]!, { inventoryReady: true });
    expect(warn).toMatch(/No recipe/i);
  });

  it("is silent when recipe exists with ingredients", () => {
    const item = handiItem();
    const warn = recipeWarningForMenuAdd([recipe], item, item.variants[0]!, { inventoryReady: true });
    expect(warn).toBeNull();
  });
});
