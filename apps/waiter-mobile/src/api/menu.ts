import {
  branchMenuSchema,
  createMenuCategorySchema,
  createMenuItemSchema,
  menuCategorySchema,
  menuItemSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema,
  type BranchMenu,
  type CreateMenuCategory,
  type CreateMenuItem,
  type MenuCategory,
  type MenuItem,
  type UpdateMenuCategory,
  type UpdateMenuItem,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

async function parseErr(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const msg = err?.message;
  throw new Error(Array.isArray(msg) ? msg.join(", ") : msg ?? fallback);
}

export async function fetchBranchMenu(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu?${params}`);
  if (!res.ok) await parseErr(res, `Menu failed: ${res.status}`);
  const json: unknown = await res.json();
  return branchMenuSchema.parse(json);
}

export async function createMenuCategory(input: CreateMenuCategory): Promise<MenuCategory> {
  const body = createMenuCategorySchema.parse(input);
  const res = await authFetch("/v1/menu/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseErr(res, `Create category failed: ${res.status}`);
  return menuCategorySchema.parse(await res.json());
}

export async function updateMenuCategory(
  categoryId: string,
  patch: UpdateMenuCategory,
): Promise<MenuCategory> {
  const body = updateMenuCategorySchema.parse(patch);
  const res = await authFetch(`/v1/menu/categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseErr(res, `Update category failed: ${res.status}`);
  return menuCategorySchema.parse(await res.json());
}

export async function deleteMenuCategory(categoryId: string): Promise<void> {
  const res = await authFetch(`/v1/menu/categories/${categoryId}`, { method: "DELETE" });
  if (!res.ok) await parseErr(res, `Delete category failed: ${res.status}`);
}

export async function createMenuItem(input: CreateMenuItem): Promise<MenuItem> {
  const body = createMenuItemSchema.parse(input);
  const res = await authFetch("/v1/menu/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseErr(res, `Create item failed: ${res.status}`);
  return menuItemSchema.parse(await res.json());
}

export async function updateMenuItem(itemId: string, patch: UpdateMenuItem): Promise<MenuItem> {
  const body = updateMenuItemSchema.parse(patch);
  const res = await authFetch(`/v1/menu/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseErr(res, `Update menu item failed: ${res.status}`);
  return menuItemSchema.parse(await res.json());
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  const res = await authFetch(`/v1/menu/items/${itemId}`, { method: "DELETE" });
  if (!res.ok) await parseErr(res, `Delete item failed: ${res.status}`);
}
