import {
  branchMenuSchema,
  menuCategorySchema,
  menuItemSchema,
  type BranchMenu,
  type CreateMenuCategory,
  type CreateMenuItem,
  type MenuCategory,
  type MenuItem,
  type UpdateMenuCategory,
  type UpdateMenuItem,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";
import {
  applyMenuItemOptions,
  menuApiSupportsItemOptions,
  normalizeMenuItemOptions,
  saveMenuItemOptions,
  type MenuItemOptions,
} from "../lib/menuItemOptions";

/** Cached capability: live Railway may not have option columns yet. */
let apiSupportsItemOptions: boolean | null = null;

const OPTION_KEYS = [
  "discountable",
  "nonDiscountable",
  "nonTaxable",
  "askForPrice",
  "askForQty",
  "allowManualDiscount",
  "secondaryName",
  "defaultDiscountPct",
] as const;

type OptionKey = (typeof OPTION_KEYS)[number];

function splitItemOptions<T extends Partial<MenuItemOptions>>(input: T): {
  options: Partial<MenuItemOptions>;
  rest: Omit<T, OptionKey>;
} {
  const options: Partial<MenuItemOptions> = {};
  const rest = { ...input } as T & Record<string, unknown>;
  for (const key of OPTION_KEYS) {
    if (rest[key] !== undefined) {
      (options as Record<string, unknown>)[key] = rest[key];
      delete rest[key];
    }
  }
  // Normalize secondary name for storage (null → "")
  if (options.secondaryName !== undefined) {
    options.secondaryName =
      options.secondaryName == null ? "" : String(options.secondaryName).trim();
  }
  return { options, rest: rest as Omit<T, OptionKey> };
}

function rememberApiSupportFromRawItems(items: unknown[]): void {
  if (items.length === 0) return;
  apiSupportsItemOptions = items.some(
    (row) =>
      row != null &&
      typeof row === "object" &&
      menuApiSupportsItemOptions(row as Record<string, unknown>),
  );
}

function withLocalOptions(menu: BranchMenu, rawItems: unknown[]): BranchMenu {
  rememberApiSupportFromRawItems(rawItems);
  return {
    ...menu,
    items: applyMenuItemOptions(menu.branchCode, menu.items),
  };
}

function mergeOptionsIntoItem(item: MenuItem, options: Partial<MenuItemOptions>): MenuItem {
  if (Object.keys(options).length === 0) return item;
  const normalized = normalizeMenuItemOptions({ ...item, ...options });
  return {
    ...item,
    ...normalized,
    secondaryName: normalized.secondaryName || null,
  };
}

function parseBranchMenu(json: unknown): BranchMenu {
  const parsed = branchMenuSchema.parse(json);
  const rawItems =
    json && typeof json === "object" && Array.isArray((json as { items?: unknown }).items)
      ? ((json as { items: unknown[] }).items ?? [])
      : [];
  return withLocalOptions(parsed, rawItems);
}

export async function fetchBranchMenu(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Menu failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseBranchMenu(json);
}

export async function fetchBranchMenuAdmin(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu/admin?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Menu admin failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseBranchMenu(json);
}

export async function createMenuCategory(input: CreateMenuCategory): Promise<MenuCategory> {
  const res = await authFetch("/v1/menu/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create category failed: ${res.status}`);
  return menuCategorySchema.parse(await res.json());
}

export async function updateMenuCategory(
  categoryId: string,
  input: UpdateMenuCategory,
): Promise<MenuCategory> {
  const res = await authFetch(`/v1/menu/categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Update category failed: ${res.status}`);
  return menuCategorySchema.parse(await res.json());
}

export async function deleteMenuCategory(categoryId: string): Promise<void> {
  const res = await authFetch(`/v1/menu/categories/${categoryId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete category failed: ${res.status}`);
}

async function postMenuItem(body: unknown): Promise<MenuItem> {
  const res = await authFetch("/v1/menu/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create item failed: ${res.status}`);
  return menuItemSchema.parse(await res.json());
}

async function patchMenuItem(itemId: string, body: unknown): Promise<MenuItem> {
  const res = await authFetch(`/v1/menu/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Update item failed: ${res.status}`);
  return menuItemSchema.parse(await res.json());
}

function flagPayload(options: Partial<MenuItemOptions>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (options.discountable !== undefined) payload.discountable = options.discountable;
  if (options.nonDiscountable !== undefined) payload.nonDiscountable = options.nonDiscountable;
  if (options.nonTaxable !== undefined) payload.nonTaxable = options.nonTaxable;
  if (options.askForPrice !== undefined) payload.askForPrice = options.askForPrice;
  if (options.askForQty !== undefined) payload.askForQty = options.askForQty;
  if (options.allowManualDiscount !== undefined) payload.allowManualDiscount = options.allowManualDiscount;
  return payload;
}

function extendedPayload(options: Partial<MenuItemOptions>): Record<string, unknown> {
  const payload = flagPayload(options);
  if (options.secondaryName !== undefined) payload.secondaryName = options.secondaryName || null;
  if (options.defaultDiscountPct !== undefined) payload.defaultDiscountPct = options.defaultDiscountPct;
  return payload;
}

function persistLocalOptions(
  branchCode: string | undefined,
  itemId: string,
  options: Partial<MenuItemOptions>,
): void {
  if (!branchCode || Object.keys(options).length === 0) return;
  saveMenuItemOptions(branchCode, itemId, options);
}

async function createWithFallback(
  rest: Omit<CreateMenuItem, OptionKey>,
  options: Partial<MenuItemOptions>,
): Promise<MenuItem> {
  const full = extendedPayload(options);
  const flagsOnly = flagPayload(options);

  if (apiSupportsItemOptions === false || Object.keys(full).length === 0) {
    return postMenuItem(rest);
  }

  try {
    const item = await postMenuItem({ ...rest, ...full });
    apiSupportsItemOptions = true;
    return item;
  } catch {
    // API may have flags but not secondary_name / default_discount_pct yet.
    try {
      const item = await postMenuItem({ ...rest, ...flagsOnly });
      apiSupportsItemOptions = true;
      return item;
    } catch {
      apiSupportsItemOptions = false;
      return postMenuItem(rest);
    }
  }
}

async function updateWithFallback(
  itemId: string,
  rest: Omit<UpdateMenuItem, OptionKey>,
  options: Partial<MenuItemOptions>,
): Promise<MenuItem> {
  const full = extendedPayload(options);
  const flagsOnly = flagPayload(options);

  if (apiSupportsItemOptions === false || Object.keys(full).length === 0) {
    return patchMenuItem(itemId, rest);
  }

  try {
    const item = await patchMenuItem(itemId, { ...rest, ...full });
    apiSupportsItemOptions = true;
    return item;
  } catch {
    try {
      const item = await patchMenuItem(itemId, { ...rest, ...flagsOnly });
      apiSupportsItemOptions = true;
      return item;
    } catch {
      apiSupportsItemOptions = false;
      return patchMenuItem(itemId, rest);
    }
  }
}

export async function createMenuItem(input: CreateMenuItem): Promise<MenuItem> {
  const { options, rest } = splitItemOptions(input);
  const item = await createWithFallback(rest, options);
  persistLocalOptions(input.branchCode, item.id, options);
  return mergeOptionsIntoItem(item, options);
}

export async function updateMenuItem(
  itemId: string,
  input: UpdateMenuItem,
  branchCode?: string,
): Promise<MenuItem> {
  const { options, rest } = splitItemOptions(input);
  // Save locally first so secondary name is never lost if API rejects the field.
  persistLocalOptions(branchCode, itemId, options);
  const item = await updateWithFallback(itemId, rest, options);
  persistLocalOptions(branchCode, itemId, options);
  return mergeOptionsIntoItem(item, options);
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  const res = await authFetch(`/v1/menu/items/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete item failed: ${res.status}`);
}

export async function uploadMenuImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await authFetch("/v1/menu/upload-image", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = err?.message;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg ?? `Upload failed: ${res.status}`);
  }
  const json = (await res.json()) as { imageUrl?: string };
  if (!json.imageUrl) throw new Error("Upload failed: no image URL returned");
  return json.imageUrl;
}
