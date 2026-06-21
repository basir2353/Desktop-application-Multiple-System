import { branchFloorSchema, type BranchFloor } from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchBranchFloor(branchCode: string): Promise<BranchFloor> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/tables?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Tables failed: ${res.status}`);
  }
  return branchFloorSchema.parse(await res.json());
}
