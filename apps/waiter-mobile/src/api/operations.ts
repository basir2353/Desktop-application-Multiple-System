import { popsBranchSchema, type PopsBranch } from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchPopsBranches(): Promise<PopsBranch[]> {
  const res = await authFetch("/v1/operations/branches");
  if (!res.ok) throw new Error(`Branches failed: ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid branches response");
  return json.map((row) => popsBranchSchema.parse(row));
}
