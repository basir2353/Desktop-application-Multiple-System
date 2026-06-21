import { securityOverviewSchema, type SecurityOverview } from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new Error(err?.message ?? `${fallback}: ${res.status}`);
}

export async function fetchSecurityOverview(branchCode?: string): Promise<SecurityOverview> {
  const params = new URLSearchParams();
  if (branchCode) params.set("branchCode", branchCode);
  const qs = params.toString();
  const res = await authFetch(`/v1/security/overview${qs ? `?${qs}` : ""}`);
  if (!res.ok) await parseError(res, "Security overview failed");
  return securityOverviewSchema.parse(await res.json());
}

export function exportAuditCsv(entries: SecurityOverview["auditTrail"], filename: string): void {
  const header = ["When", "User", "Action", "Detail", "Module", "Severity"];
  const rows = entries.map((e) => [e.time, e.user, e.action, e.detail, e.module, e.severity]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
