import { branchMenuSchema, type BranchMenu } from "@platform/contracts";
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
