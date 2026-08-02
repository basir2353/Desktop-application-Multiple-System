import type {
  BranchPrintServer,
  CreatePrintJob,
  PrintDiscoveryResult,
  PrintJobPayload,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

/** Cloud-registered branch print servers (from desktop heartbeats). */
export async function fetchBranchPrintServers(options?: {
  branchCode?: string;
  /** Default true — only servers with fresh heartbeat. */
  onlineOnly?: boolean;
}): Promise<PrintDiscoveryResult> {
  const params = new URLSearchParams();
  if (options?.branchCode?.trim()) params.set("branchCode", options.branchCode.trim());
  params.set("onlineOnly", options?.onlineOnly === false ? "false" : "true");
  const qs = params.toString();
  const res = await authFetch(`/v1/printing/branch-servers?${qs}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Print servers failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  // Avoid zod schema import — Metro/APK may resolve an older contracts build without printDiscoveryResultSchema.
  const raw = (json && typeof json === "object" ? json : {}) as {
    servers?: unknown[];
    scannedAt?: string;
  };
  const servers: BranchPrintServer[] = Array.isArray(raw.servers)
    ? raw.servers.map((row) => normalizeServer(row)).filter((s): s is BranchPrintServer => s != null)
    : [];
  return {
    servers,
    scannedAt: typeof raw.scannedAt === "string" ? raw.scannedAt : new Date().toISOString(),
  };
}

/** Live link: queue a print job on the API for the desktop EXE to claim & silent-print. */
export async function createCloudPrintJob(input: {
  branchCode: string;
  printerName?: string | null;
  orderId?: string | null;
  userId?: string | null;
  payload: PrintJobPayload;
  deviceLabel?: string;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const body: CreatePrintJob = {
    branchCode: input.branchCode,
    printerName: input.printerName ?? null,
    orderId: input.orderId ?? null,
    userId: input.userId ?? null,
    deviceLabel: input.deviceLabel ?? "waiter-mobile",
    payload: input.payload,
  };
  try {
    const res = await authFetch(`/v1/printing/print-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, error: err?.message ?? `HTTP ${res.status}` };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, jobId: json?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "cloud print failed" };
  }
}

function normalizeServer(row: unknown): BranchPrintServer | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  const branchCode = String(r.branchCode ?? r.branch_code ?? "");
  const localIp = String(r.localIp ?? r.local_ip ?? "");
  if (!id || !branchCode || !localIp) return null;
  const statusRaw = String(r.status ?? "offline");
  const status =
    statusRaw === "online" || statusRaw === "degraded" || statusRaw === "offline"
      ? statusRaw
      : "offline";
  return {
    id,
    organizationId: typeof r.organizationId === "string" ? r.organizationId : undefined,
    branchId: (r.branchId as string | null | undefined) ?? null,
    branchCode,
    branchName: String(r.branchName ?? r.branch_name ?? branchCode),
    serverName: String(r.serverName ?? r.server_name ?? "Branch Print Server"),
    hostname: (r.hostname as string | null | undefined) ?? null,
    localIp,
    port: Number(r.port ?? 9740) || 9740,
    status,
    printerCount: Number(r.printerCount ?? r.printer_count ?? 0) || 0,
    lastHeartbeatAt:
      typeof r.lastHeartbeatAt === "string"
        ? r.lastHeartbeatAt
        : typeof r.last_heartbeat_at === "string"
          ? r.last_heartbeat_at
          : null,
    version: (r.version as string | null | undefined) ?? null,
    cloudSyncEnabled: Boolean(r.cloudSyncEnabled ?? r.cloud_sync_enabled ?? true),
  };
}
