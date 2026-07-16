import {
  closeDayResultSchema,
  closingStatusSchema,
  closingZReportSchema,
  type CloseDayResult,
  type ClosingStatus,
  type ClosingZReport,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new Error(err?.message ?? `${fallback}: ${res.status}`);
}

export async function fetchClosingStatus(branchCode: string): Promise<ClosingStatus> {
  const res = await authFetch(`/v1/closing/status?branchCode=${encodeURIComponent(branchCode)}`);
  if (!res.ok) await parseError(res, "Closing status failed");
  return closingStatusSchema.parse(await res.json());
}

export async function pauseOrders(branchCode: string): Promise<ClosingStatus> {
  const res = await authFetch("/v1/closing/pause-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) await parseError(res, "Pause orders failed");
  return closingStatusSchema.parse(await res.json());
}

export async function resumeOrders(branchCode: string): Promise<ClosingStatus> {
  const res = await authFetch("/v1/closing/resume-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) await parseError(res, "Resume orders failed");
  return closingStatusSchema.parse(await res.json());
}

export async function closeKitchenAtDayEnd(branchCode: string): Promise<ClosingStatus> {
  const res = await authFetch("/v1/closing/close-kitchen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) await parseError(res, "Close kitchen failed");
  return closingStatusSchema.parse(await res.json());
}

export async function runZReport(branchCode: string): Promise<{ zReport: ClosingZReport; status: ClosingStatus }> {
  const res = await authFetch("/v1/closing/run-z-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) await parseError(res, "Z-report failed");
  const data = (await res.json()) as { zReport: unknown; status: unknown };
  return {
    zReport: closingZReportSchema.parse(data.zReport),
    status: closingStatusSchema.parse(data.status),
  };
}

export async function verifyBackup(branchCode: string): Promise<ClosingStatus> {
  const res = await authFetch("/v1/closing/verify-backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) await parseError(res, "Backup verification failed");
  const data = (await res.json()) as { status: unknown };
  return closingStatusSchema.parse(data.status);
}

export async function closeDay(branchCode: string): Promise<CloseDayResult> {
  const res = await authFetch("/v1/closing/close-day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) await parseError(res, "Close day failed");
  return closeDayResultSchema.parse(await res.json());
}
