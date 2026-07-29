/** Branch Print Server client + local queue worker (desktop launcher). */

import { invoke } from "@tauri-apps/api/core";
import type { CreatePrintJob, PrintJob, PrintJobPayload } from "@platform/contracts";
import {
  BRANCH_PRINT_SERVER_DEFAULT_PORT,
  PRINTING_ENTERPRISE_ENABLED_KEY,
} from "@platform/contracts";
import { printImageToSystemPrinter, isDesktopAppRuntime, listSystemPrinters } from "./systemPrinters";
import { logPrintEvent } from "./printHistory";

const SETTINGS_KEY = "pops-branch-print-server-v1";
const PREFERRED_SERVER_KEY = "pops-preferred-branch-print-server-v1";
export const BRANCH_PRINT_QUEUE_CHANGED_EVENT = "pops-branch-print-queue-changed";

export type BranchPrintServerSettings = {
  enabled: boolean;
  serverId: string;
  branchCode: string;
  branchName: string;
  serverName: string;
  port: number;
  organizationId?: string | null;
  /** Prefer queue path over direct local print */
  useQueue: boolean;
  cloudHeartbeat: boolean;
};

export type BranchServerStatus = {
  running: boolean;
  serverId: string;
  branchCode: string;
  branchName: string;
  serverName: string;
  localIp: string;
  port: number;
  queuePending: number;
  queueFailed: number;
  printerCount: number;
};

export type DiscoveredBranchServer = {
  id: string;
  branchCode: string;
  branchName: string;
  serverName: string;
  localIp: string;
  port: number;
  status: string;
  pingMs?: number | null;
};

