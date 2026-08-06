import {
  createPopsBranchSchema,
  dashboardResponseSchema,
  orgDataResetResultSchema,
  orgDataResetSchema,
  popsBranchSchema,
  updatePopsBranchSchema,
  type CreatePopsBranch,
  type DashboardResponse,
  type DataResetScope,
  type OrgDataResetResult,
  type PopsBranch,
  type UpdatePopsBranch,
} from "@platform/contracts";
import { authFetch, SessionExpiredError, isSessionExpiredError } from "../../lib/authFetch";

export { SessionExpiredError, isSessionExpiredError };

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

export async function updatePopsBranch(
  branchId: string,
  input: UpdatePopsBranch,
): Promise<PopsBranch> {
  const body = updatePopsBranchSchema.parse(input);
  const res = await authFetch(`/v1/operations/branches/${branchId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update branch failed: ${res.status}`);
  }
  return popsBranchSchema.parse(await res.json());
}

export async function fetchBusinessProfile(): Promise<{ name: string }> {
  const res = await authFetch("/v1/operations/business-profile");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Business profile failed: ${res.status}`);
  }
  const json = (await res.json()) as { name?: unknown };
  if (typeof json?.name !== "string" || !json.name.trim()) {
    throw new Error("Invalid business profile response");
  }
  return { name: json.name };
}

export async function resetOrgData(
  scope: DataResetScope,
  confirmText: string,
): Promise<OrgDataResetResult> {
  const body = orgDataResetSchema.parse({ scope, confirmText });
  const res = await authFetch("/v1/operations/data-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(err?.message)
      ? err.message.join(", ")
      : (err?.message ?? `Data reset failed: ${res.status}`);
    throw new Error(message);
  }
  return orgDataResetResultSchema.parse(await res.json());
}

export async function fetchDashboard(branchCode: string): Promise<DashboardResponse> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/operations/dashboard?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    const message = err?.message ?? `Dashboard failed: ${res.status}`;
    // Hosted API may 500 when inventory tables are missing — degrade gracefully.
    if (res.status >= 500) {
      return dashboardResponseSchema.parse({
        branchCode,
        metrics: {
          liveSales: { amountPkr: 0, changePercent: 0 },
          activeOrders: { total: 0, dineIn: 0, takeaway: 0, delivery: 0 },
          kitchenQueue: { total: 0, priority: 0, slaStatus: "green" },
          lowStock: { skuCount: 0, criticalCount: 0 },
        },
        recentSales: [],
        alerts: [
          {
            id: "dashboard-degraded",
            text: "Dashboard metrics temporarily unavailable from server — sales below use live orders.",
            tone: "warning",
          },
        ],
      });
    }
    throw new Error(message);
  }
  const json: unknown = await res.json();
  return dashboardResponseSchema.parse(json);
}
