import type { PopsBranch } from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

function parseBranchRow(row: unknown): PopsBranch {
  if (!row || typeof row !== "object") throw new Error("Invalid branch row from server");
  const record = row as Record<string, unknown>;
  const id = record.id;
  const code = record.code;
  const name = record.name;
  const city = record.city;
  if (typeof id !== "string" || typeof code !== "string" || typeof name !== "string" || typeof city !== "string") {
    throw new Error("Invalid branch data from server");
  }
  return { id, code, name, city };
}

export async function fetchPopsBranches(): Promise<PopsBranch[]> {
  const res = await authFetch("/v1/operations/branches");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Branches failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid branches response");
  return json.map(parseBranchRow);
}