export type BranchQueueJob = {
  id: string;
  branchCode: string;
  printerId?: string | null;
  printerName?: string | null;
  orderId?: string | null;
  priority: number;
  status: string;
  retryCount: number;
  error?: string | null;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
  printedAt?: string | null;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultBranchPrintSettings(branchCode: string, branchName: string): BranchPrintServerSettings {
  return {
    enabled: true,
    serverId: `bps_${branchCode || "local"}`,
    branchCode: branchCode || "MAIN",
    branchName: branchName || branchCode || "Branch",
    serverName: `Print Server · ${branchName || branchCode || "Branch"}`,
    port: BRANCH_PRINT_SERVER_DEFAULT_PORT,
    /** Off by default — direct local print remains primary until opted in on Enterprise tab */
    useQueue: false,
    cloudHeartbeat: true,
  };
}

export function loadBranchPrintSettings(branchCode: string): BranchPrintServerSettings {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY}.${branchCode}`);
    if (!raw) return defaultBranchPrintSettings(branchCode, branchCode);
    return { ...defaultBranchPrintSettings(branchCode, branchCode), ...(JSON.parse(raw) as Partial<BranchPrintServerSettings>) };
  } catch {
    return defaultBranchPrintSettings(branchCode, branchCode);
  }
}

export function saveBranchPrintSettings(settings: BranchPrintServerSettings): void {
  localStorage.setItem(`${SETTINGS_KEY}.${settings.branchCode}`, JSON.stringify(settings));
}

export function loadPreferredBranchServer(): DiscoveredBranchServer | null {
  try {
    const raw = localStorage.getItem(PREFERRED_SERVER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiscoveredBranchServer;
  } catch {
    return null;
  }
}

export function savePreferredBranchServer(server: DiscoveredBranchServer | null): void {
  if (!server) {
    localStorage.removeItem(PREFERRED_SERVER_KEY);
    return;
  }
  localStorage.setItem(PREFERRED_SERVER_KEY, JSON.stringify(server));
}

function snakeStatus(raw: Record<string, unknown>): BranchServerStatus {
  return {
    running: Boolean(raw.running),
    serverId: String(raw.server_id ?? raw.serverId ?? ""),
    branchCode: String(raw.branch_code ?? raw.branchCode ?? ""),
    branchName: String(raw.branch_name ?? raw.branchName ?? ""),
    serverName: String(raw.server_name ?? raw.serverName ?? ""),
    localIp: String(raw.local_ip ?? raw.localIp ?? ""),
    port: Number(raw.port ?? BRANCH_PRINT_SERVER_DEFAULT_PORT),
    queuePending: Number(raw.queue_pending ?? raw.queuePending ?? 0),
    queueFailed: Number(raw.queue_failed ?? raw.queueFailed ?? 0),
    printerCount: Number(raw.printer_count ?? raw.printerCount ?? 0),
  };
}

function isStartResultError(
  value: BranchServerStatus | { error: string } | null,
): value is { error: string } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function mapJob(raw: Record<string, unknown>): BranchQueueJob {
  return {
    id: String(raw.id ?? ""),
    branchCode: String(raw.branch_code ?? raw.branchCode ?? ""),
    printerId: (raw.printer_id ?? raw.printerId ?? null) as string | null,
    printerName: (raw.printer_name ?? raw.printerName ?? null) as string | null,
    orderId: (raw.order_id ?? raw.orderId ?? null) as string | null,
    priority: Number(raw.priority ?? 100),
    status: String(raw.status ?? "pending"),
    retryCount: Number(raw.retry_count ?? raw.retryCount ?? 0),
    error: (raw.error ?? null) as string | null,
    payloadJson: String(raw.payload_json ?? raw.payloadJson ?? "{}"),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ""),
    printedAt: (raw.printed_at ?? raw.printedAt ?? null) as string | null,
  };
}

export async function startBranchPrintServer(
  settings: BranchPrintServerSettings,
): Promise<BranchServerStatus | { error: string }> {
  if (!isDesktopAppRuntime()) {
    return {
      error:
        "Branch Print Server sirf desktop .exe mein chalta hai. Browser se Start nahi hoga — launcher EXE kholo.",
    };
  }
  try {
    const raw = await invoke<Record<string, unknown>>("start_branch_print_server", {
      config: {
        serverId: settings.serverId,
        branchCode: settings.branchCode,
        branchName: settings.branchName,
        serverName: settings.serverName,
        port: settings.port || BRANCH_PRINT_SERVER_DEFAULT_PORT,
        organizationId: settings.organizationId ?? null,
      },
    });
    const status = snakeStatus(raw);
    ensureBranchPrintWorker();
    if (settings.cloudHeartbeat) {
      ensureCloudPrintPoller(settings.branchCode);
    }
    return status;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[branch-print] start failed", err);
    return { error: message || "Start failed" };
  }
}

export async function stopBranchPrintServer(): Promise<boolean> {
  if (!isDesktopAppRuntime()) return false;
  try {
    return await invoke<boolean>("stop_branch_print_server");
  } catch {
    return false;
  }
}

export async function getBranchPrintServerStatus(): Promise<BranchServerStatus | null> {
  if (!isDesktopAppRuntime()) return null;
  try {
    const raw = await invoke<Record<string, unknown>>("get_branch_print_server_status");
    return snakeStatus(raw);
  } catch {
    return null;
  }
}

export async function discoverBranchPrintServers(timeoutMs = 1500): Promise<DiscoveredBranchServer[]> {
  const found: DiscoveredBranchServer[] = [];

  if (isDesktopAppRuntime()) {
    try {
      const raw = await invoke<Array<Record<string, unknown>>>("discover_branch_print_servers", {
        timeoutMs,
      });
      for (const r of raw) {
        found.push({
          id: String(r.id ?? ""),
          branchCode: String(r.branch_code ?? r.branchCode ?? ""),
          branchName: String(r.branch_name ?? r.branchName ?? ""),
          serverName: String(r.server_name ?? r.serverName ?? ""),
          localIp: String(r.local_ip ?? r.localIp ?? ""),
          port: Number(r.port ?? BRANCH_PRINT_SERVER_DEFAULT_PORT),
          status: String(r.status ?? "online"),
          pingMs: (r.ping_ms ?? r.pingMs ?? null) as number | null,
        });
      }
    } catch (err) {
      console.warn("[branch-print] udp discover failed", err);
    }
  }

  // Always probe localhost + preferred IP over HTTP (works even when UDP loopback is blocked on Windows)
  const hosts = new Set<string>(["127.0.0.1"]);
  const preferred = loadPreferredBranchServer();
  if (preferred?.localIp) hosts.add(preferred.localIp);
  try {
    const st = await getBranchPrintServerStatus();
    if (st?.localIp) hosts.add(st.localIp);
  } catch {
    // ignore
  }

  await Promise.all(
    [...hosts].map(async (ip) => {
      const probe = await probeBranchServer({ localIp: ip, port: BRANCH_PRINT_SERVER_DEFAULT_PORT });
      if (!probe.ok) return;
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 2500);
        const res = await fetch(`http://${ip}:${BRANCH_PRINT_SERVER_DEFAULT_PORT}/v1/status`, {
          signal: c.signal,
        });
        clearTimeout(t);
        if (!res.ok) return;
        const info = (await res.json()) as Record<string, unknown>;
        const server: DiscoveredBranchServer = {
          id: String(info.serverId ?? `http-${ip}`),
          branchCode: String(info.branchCode ?? ""),
          branchName: String(info.branchName ?? ""),
          serverName: String(info.serverName ?? "Branch Print Server"),
          localIp: String(info.localIp ?? ip),
          port: Number(info.port ?? BRANCH_PRINT_SERVER_DEFAULT_PORT),
          status: String(info.status ?? "online"),
          pingMs: probe.pingMs ?? null,
        };
        if (!found.some((f) => f.id === server.id || (f.localIp === server.localIp && f.port === server.port))) {
          found.push(server);
        }
      } catch {
        // ignore
      }
    }),
  );

  return found;
}

