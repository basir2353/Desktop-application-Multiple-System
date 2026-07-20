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
      options[key] = rest[key] as boolean;
      delete rest[key];
    }
  }
  return { options, rest: rest as Omit<T, OptionKey> };
}

function rememberApiSupportFromItems(items: MenuItem[]): void {
  if (items.length === 0) return;
  apiSupportsItemOptions = items.some((item) => menuApiSupportsItemOptions(item));
}

function withLocalOptions(menu: BranchMenu): BranchMenu {
  rememberApiSupportFromItems(menu.items);
  return {
    ...menu,
    items: applyMenuItemOptions(menu.branchCode, menu.items),
  };
}

function mergeOptionsIntoItem(item: MenuItem, options: Partial<MenuItemOptions>): MenuItem {
  if (Object.keys(options).length === 0) return item;
  return {
    ...item,
    ...normalizeMenuItemOptions({ ...item, ...options }),
  };
}

export async function fetchBranchMenu(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Menu failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return withLocalOptions(branchMenuSchema.parse(json));
}

export async function fetchBranchMenuAdmin(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu/admin?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Menu admin failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return withLocalOptions(branchMenuSchema.parse(json));
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

export async function createMenuItem(input: CreateMenuItem): Promise<MenuItem> {
  const { options, rest } = splitItemOptions(input);
  let item: MenuItem;

  if (apiSupportsItemOptions === false || Object.keys(options).length === 0) {
    item = await postMenuItem(rest);
  } else {
    try {
      item = await postMenuItem({ ...rest, ...options });
      apiSupportsItemOptions = true;
    } catch {
      apiSupportsItemOptions = false;
      item = await postMenuItem(rest);
    }
  }

  if (Object.keys(options).length > 0) {
    saveMenuItemOptions(input.branchCode, item.id, options);
  }
  return mergeOptionsIntoItem(item, options);
}

export async function updateMenuItem(
  itemId: string,
  input: UpdateMenuItem,
  branchCode?: string,
): Promise<MenuItem> {
  const { options, rest } = splitItemOptions(input);
  let item: MenuItem;

  if (apiSupportsItemOptions === false || Object.keys(options).length === 0) {
    item = await patchMenuItem(itemId, rest);
  } else {
    try {
      item = await patchMenuItem(itemId, { ...rest, ...options });
      apiSupportsItemOptions = true;
    } catch {
      apiSupportsItemOptions = false;
      item = await patchMenuItem(itemId, rest);
    }
  }

  if (branchCode && Object.keys(options).length > 0) {
    saveMenuItemOptions(branchCode, itemId, options);
  }
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
