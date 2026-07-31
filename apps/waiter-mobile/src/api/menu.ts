import {
  branchMenuSchema,
  menuItemSchema,
  updateMenuItemSchema,
  type BranchMenu,
  type MenuItem,
  type UpdateMenuItem,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

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

export async function updateMenuItem(itemId: string, patch: UpdateMenuItem): Promise<MenuItem> {
  const body = updateMenuItemSchema.parse(patch);
  const res = await authFetch(`/v1/menu/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update menu item failed: ${res.status}`);
  }
  return menuItemSchema.parse(await res.json());
}