export async function listBranchPrintQueue(branchCode?: string): Promise<BranchQueueJob[]> {
  if (!isDesktopAppRuntime()) return [];
  try {
    const raw = await invoke<Array<Record<string, unknown>>>("list_branch_print_queue", {
      branchCode: branchCode ?? null,
      limit: 100,
    });
    return raw.map(mapJob);
  } catch {
    return [];
  }
}

export async function branchPrintQueueAction(
  jobId: string,
  action: "retry" | "pause" | "resume" | "cancel" | "reprint",
): Promise<BranchQueueJob | null> {
  if (!isDesktopAppRuntime()) return null;
  try {
    const raw = await invoke<Record<string, unknown>>("branch_print_queue_action", { jobId, action });
    window.dispatchEvent(new CustomEvent(BRANCH_PRINT_QUEUE_CHANGED_EVENT));
    return mapJob(raw);
  } catch {
    return null;
  }
}

export async function printRawTcp(host: string, data: Uint8Array | string, port = 9100): Promise<boolean> {
  if (!isDesktopAppRuntime()) return false;
  const dataBase64 =
    typeof data === "string"
      ? btoa(data)
      : btoa(String.fromCharCode(...Array.from(data)));
  try {
    return await invoke<boolean>("print_raw_tcp", { host, port, dataBase64 });
  } catch (err) {
    console.warn("[branch-print] raw tcp failed", err);
    return false;
  }
}

export function branchServerBaseUrl(server: Pick<DiscoveredBranchServer, "localIp" | "port">): string {
  return `http://${server.localIp}:${server.port}`;
}

/** Submit job to a remote/local branch HTTP API. */
export async function submitPrintJobToServer(
  server: Pick<DiscoveredBranchServer, "localIp" | "port">,
  job: CreatePrintJob & { id?: string },
): Promise<{ ok: boolean; job?: BranchQueueJob; error?: string }> {
  const url = `${branchServerBaseUrl(server)}/v1/print-job`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: job.id ?? newId(),
        branchCode: job.branchCode,
        printerId: job.printerId,
        printerName: job.printerName,
        orderId: job.orderId,
        priority: job.priority ?? 100,
        deviceLabel: job.deviceLabel,
        payload: job.payload,
      }),
      signal: (() => {
        const c = new AbortController();
        setTimeout(() => c.abort(), 8000);
        return c.signal;
      })(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, job: mapJob(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "submit failed" };
  }
}

export async function probeBranchServer(
  server: Pick<DiscoveredBranchServer, "localIp" | "port">,
): Promise<{ ok: boolean; pingMs?: number }> {
  const started = Date.now();
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    const res = await fetch(`${branchServerBaseUrl(server)}/health`, {
      signal: c.signal,
    });
    clearTimeout(t);
    return { ok: res.ok, pingMs: Date.now() - started };
  } catch {
    return { ok: false };
  }
}

/**
 * Enterprise submit: try preferred/discovered branch server, else local Tauri queue,
 * else caller should fall back to direct print.
 */
