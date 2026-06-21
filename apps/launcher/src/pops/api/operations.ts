import {
  createPopsBranchSchema,
  dashboardResponseSchema,
  popsBranchSchema,
  type CreatePopsBranch,
  type DashboardResponse,
  type PopsBranch,
} from "@platform/contracts";
import { authFetch, SessionExpiredError } from "../../lib/authFetch";

export { SessionExpiredError };

export async function fetchPopsBranches(): Promise<PopsBranch[]> {
  const res = await authFetch("/v1/operations/branches");
  if (!res.ok) throw new Error(`Branches failed: ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid branches response");
  return json.map((row) => popsBranchSchema.parse(row));
}

export async function createPopsBranch(input: CreatePopsBranch): Promise<PopsBranch> {
  const body = createPopsBranchSchema.parse(input);
  const res = await authFetch("/v1/operations/branches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create branch failed: ${res.status}`);
  }
  return popsBranchSchema.parse(await res.json());
}

export async function fetchDashboard(branchCode: string): Promise<DashboardResponse> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/operations/dashboard?${params}`);
  if (!res.ok) throw new Error(`Dashboard failed: ${res.status}`);
  const json: unknown = await res.json();
  return dashboardResponseSchema.parse(json);
}
