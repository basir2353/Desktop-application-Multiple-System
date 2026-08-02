import {
  branchInventorySchema,
  createSupplierSchema,
  supplierSchema,
  type BranchInventory,
  type CreateSupplier,
  type Supplier,
} from "@platform/contracts";
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

export async function createSupplier(input: CreateSupplier): Promise<Supplier> {
  const body = createSupplierSchema.parse(input);
  const res = await authFetch("/v1/inventory/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create supplier failed: ${res.status}`);
  }
  return supplierSchema.parse(await res.json());
}