export async function submitEnterprisePrintJob(input: {
  branchCode: string;
  branchName?: string;
  printerName?: string | null;
  systemPrinterName?: string | null;
  orderId?: string | null;
  payload: PrintJobPayload;
  preferDirectIp?: { host: string; port?: number; dataBase64?: string } | null;
}): Promise<{ queued: boolean; printedDirect: boolean; jobId?: string; error?: string }> {
  // Phase-2 path: direct IP first when configured
  if (input.preferDirectIp?.host && input.preferDirectIp.dataBase64) {
    const ok = await printRawTcp(
      input.preferDirectIp.host,
      // decode handled in Rust; pass as latin1 via binary path — use string form
      (() => {
        try {
          return atob(input.preferDirectIp!.dataBase64!);
        } catch {
          return input.preferDirectIp!.dataBase64!;
        }
      })(),
      input.preferDirectIp.port ?? 9100,
    );
    if (ok) {
      logPrintEvent(input.branchCode, {
        kind: input.payload.kind === "kot" ? "kot" : "receipt",
        printerName: input.printerName ?? input.preferDirectIp.host,
        orderRef: input.orderId ?? undefined,
        ok: true,
      });
      return { queued: false, printedDirect: true };
    }
  }

  const settings = loadBranchPrintSettings(input.branchCode);
  const create: CreatePrintJob = {
    branchCode: input.branchCode,
    printerName: input.printerName ?? input.systemPrinterName ?? null,
    orderId: input.orderId ?? null,
    payload: {
      ...input.payload,
      systemPrinterName: input.payload.systemPrinterName ?? input.systemPrinterName ?? null,
    },
  };

  // Preferred remote server (mobile/desktop failover target)
  const preferred = loadPreferredBranchServer();
  if (preferred?.localIp) {
    const probe = await probeBranchServer(preferred);
    if (probe.ok) {
      const sub = await submitPrintJobToServer(preferred, create);
      if (sub.ok) return { queued: true, printedDirect: false, jobId: sub.job?.id };
    } else {
      // Failover: rediscover
      const found = await discoverBranchPrintServers(1200);
      const next = found.find((s) => s.branchCode === input.branchCode) ?? found[0];
      if (next) {
        savePreferredBranchServer(next);
        const sub = await submitPrintJobToServer(next, create);
        if (sub.ok) return { queued: true, printedDirect: false, jobId: sub.job?.id };
      }
    }
  }

  if (isDesktopAppRuntime() && settings.enabled && settings.useQueue) {
    try {
      // Ensure local server is up
      const status = await getBranchPrintServerStatus();
      if (!status?.running) {
        const started = await startBranchPrintServer({
          ...settings,
          branchName: input.branchName || settings.branchName,
          enabled: true,
        });
        if (isStartResultError(started)) {
          return { queued: false, printedDirect: false, error: started.error };
        }
      }
      const raw = await invoke<Record<string, unknown>>("enqueue_branch_print_job", {
        job: {
          id: newId(),
          branchCode: input.branchCode,
          printerName: create.printerName,
          orderId: create.orderId,
          priority: 100,
          payloadJson: JSON.stringify(create.payload),
          deviceLabel: "desktop-launcher",
        },
      });
      window.dispatchEvent(new CustomEvent(BRANCH_PRINT_QUEUE_CHANGED_EVENT));
      return { queued: true, printedDirect: false, jobId: String(raw.id ?? "") };
    } catch (err) {
      return {
        queued: false,
        printedDirect: false,
        error: err instanceof Error ? err.message : "queue failed",
      };
    }
  }

  return { queued: false, printedDirect: false, error: "branch server unavailable" };
}

let workerStarted = false;
let cloudPollerStarted = false;
let cloudPollerBranch = "";

type BranchPrinterRow = {
  id: string;
  branchCode: string;
  name: string;
  windowsPrinterName?: string | null;
};

async function listLocalBranchPrinters(branchCode: string): Promise<BranchPrinterRow[]> {
  if (!isDesktopAppRuntime()) return [];
  try {
    const raw = await invoke<Array<Record<string, unknown>>>("list_branch_printers", {
      branchCode,
    });
    return (raw ?? []).map((r) => ({
      id: String(r.id ?? ""),
      branchCode: String(r.branch_code ?? r.branchCode ?? branchCode),
      name: String(r.name ?? ""),
      windowsPrinterName: (r.windows_printer_name ?? r.windowsPrinterName ?? null) as string | null,
    }));
  } catch {
    return [];
  }
}

function namesRoughlyMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** Resolve a real Windows spooler name for a queued silent job (never open a dialog). */
export async function resolveSilentSystemPrinterName(input: {
  branchCode: string;
  kind?: string | null;
  printerName?: string | null;
  systemPrinterName?: string | null;
}): Promise<string | null> {
  const hint = input.systemPrinterName?.trim() || input.printerName?.trim() || "";
  const branchCode = input.branchCode || "MAIN";

  const os = await listSystemPrinters().catch(() => [] as Awaited<ReturnType<typeof listSystemPrinters>>);
  const osNames = os.map((p) => p.name).filter(Boolean);

  if (hint) {
    const exactOs = osNames.find((n) => n.toLowerCase() === hint.toLowerCase());
    if (exactOs) return exactOs;
    const fuzzyOs = osNames.find((n) => namesRoughlyMatch(n, hint));
    if (fuzzyOs) return fuzzyOs;
  }

  const branchPrinters = await listLocalBranchPrinters(branchCode);
  if (hint) {
    const byName = branchPrinters.find(
      (p) => namesRoughlyMatch(p.name, hint) || namesRoughlyMatch(p.windowsPrinterName ?? "", hint),
    );
    if (byName?.windowsPrinterName?.trim()) return byName.windowsPrinterName.trim();
  }

  try {
    const { resolveReceiptPrinter, resolveDefaultPrinterByType, loadPrinterRouting } = await import(
      "./printerRouting"
    );
    const kind = String(input.kind ?? "receipt").toLowerCase();
    if (kind === "kot") {
      const kitchen = resolveDefaultPrinterByType(branchCode, "kitchen");
      if (kitchen?.systemPrinterName?.trim()) return kitchen.systemPrinterName.trim();
      const bar = resolveDefaultPrinterByType(branchCode, "bar");
      if (bar?.systemPrinterName?.trim()) return bar.systemPrinterName.trim();
      const routing = loadPrinterRouting(branchCode);
      const anyKot = routing.printers.find(
        (p) =>
          (p.printerType === "kitchen" || p.printerType === "bar") && p.systemPrinterName?.trim(),
      );
      if (anyKot?.systemPrinterName?.trim()) return anyKot.systemPrinterName.trim();
    }
    const receipt = resolveReceiptPrinter(branchCode);
    if (receipt?.systemPrinterName?.trim()) return receipt.systemPrinterName.trim();
    const any = loadPrinterRouting(branchCode).printers.find((p) => p.systemPrinterName?.trim());
    if (any?.systemPrinterName?.trim()) return any.systemPrinterName.trim();
  } catch {
    // ignore routing errors
  }

  const firstBranch = branchPrinters.find((p) => p.windowsPrinterName?.trim());
  if (firstBranch?.windowsPrinterName?.trim()) return firstBranch.windowsPrinterName.trim();

  return osNames[0] ?? null;
}

async function pngBytesFromPayload(
  payload: PrintJobPayload,
): Promise<{ bytes: Uint8Array; paperMm: number } | null> {
  const paper =
    payload.paperSize === "58mm" || payload.paperSize === "80mm" || payload.paperSize === "100mm"
      ? payload.paperSize
      : "80mm";
  const paperMm = paper === "58mm" ? 58 : paper === "100mm" ? 100 : 80;

  if (payload.imageBase64?.trim()) {
    try {
      const bin = Uint8Array.from(atob(payload.imageBase64), (c) => c.charCodeAt(0));
      if (bin.length > 0) return { bytes: bin, paperMm };
    } catch {
      // fall through to HTML
    }
  }

  const html = payload.html?.trim();
  if (!html) return null;

  const { renderTicketHtmlToPngBytes } = await import("./printTicket");
  const png = await renderTicketHtmlToPngBytes(html, paper as "58mm" | "80mm" | "100mm" | "A4" | "custom");
  if (!png?.length) return null;
  return { bytes: png, paperMm };
}

async function executeSilentQueuedJob(job: BranchQueueJob): Promise<{ ok: boolean; error?: string; printer?: string }> {
  const payload = JSON.parse(job.payloadJson) as PrintJobPayload;
  const printer = await resolveSilentSystemPrinterName({
    branchCode: job.branchCode,
    kind: payload.kind,
    printerName: job.printerName ?? payload.systemPrinterName,
    systemPrinterName: payload.systemPrinterName,
  });
  if (!printer) {
    return { ok: false, error: "No Windows printer linked for this branch" };
  }

  const rendered = await pngBytesFromPayload(payload);
  if (!rendered) {
    return { ok: false, error: "Missing image/HTML payload for silent print" };
  }

  const result = await printImageToSystemPrinter({
    printerName: printer,
    pngBytes: rendered.bytes,
    jobName: `${payload.kind} · ${job.orderId ?? job.id}`,
    copies: payload.copies ?? 1,
    paperWidthMm: rendered.paperMm,
  });
  if (result.ok) return { ok: true, printer };
  return { ok: false, error: result.error, printer };
}

