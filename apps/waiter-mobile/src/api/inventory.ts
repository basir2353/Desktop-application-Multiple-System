import { branchInventorySchema, type BranchInventory } from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchBranchInventory(branchCode: string): Promise<BranchInventory> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/inventory?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Inventory failed: ${res.status}`);
  }
  return branchInventorySchema.parse(await res.json());
}
