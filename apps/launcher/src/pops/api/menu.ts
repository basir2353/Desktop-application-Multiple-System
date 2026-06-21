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

export async function fetchBranchMenu(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Menu failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return branchMenuSchema.parse(json);
}

export async function fetchBranchMenuAdmin(branchCode: string): Promise<BranchMenu> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/menu/admin?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Menu admin failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return branchMenuSchema.parse(json);
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

export async function createMenuItem(input: CreateMenuItem): Promise<MenuItem> {
  const res = await authFetch("/v1/menu/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create item failed: ${res.status}`);
  return menuItemSchema.parse(await res.json());
}

export async function updateMenuItem(itemId: string, input: UpdateMenuItem): Promise<MenuItem> {
  const res = await authFetch(`/v1/menu/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Update item failed: ${res.status}`);
  return menuItemSchema.parse(await res.json());
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