/** Drain local SQLite queue via HTML→PNG + named Windows printer (no dialog). */
export function ensureBranchPrintWorker(): void {
  if (workerStarted || !isDesktopAppRuntime()) return;
  workerStarted = true;
  const tick = async () => {
    try {
      const raw = await invoke<Record<string, unknown> | null>("claim_next_branch_print_job");
      if (!raw) return;
      const job = mapJob(raw);
      let ok = false;
      let error: string | undefined;
      let printerName: string | undefined;
      try {
        const result = await executeSilentQueuedJob(job);
        ok = result.ok;
        error = result.error;
        printerName = result.printer;
      } catch (err) {
        error = err instanceof Error ? err.message : "worker error";
      }
      await invoke("complete_branch_print_job", { jobId: job.id, ok, error: error ?? null });
      logPrintEvent(job.branchCode, {
        kind: "receipt",
        printerName: printerName ?? job.printerName ?? undefined,
        orderRef: job.orderId ?? undefined,
        ok,
      });
      window.dispatchEvent(new CustomEvent(BRANCH_PRINT_QUEUE_CHANGED_EVENT));
    } catch {
      // ignore
    }
  };
  window.setInterval(() => {
    void tick();
  }, 1500);
}

/**
 * Poll live API for pending print jobs and execute them on this PC's printers.
 * Works when phone and PC are not on the same Wi‑Fi (as long as both reach the API).
 */
export function ensureCloudPrintPoller(branchCode: string): void {
  if (!isDesktopAppRuntime()) return;
  const code = (branchCode || "MAIN").trim();
  if (cloudPollerStarted && cloudPollerBranch === code) return;
  cloudPollerStarted = true;
  cloudPollerBranch = code;
  ensureBranchPrintWorker();

  const tick = async () => {
    try {
      const settings = loadBranchPrintSettings(code);
      // Live claim always runs while this EXE is open for the branch (cloudHeartbeat can disable).
      if (settings.cloudHeartbeat === false) return;

      const { authFetch } = await import("../../lib/authFetch");
      const res = await authFetch(`/v1/printing/jobs/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchCode: settings.branchCode || code,
          serverId: settings.serverId,
        }),
      });
      if (res.status === 204 || res.status === 404) return;
      if (!res.ok) {
        if (res.status === 404 || res.status === 501) {
          console.warn("[branch-print] Live claim endpoint missing on API — deploy backend");
        }
        return;
      }
      const row = (await res.json()) as {
        id?: string;
        branchCode?: string;
        printerName?: string | null;
        orderId?: string | null;
        payloadJson?: PrintJobPayload | Record<string, unknown>;
        payload?: PrintJobPayload;
      };
      if (!row?.id) return;

      const payload = (row.payload ?? row.payloadJson ?? {}) as PrintJobPayload;
      const localJob: BranchQueueJob = {
        id: row.id,
        branchCode: String(row.branchCode ?? code),
        printerName: row.printerName ?? null,
        orderId: row.orderId ?? null,
        priority: 100,
        status: "printing",
        retryCount: 0,
        error: null,
        payloadJson: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        printedAt: null,
      };

      const result = await executeSilentQueuedJob(localJob);
      await authFetch(`/v1/printing/jobs/${encodeURIComponent(row.id)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: result.ok,
          error: result.error ?? null,
          localJobId: row.id,
        }),
      }).catch(() => null);

      logPrintEvent(localJob.branchCode, {
        kind: payload.kind === "kot" ? "kot" : "receipt",
        printerName: result.printer ?? localJob.printerName ?? undefined,
        orderRef: localJob.orderId ?? undefined,
        ok: result.ok,
      });
      window.dispatchEvent(new CustomEvent(BRANCH_PRINT_QUEUE_CHANGED_EVENT));
    } catch {
      // ignore network / auth blips
    }
  };

  window.setInterval(() => {
    void tick();
  }, 2000);
  void tick();
}

