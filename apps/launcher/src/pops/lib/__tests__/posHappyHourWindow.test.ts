import { describe, expect, it } from "vitest";
import { applyHappyHourBonus, isHourInWindow } from "../posHappyHour";
import type { HappyHourSettings } from "../happyHourSettings";
import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { buildCartLine } from "../posCart";

describe("isHourInWindow", () => {
  it("does not treat start===end as 24h active (avoids ghost gift items)", () => {
    expect(isHourInWindow(12, 0, 0)).toBe(false);
    expect(isHourInWindow(0, 17, 17)).toBe(false);
  });

  it("handles normal and overnight windows", () => {
    expect(isHourInWindow(18, 17, 19)).toBe(true);
    expect(isHourInWindow(16, 17, 19)).toBe(false);
    expect(isHourInWindow(23, 22, 2)).toBe(true);
    expect(isHourInWindow(1, 22, 2)).toBe(true);
    expect(isHourInWindow(10, 22, 2)).toBe(false);
  });
});

describe("applyHappyHourBonus", () => {
  const variantA = { id: "va", label: "Full", price: 100, isActive: true } as MenuItemVariant;
  const variantB = { id: "vb", label: "Reg", price: 50, isActive: true } as MenuItemVariant;
  const itemA = {
    id: "a",
    name: "Mutton Handi",
    price: 100,
    isActive: true,
    portion: null,
    simplePrice: false,
    allowManualDiscount: false,
    nonTaxable: false,
    variants: [variantA],
  } as unknown as MenuItem;
  const itemB = {
    id: "b",
    name: "Raita",
    price: 50,
    isActive: true,
    portion: null,
    simplePrice: false,
    allowManualDiscount: false,
    nonTaxable: false,
    variants: [variantB],
  } as unknown as MenuItem;

  it("does not inject gift when happy hour disabled", () => {
    const settings: HappyHourSettings = {
      enabled: false,
      slots: [
        {
          id: "s1",
          startHour: 0,
          endHour: 23,
          percentOff: 0,
          bonusMenuItemId: "b",
          bonusVariantId: "vb",
        },
      ],
    };
    const cart = [buildCartLine(itemA, variantA, 1)];
    const next = applyHappyHourBonus(cart, [itemA, itemB], settings, new Date(2026, 0, 1, 12));
    expect(next).toHaveLength(1);
    expect(next[0]?.item.id).toBe("a");
  });

  it("does not inject gift that matches the paid line just added", () => {
    const settings: HappyHourSettings = {
      enabled: true,
      slots: [
        {
          id: "s1",
          startHour: 0,
          endHour: 23,
          percentOff: 0,
          bonusMenuItemId: "a",
          bonusVariantId: "va",
        },
      ],
    };
    const cart = [buildCartLine(itemA, variantA, 1)];
    const next = applyHappyHourBonus(cart, [itemA, itemB], settings, new Date(2026, 0, 1, 12));
    expect(next).toHaveLength(1);
  });
});
