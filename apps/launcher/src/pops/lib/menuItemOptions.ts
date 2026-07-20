import type { MenuItem } from "@platform/contracts";

export type MenuItemOptions = {
  discountable: boolean;
  nonDiscountable: boolean;
  nonTaxable: boolean;
  askForPrice: boolean;
  askForQty: boolean;
  allowManualDiscount: boolean;
};

const STORAGE_PREFIX = "pops.menuItemOptions.v1.";

export function defaultMenuItemOptions(): MenuItemOptions {
  return {
    discountable: true,
    nonDiscountable: false,
    nonTaxable: false,
    askForPrice: false,
    askForQty: false,
    allowManualDiscount: false,
  };
}

export function normalizeMenuItemOptions(input: Partial<MenuItemOptions> | null | undefined): MenuItemOptions {
  const base = defaultMenuItemOptions();
  if (!input) return base;
  const discountable = input.discountable ?? base.discountable;
  const nonDiscountable = input.nonDiscountable ?? base.nonDiscountable;
  return {
    discountable: discountable && !nonDiscountable,
    nonDiscountable: nonDiscountable || !discountable,
    nonTaxable: Boolean(input.nonTaxable),
    askForPrice: Boolean(input.askForPrice),
    askForQty: Boolean(input.askForQty),
    allowManualDiscount: Boolean(input.allowManualDiscount),
  };
}

function storageKey(branchCode: string): string {
  return `${STORAGE_PREFIX}${branchCode.trim().toUpperCase()}`;
}

export function loadMenuItemOptionsMap(branchCode: string | undefined | null): Record<string, MenuItemOptions> {
  if (!branchCode || typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<MenuItemOptions>>;
    const out: Record<string, MenuItemOptions> = {};
    for (const [id, value] of Object.entries(parsed ?? {})) {
      out[id] = normalizeMenuItemOptions(value);
    }
    return out;
  } catch {
    return {};
  }
}

export function saveMenuItemOptions(
  branchCode: string | undefined | null,
  itemId: string,
  options: Partial<MenuItemOptions>,
): void {
  if (!branchCode || !itemId || typeof localStorage === "undefined") return;
  const map = loadMenuItemOptionsMap(branchCode);
  map[itemId] = normalizeMenuItemOptions(options);
  localStorage.setItem(storageKey(branchCode), JSON.stringify(map));
}

/** True when the API payload already includes persisted option columns. */
export function menuApiSupportsItemOptions(item: Partial<MenuItem> | null | undefined): boolean {
  if (!item) return false;
  return (
    typeof item.discountable === "boolean" ||
    typeof item.nonDiscountable === "boolean" ||
    typeof item.nonTaxable === "boolean" ||
    typeof item.askForPrice === "boolean" ||
    typeof item.askForQty === "boolean" ||
    typeof item.allowManualDiscount === "boolean"
  );
}

/**
 * Merge server menu items with local option overrides.
 * Local wins when API does not yet persist these columns (common on older Railway deploys).
 */
export function applyMenuItemOptions(
  branchCode: string | undefined | null,
  items: MenuItem[],
): MenuItem[] {
  const local = loadMenuItemOptionsMap(branchCode);
  return items.map((item) => {
    const overlay = local[item.id];
    const apiHas = menuApiSupportsItemOptions(item);
    if (!overlay && apiHas) {
      return {
        ...item,
        ...normalizeMenuItemOptions(item),
      };
    }
    if (!overlay) {
      return {
        ...item,
        ...defaultMenuItemOptions(),
      };
    }
    // Prefer local overlay so desktop options keep working even if API strips/ignores them.
    return {
      ...item,
      ...overlay,
    };
  });
}

export function optionsFromForm(form: MenuItemOptions): MenuItemOptions {
  return normalizeMenuItemOptions(form);
}