/**
 * Auto-start local queue worker + Live claim poller + cloud heartbeat.
 * Also starts Branch Print Server for IP/LAN modes when possible.
 */
export async function ensureBranchPrintRuntime(
  branchCode: string,
  branchName?: string,
): Promise<BranchServerStatus | null> {
  if (!isDesktopAppRuntime()) return null;
  const code = (branchCode || "MAIN").trim();
  if (!code) return null;

  const settings = loadBranchPrintSettings(code);
  const next: BranchPrintServerSettings = {
    ...settings,
    branchCode: code,
    branchName: branchName || settings.branchName || code,
    enabled: true,
    useQueue: true,
    cloudHeartbeat: true,
  };
  saveBranchPrintSettings(next);

  // Live path does NOT need LAN server — always claim cloud jobs + heartbeat.
  ensureBranchPrintWorker();
  ensureCloudPrintPoller(code);
  ensureCloudHeartbeat(code);

  const status = await getBranchPrintServerStatus();
  if (!status?.running) {
    const started = await startBranchPrintServer(next);
    if (started && !("error" in started)) {
      try {
        await importLegacyPrinterRouting(code);
      } catch {
        // ignore
      }
      return started;
    }
    console.warn("[branch-print] local server start failed — Live claim poller still running");
  }
  return getBranchPrintServerStatus();
}

let heartbeatStarted = false;
let heartbeatBranch = "";

/** Register this EXE as an online print server on the live API (for mobile Online systems). */
export function ensureCloudHeartbeat(branchCode: string): void {
  if (!isDesktopAppRuntime()) return;
  const code = (branchCode || "MAIN").trim();
  if (!code) return;
  if (heartbeatStarted && heartbeatBranch === code) return;
  heartbeatStarted = true;
  heartbeatBranch = code;

  const beat = async () => {
    try {
      const settings = loadBranchPrintSettings(code);
      if (!settings.cloudHeartbeat) return;
      const st = await getBranchPrintServerStatus();
      const { authFetch } = await import("../../lib/authFetch");
      await authFetch(`/v1/printing/branch-servers/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: settings.serverId,
          branchCode: settings.branchCode || code,
          localIp: st?.localIp || "127.0.0.1",
          port: st?.port || settings.port || BRANCH_PRINT_SERVER_DEFAULT_PORT,
          printerCount: st?.printerCount ?? 0,
          queuePending: st?.queuePending ?? 0,
          queueFailed: st?.queueFailed ?? 0,
          at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn("[branch-print] heartbeat failed", err);
    }
  };

  void beat();
  window.setInterval(() => {
    void beat();
  }, 25_000);
}

export async function upsertBranchPrinterNode(input: {
  id: string;
  branchCode: string;
  name: string;
  windowsPrinterName?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  connectionType?: string;
  online?: boolean;
}): Promise<void> {
  if (!isDesktopAppRuntime()) return;
  try {
    await invoke("upsert_branch_printer", {
      id: input.id,
      branchCode: input.branchCode,
      name: input.name,
      windowsPrinterName: input.windowsPrinterName ?? null,
      ipAddress: input.ipAddress ?? null,
      port: input.port ?? null,
      connectionType: input.connectionType ?? "other",
      online: input.online ?? true,
    });
  } catch (err) {
    console.warn("[branch-print] upsert printer failed", err);
  }
}

/** Lazily import existing local printer routing profiles into the branch SQLite inventory. */
export async function importLegacyPrinterRouting(branchCode: string): Promise<number> {
  try {
    const { loadPrinterRouting } = await import("./printerRouting");
    const routing = loadPrinterRouting(branchCode);
    let n = 0;
    for (const p of routing.printers) {
      await upsertBranchPrinterNode({
        id: p.id,
        branchCode,
        name: p.name,
        windowsPrinterName: p.systemPrinterName ?? null,
        connectionType: p.systemPrinterName ? "usb" : "other",
        online: true,
      });
      n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

export { PRINTING_ENTERPRISE_ENABLED_KEY };

export function toPrintJobView(job: BranchQueueJob): Partial<PrintJob> {
  return {
    id: job.id,
    branchCode: job.branchCode,
    printerName: job.printerName,
    orderId: job.orderId,
    status: job.status as PrintJob["status"],
    retryCount: job.retryCount,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    printedAt: job.printedAt,
  };
}

