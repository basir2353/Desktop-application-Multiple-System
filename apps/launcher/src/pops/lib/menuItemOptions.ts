import type { MenuItem } from "@platform/contracts";

export type MenuItemOptions = {
  discountable: boolean;
  nonDiscountable: boolean;
  nonTaxable: boolean;
  askForPrice: boolean;
  askForQty: boolean;
  allowManualDiscount: boolean;
  /** Urdu / secondary name for kitchen tickets and bills. */
  secondaryName: string;
  /** Default % when Item Manual Discount is enabled. */
  defaultDiscountPct: number;
};

const STORAGE_PREFIX = "pops.menuItemOptions.v1.";

function clampDiscountPct(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function defaultMenuItemOptions(): MenuItemOptions {
  return {
    discountable: true,
    nonDiscountable: false,
    nonTaxable: false,
    askForPrice: false,
    askForQty: false,
    allowManualDiscount: false,
    secondaryName: "",
    defaultDiscountPct: 0,
  };
}

export function normalizeMenuItemOptions(input: Partial<MenuItemOptions> | null | undefined): MenuItemOptions {
  const base = defaultMenuItemOptions();
  if (!input) return base;
  const discountable = input.discountable ?? base.discountable;
  const nonDiscountable = input.nonDiscountable ?? base.nonDiscountable;
  const nonTaxable = Boolean(input.nonTaxable);
  const allowManualDiscount =
    Boolean(input.allowManualDiscount) && discountable && !nonDiscountable && !nonTaxable;
  return {
    discountable: discountable && !nonDiscountable,
    nonDiscountable: nonDiscountable || !discountable,
    nonTaxable,
    askForPrice: Boolean(input.askForPrice),
    askForQty: Boolean(input.askForQty),
    allowManualDiscount,
    secondaryName: String(input.secondaryName ?? "").trim(),
    defaultDiscountPct: allowManualDiscount ? clampDiscountPct(input.defaultDiscountPct) : 0,
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
  map[itemId] = normalizeMenuItemOptions({ ...map[itemId], ...options });
  localStorage.setItem(storageKey(branchCode), JSON.stringify(map));
}

/**
 * True when the API response itself included POS flag columns (before zod defaults).
 * Pass the raw JSON item, not the parsed MenuItem.
 */
export function menuApiSupportsItemOptions(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;
  return (
    typeof raw.discountable === "boolean" ||
    typeof raw.nonDiscountable === "boolean" ||
    typeof raw.nonTaxable === "boolean" ||
    typeof raw.askForPrice === "boolean" ||
    typeof raw.askForQty === "boolean" ||
    typeof raw.allowManualDiscount === "boolean" ||
    typeof raw.secondaryName === "string" ||
    typeof raw.defaultDiscountPct === "number"
  );
}

function mergeItemWithOptions(item: MenuItem, overlay: MenuItemOptions | undefined): MenuItem {
  const fromApi = normalizeMenuItemOptions(item);
  if (!overlay) {
    return {
      ...item,
      ...fromApi,
      // Prefer API secondary name when present; otherwise keep parsed/default.
      secondaryName: item.secondaryName?.trim() || fromApi.secondaryName || null,
      defaultDiscountPct: item.defaultDiscountPct ?? fromApi.defaultDiscountPct,
    };
  }
  // Local overlay wins for desktop fields (Railway may not persist them yet).
  return {
    ...item,
    ...overlay,
    secondaryName: overlay.secondaryName || item.secondaryName?.trim() || null,
    defaultDiscountPct: overlay.allowManualDiscount
      ? overlay.defaultDiscountPct
      : (item.defaultDiscountPct ?? 0),
  };
}

/**
 * Merge server menu items with local option overrides.
 * Local wins for secondary name / default discount / flags when stored.
 */
export function applyMenuItemOptions(
  branchCode: string | undefined | null,
  items: MenuItem[],
): MenuItem[] {
  const local = loadMenuItemOptionsMap(branchCode);
  return items.map((item) => mergeItemWithOptions(item, local[item.id]));
}

export function optionsFromForm(form: MenuItemOptions): MenuItemOptions {
  return normalizeMenuItemOptions(form);
}
