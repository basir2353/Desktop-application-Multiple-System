/** Branch Print Server client + local queue worker (desktop launcher). */

import { invoke } from "@tauri-apps/api/core";
import type { CreatePrintJob, MenuItem, PrintJob, PrintJobPayload } from "@platform/contracts";
import {
  BRANCH_PRINT_SERVER_DEFAULT_PORT,
  PRINTING_ENTERPRISE_ENABLED_KEY,
} from "@platform/contracts";
import { printImageToSystemPrinter, isDesktopAppRuntime, listSystemPrinters, isVirtualSystemPrinter, isXpsSystemPrinter, preferPdfOverXpsPrinter } from "./systemPrinters";
import { logPrintEvent } from "./printHistory";
import type { PosCartLine } from "./posCart";

const SETTINGS_KEY = "pops-branch-print-server-v1";
const PREFERRED_SERVER_KEY = "pops-preferred-branch-print-server-v1";
export const BRANCH_PRINT_QUEUE_CHANGED_EVENT = "pops-branch-print-queue-changed";
/** Fired when a queued/live print finishes (ok or failed) — UI toast + history refresh. */
export const BRANCH_PRINT_JOB_DONE_EVENT = "pops-print-job-done";

export type BranchPrintJobDoneDetail = {
  ok: boolean;
  orderId?: string | null;
  printerName?: string | null;
  error?: string | null;
  source: "local" | "cloud" | "direct";
  kind?: string | null;
};

export function announcePrintJobDone(detail: BranchPrintJobDoneDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BRANCH_PRINT_JOB_DONE_EVENT, { detail }));
  window.dispatchEvent(new CustomEvent(BRANCH_PRINT_QUEUE_CHANGED_EVENT));
}

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
  /** Staff who queued the job (waiter / cashier) — receipt routing. */
  userId?: string | null;
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
    userId: (raw.user_id ?? raw.userId ?? null) as string | null,
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
let localWorkerBusy = false;
let cloudPollerStarted = false;
let cloudPollerBranch = "";
let cloudWorkerBusy = false;

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

/** PDF / XPS file targets allowed when no thermal printer is linked (laptop testing). */
function acceptPdfFileTarget(name: string | null | undefined): string | null {
  const n = name?.trim() || "";
  if (!n) return null;
  if (isXpsSystemPrinter(n)) return preferPdfOverXpsPrinter(n);
  if (/print\s*to\s*pdf|microsoft\s*print\s*to\s*pdf/i.test(n)) return n;
  // Linked "Microsoft PDF" style names
  if (isVirtualSystemPrinter(n) && /\bpdf\b/i.test(n)) return "Microsoft Print to PDF";
  return null;
}

/** Resolve a Windows spooler name for a queued silent job (never open a dialog).
 * Prefers physical thermal/USB; if none linked, falls back to Microsoft Print to PDF
 * so waiter/mobile jobs still open on the laptop (Save As).
 *
 * Receipt/bill jobs MUST resolve to a single receipt/counter printer (never kitchen/bar,
 * never “print to every printer in the section”).
 * When `userId` is set, that user's assigned bill printer wins over soft mobile labels.
 */
export async function resolveSilentSystemPrinterName(input: {
  branchCode: string;
  kind?: string | null;
  printerName?: string | null;
  systemPrinterName?: string | null;
  /** Waiter / cashier who queued the job — used for personal receipt assignment. */
  userId?: string | null;
  /** Kitchen/Bar/Grill section — when set, KOT uses that section's printers only. */
  sectionId?: string | null;
}): Promise<string | null> {
  const hint = input.systemPrinterName?.trim() || input.printerName?.trim() || "";
  const branchCode = input.branchCode || "MAIN";
  const kind = String(input.kind ?? "receipt").toLowerCase();
  const isKot = kind === "kot";
  const userId = input.userId?.trim() || null;
  const sectionId = input.sectionId?.trim() || null;

  const os = await listSystemPrinters().catch(() => [] as Awaited<ReturnType<typeof listSystemPrinters>>);
  const physicalOs = os.filter((p) => !p.isVirtual && !isVirtualSystemPrinter(p.name));
  const osNames = physicalOs.map((p) => p.name).filter(Boolean);

  const acceptPhysical = (name: string | null | undefined): string | null => {
    const n = name?.trim() || "";
    if (!n) return null;
    if (isVirtualSystemPrinter(n)) return null;
    return n;
  };

  // Exact / fuzzy OS spooler name (when mobile sends a real Windows printer name).
  const hintLooksLikeSoftLabel =
    Boolean(hint) &&
    /billing\s*printer|kitchen\s*printer|cashier\s*\/|pick one|any assigned|expo|cashier\s*\/\s*billing|^billing$|^cashier$|^kitchen(\s*\d+)?$|^bar(\s*\d+)?$/i.test(
      hint,
    );

  // Real Windows names only — never treat soft mobile labels as OS spooler names.
  if (hint && !hintLooksLikeSoftLabel) {
    const exactOs = osNames.find((n) => n.toLowerCase() === hint.toLowerCase());
    if (exactOs) return exactOs;
    const fuzzyOs = osNames.find((n) => namesRoughlyMatch(n, hint));
    if (fuzzyOs) return fuzzyOs;
    const pdfHint = acceptPdfFileTarget(hint);
    if (pdfHint) return pdfHint;
  }

  try {
    const {
      resolveKotPrinter,
      resolveDefaultPrinterByType,
      resolvePrinterForUser,
      resolveReceiptPrinter,
    } = await import("./printerRouting");
    const routing = loadPrinterRouting(branchCode);

    if (isKot) {
      // Same as cashier: Assign Users / section first — never let "Kitchen 1" steal the route.
      if (sectionId) {
        const sectionKot = resolveKotPrinter(branchCode, sectionId, userId, "kitchen");
        const sectionName =
          acceptPhysical(sectionKot?.systemPrinterName) ??
          acceptPdfFileTarget(sectionKot?.systemPrinterName);
        if (sectionName) return sectionName;
        // Strict: do not fall through to another section's printer.
        return null;
      }
      const kitchenKot = resolveKotPrinter(branchCode, null, userId, "kitchen");
      const kitchenName =
        acceptPhysical(kitchenKot?.systemPrinterName) ??
        acceptPdfFileTarget(kitchenKot?.systemPrinterName);
      if (kitchenName) return kitchenName;
      const barKot = resolveKotPrinter(branchCode, null, userId, "bar");
      const barName =
        acceptPhysical(barKot?.systemPrinterName) ??
        acceptPdfFileTarget(barKot?.systemPrinterName);
      if (barName) return barName;
      // Soft profile hint only when this waiter has no Kitchen/Bar assignment.
      if (hint && !hintLooksLikeSoftLabel) {
        const allowedTypes = new Set(["kitchen", "bar"]);
        const profile = routing.printers.find(
          (p) =>
            allowedTypes.has(p.printerType) &&
            (namesRoughlyMatch(p.name, hint) ||
              namesRoughlyMatch(p.systemPrinterName ?? "", hint)),
        );
        if (profile) {
          const linked = acceptPhysical(profile.systemPrinterName);
          if (linked) return linked;
          const linkedPdf = acceptPdfFileTarget(profile.systemPrinterName);
          if (linkedPdf) return linkedPdf;
        }
      }
    } else {
      // Receipt / bill — user-assigned bill printer first (cashier + waiter same path).
      const userBill =
        resolveReceiptPrinter(branchCode, userId) ??
        resolvePrinterForUser(branchCode, userId, "receipt") ??
        resolvePrinterForUser(branchCode, userId, "counter");
      if (userBill) {
        const linked = acceptPhysical(userBill.systemPrinterName);
        if (linked) return linked;
        const linkedPdf = acceptPdfFileTarget(userBill.systemPrinterName);
        if (linkedPdf) return linkedPdf;
        // Assigned but not linked to a Windows printer — do not guess another device
        // (that caused mobile bills to land on the PC default / office printer).
        return null;
      } else {
        // No personal assignment: optional receipt/counter profile hint (never kitchen/bar).
        if (hint && !hintLooksLikeSoftLabel) {
          const allowedTypes = new Set(["receipt", "counter"]);
          const profile = routing.printers.find(
            (p) =>
              allowedTypes.has(p.printerType) &&
              (namesRoughlyMatch(p.name, hint) ||
                namesRoughlyMatch(p.systemPrinterName ?? "", hint)),
          );
          if (profile) {
            const linked = acceptPhysical(profile.systemPrinterName);
            if (linked) return linked;
            const linkedPdf = acceptPdfFileTarget(profile.systemPrinterName);
            if (linkedPdf) return linkedPdf;
          }
        }
        const branchReceipt = resolveDefaultPrinterByType(branchCode, "receipt");
        const branchReceiptName = acceptPhysical(branchReceipt?.systemPrinterName);
        if (branchReceiptName) return branchReceiptName;
        const counter = resolveDefaultPrinterByType(branchCode, "counter");
        const counterName = acceptPhysical(counter?.systemPrinterName);
        if (counterName) return counterName;
        const anyReceipt = routing.printers.find(
          (p) =>
            (p.printerType === "receipt" || p.printerType === "counter") &&
            acceptPhysical(p.systemPrinterName),
        );
        const anyReceiptName = acceptPhysical(anyReceipt?.systemPrinterName);
        if (anyReceiptName) return anyReceiptName;
        const anyReceiptPdf = routing.printers
          .filter((p) => p.printerType === "receipt" || p.printerType === "counter")
          .map((p) => acceptPdfFileTarget(p.systemPrinterName))
          .find(Boolean);
        if (anyReceiptPdf) return anyReceiptPdf;
      }
    }
  } catch {
    // ignore routing errors
  }

  // Receipt / KOT: never invent PDF or Windows default — caller must link an OS printer.
  if (!isKot) {
    return null;
  }

  const branchPrinters = await listLocalBranchPrinters(branchCode);
  const firstBranch = branchPrinters.find((p) => acceptPhysical(p.windowsPrinterName));
  const firstBranchName = acceptPhysical(firstBranch?.windowsPrinterName);
  if (firstBranchName) return firstBranchName;

  const defaultPhysical = physicalOs.find((p) => p.isDefault)?.name;
  if (defaultPhysical) return defaultPhysical;
  if (osNames[0]) return osNames[0];

  return null;
}

async function pngBytesFromPayload(
  payload: PrintJobPayload,
  paperOverride?: string | null,
  branchCode?: string | null,
): Promise<{ bytes: Uint8Array; paperMm: number } | null> {
  const { loadThermalPrintSettings, paperWidthMm } = await import("./thermalPrintSettings");
  const thermal = loadThermalPrintSettings(branchCode);
  const raw = (paperOverride?.trim() || payload.paperSize?.trim() || thermal.defaultPaperSize || "80mm") as string;
  const paper =
    raw === "58mm" || raw === "80mm" || raw === "100mm" || raw === "A4" || raw === "custom"
      ? raw
      : thermal.defaultPaperSize === "custom"
        ? "custom"
        : "80mm";
  const metaMm = Number((payload.meta as { customPaperWidthMm?: unknown } | undefined)?.customPaperWidthMm);
  const customMm = Number.isFinite(metaMm) && metaMm > 0 ? metaMm : thermal.customPaperWidthMm;
  const paperMm = paperWidthMm(paper, customMm);

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
  const png = await renderTicketHtmlToPngBytes(html, paper, customMm);
  if (!png?.length) return null;
  return { bytes: png, paperMm };
}

type MobileTicketLine = {
  label: string;
  qty: number;
  unitPrice?: number;
  menuItemId?: string;
  categoryId?: string;
};

type MobileTicketMeta = {
  branchName?: string;
  modeLabel?: string;
  tableLabel?: string;
  waiterName?: string;
  notes?: string;
  isOrderUpdate?: boolean;
  orderRef?: string;
  billRef?: string;
  lines?: MobileTicketLine[];
  subtotal?: number;
  discount?: number;
  service?: number;
  tax?: number;
  deliveryCharge?: number;
  total?: number;
  servicePct?: number;
  taxPct?: number;
  discountPct?: number;
  payments?: Array<{ method: string; amount: number }>;
  praFiscal?: {
    mode?: string;
    invoiceNumber?: string;
    orderRef?: string;
    qrPayload?: string;
  } | null;
};

function readMobileTicketMeta(payload: PrintJobPayload): MobileTicketMeta | null {
  const raw = payload.meta?.ticket;
  if (!raw || typeof raw !== "object") return null;
  return raw as MobileTicketMeta;
}

async function printPngToResolvedPrinter(input: {
  branchCode: string;
  kind: string;
  orderId?: string | null;
  jobId: string;
  userId: string | null;
  sectionId?: string | null;
  printerHint?: string | null;
  html: string;
  copies?: number;
  paperSize?: string | null;
}): Promise<{ ok: boolean; error?: string; printer?: string }> {
  let printer = await resolveSilentSystemPrinterName({
    branchCode: input.branchCode,
    kind: input.kind,
    printerName: input.printerHint,
    systemPrinterName: null,
    userId: input.userId,
    sectionId: input.sectionId,
  });

  if (printer && isXpsSystemPrinter(printer)) {
    printer = preferPdfOverXpsPrinter(printer);
  }

  // Prefer paper size from the profile that owns this OS printer.
  // Respect explicit job copies (mobile always sends 1) — do not re-apply profile.copies
  // on top or one tap opens N PDF/Save dialogs.
  let paperSize = input.paperSize?.trim() || null;
  let copies = Math.max(1, Math.min(3, input.copies ?? 1));
  const copiesExplicit = input.copies != null;
  try {
    const { loadPrinterRouting } = await import("./printerRouting");
    const routing = loadPrinterRouting(input.branchCode);
    const profile = routing.printers.find(
      (p) =>
        p.systemPrinterName?.trim() &&
        printer &&
        p.systemPrinterName.trim().toLowerCase() === printer.trim().toLowerCase(),
    );
    if (profile) {
      paperSize = profile.paperSize || paperSize;
      if (!copiesExplicit) {
        copies = Math.max(1, Math.min(3, profile.copies || copies));
      }
    }
  } catch {
    // ignore
  }

  // PDF/XPS Save dialogs: one job → one window (profile copies would open N dialogs).
  if (printer && isVirtualSystemPrinter(printer)) {
    copies = 1;
  }

  if (!printer) {
    const isReceipt = String(input.kind).toLowerCase() !== "kot";
    return {
      ok: false,
      error: isReceipt
        ? input.userId
          ? "No bill printer for this user. In POS → Printer settings, assign a Receipt printer to this waiter/cashier and link the Windows printer."
          : "No bill printer found. Assign a Receipt printer in POS → Printer settings."
        : input.sectionId
          ? "No printer assigned to this kitchen section. In POS → Printers, select the section and tap Use for…"
          : "No Windows printer found. Link a thermal/USB printer in POS, or Microsoft Print to PDF for laptop testing.",
    };
  }

  if (isVirtualSystemPrinter(printer) && !/print\s*to\s*pdf/i.test(printer)) {
    if (isXpsSystemPrinter(printer)) {
      printer = preferPdfOverXpsPrinter(printer) ?? "Microsoft Print to PDF";
    } else {
      return {
        ok: false,
        error: `Refusing virtual printer "${printer}". Link a real kitchen/bill printer (or Microsoft Print to PDF).`,
      };
    }
  }

  const rendered = await pngBytesFromPayload(
    { kind: input.kind as PrintJobPayload["kind"], html: input.html, copies, paperSize: paperSize ?? undefined },
    paperSize,
    input.branchCode,
  );
  if (!rendered) {
    return { ok: false, error: "Missing image/HTML payload for silent print" };
  }

  const result = await printImageToSystemPrinter({
    printerName: printer,
    pngBytes: rendered.bytes,
    jobName: `${input.kind} · ${input.orderId ?? input.jobId}`,
    copies,
    paperWidthMm: rendered.paperMm,
  });
  if (result.ok) return { ok: true, printer };
  return { ok: false, error: result.error, printer };
}

/** Same cloud/local job id must never print twice (double claim / retry races). */
const executedSilentJobIds = new Map<string, number>();
const EXECUTED_JOB_TTL_MS = 60_000;
/** Mobile Live+LAN races create two job ids for the same order — suppress the second. */
const executedMobileOrderKeys = new Map<string, number>();
const MOBILE_ORDER_DEDUPE_MS = 20_000;

function markSilentJobExecuted(jobId: string): boolean {
  const id = jobId.trim();
  if (!id) return false;
  const now = Date.now();
  for (const [key, at] of executedSilentJobIds) {
    if (now - at > EXECUTED_JOB_TTL_MS) executedSilentJobIds.delete(key);
  }
  if (executedSilentJobIds.has(id)) return true;
  executedSilentJobIds.set(id, now);
  return false;
}

/** Returns true when this mobile order+kind was already started/printed recently (skip). */
function markMobileOrderPrintStarted(branchCode: string, kind: string, orderId: string): boolean {
  const key = `${branchCode.trim().toUpperCase()}|${kind}|${orderId.trim()}`;
  const now = Date.now();
  for (const [k, at] of executedMobileOrderKeys) {
    if (now - at > MOBILE_ORDER_DEDUPE_MS * 3) executedMobileOrderKeys.delete(k);
  }
  const prev = executedMobileOrderKeys.get(key);
  if (prev != null && now - prev < MOBILE_ORDER_DEDUPE_MS) return true;
  executedMobileOrderKeys.set(key, now);
  return false;
}

async function executeSilentQueuedJob(job: BranchQueueJob): Promise<{ ok: boolean; error?: string; printer?: string }> {
  if (markSilentJobExecuted(job.id)) {
    return { ok: true, printer: undefined };
  }

  const payload = JSON.parse(job.payloadJson) as PrintJobPayload & { userId?: string | null };
  const userId =
    job.userId?.trim() ||
    (typeof payload.userId === "string" ? payload.userId.trim() : "") ||
    (typeof payload.meta?.userId === "string" ? String(payload.meta.userId).trim() : "") ||
    null;
  const kind = String(payload.kind ?? "receipt").toLowerCase();
  const ticket = readMobileTicketMeta(payload);
  const sectionId = payload.sectionId?.trim() || null;
  const fromMobile = String(payload.meta?.source ?? "").toLowerCase() === "waiter-mobile";
  const orderKey = (job.orderId?.trim() || payload.orderRef?.trim() || "").trim();
  if (fromMobile && orderKey && markMobileOrderPrintStarted(job.branchCode, kind, orderKey)) {
    return { ok: true, printer: undefined };
  }
  /** One mobile tap → one slip (never fan out profile copies into N PDF windows). */
  const resolveJobCopies = (enrichedCopies?: number | null) =>
    fromMobile ? 1 : Math.max(1, Math.min(3, enrichedCopies ?? payload.copies ?? 1));

  // Dynamic path: rebuild with desktop printTicket (paper size, text scale, KOT/bill settings).
  if (ticket?.lines && ticket.lines.length > 0) {
    try {
      const { buildTicketHtml, withPrinterProfile } = await import("./printTicket");
      const {
        resolveKotPrinter,
        resolveReceiptPrinter,
        groupCartLinesBySection,
      } = await import("./printerRouting");
      const { loadPrinterSections } = await import("./printerSections");
      const { loadKotPrintSettings } = await import("./kotPrintSettings");
      const { loadBillPrintSettings } = await import("./billPrintSettings");
      // MenuItem / PosCartLine used via casts below.

      const branchName = ticket.branchName?.trim() || job.branchCode;
      const orderRef =
        ticket.orderRef?.trim() ||
        payload.orderRef?.trim() ||
        job.orderId?.trim() ||
        job.id;

      if (kind === "kot") {
        const cartLines: PosCartLine[] = ticket.lines.map((line, index) => {
          const id = line.menuItemId?.trim() || `mobile-line-${index}`;
          const categoryId = line.categoryId?.trim() || "";
          const item = {
            id,
            categoryId,
            name: line.label,
            portion: null,
            price: line.unitPrice ?? 0,
          } as unknown as MenuItem;
          return {
            key: id,
            item,
            variant: null,
            qty: Math.max(1, Number(line.qty) || 1),
            unitPrice: Number(line.unitPrice) || 0,
            lineLabel: line.label,
            sortOrder: index + 1,
          };
        });

        const enabledSections = loadPrinterSections(job.branchCode).filter((s) => s.enabled);
        const enabledIds = new Set(enabledSections.map((s) => s.id));
        // Mobile + EXE: split KOT by Kitchen/Bar/section so each assigned printer gets its lines.
        const groups =
          enabledSections.length > 0 && cartLines.some((l) => l.item.categoryId || l.item.id)
            ? groupCartLinesBySection(job.branchCode, cartLines, enabledIds)
            : [{ sectionId: sectionId, lines: cartLines }];

        // If everything lands in one null group, still print once (kitchen default).
        const printable =
          groups.length === 0
            ? [{ sectionId: sectionId, lines: cartLines }]
            : groups;

        type KotFanout = {
          sectionId: string | null;
          lines: PosCartLine[];
          profile: ReturnType<typeof resolveKotPrinter>;
          preferredType: "kitchen" | "bar";
          label: string;
        };
        const fanout: KotFanout[] = [];
        for (const group of printable) {
          if (!group.lines.length) continue;
          const section = group.sectionId
            ? enabledSections.find((s) => s.id === group.sectionId)
            : null;
          const preferredType =
            section?.name.toLowerCase().includes("bar") || section?.id.includes("bar")
              ? ("bar" as const)
              : ("kitchen" as const);
          const profile = resolveKotPrinter(
            job.branchCode,
            group.sectionId,
            userId,
            preferredType,
          );
          fanout.push({
            sectionId: group.sectionId,
            lines: group.lines,
            profile,
            preferredType,
            label: section ? `${section.icon} ${section.name}` : "Kitchen",
          });
        }

        // Same Windows printer → one slip (avoids N identical PDF dialogs). Different printers stay split.
        const coalesced: KotFanout[] = [];
        for (const jobPart of fanout) {
          const key = (
            jobPart.profile?.systemPrinterName?.trim() ||
            jobPart.profile?.id ||
            `section:${jobPart.sectionId ?? jobPart.preferredType}`
          ).toLowerCase();
          const existing = coalesced.find((m) => {
            const mKey = (
              m.profile?.systemPrinterName?.trim() ||
              m.profile?.id ||
              `section:${m.sectionId ?? m.preferredType}`
            ).toLowerCase();
            return mKey === key;
          });
          if (existing) {
            existing.lines = [...existing.lines, ...jobPart.lines];
            if (existing.label !== jobPart.label) {
              existing.label = `${existing.label} + ${jobPart.label}`;
            }
          } else {
            coalesced.push({ ...jobPart, lines: [...jobPart.lines] });
          }
        }

        let lastPrinter: string | undefined;
        const errors: string[] = [];
        let okCount = 0;

        for (const group of coalesced) {
          const base = {
            branchName,
            branchCode: job.branchCode,
            orderRef,
            modeLabel: ticket.modeLabel?.trim() || group.label,
            tableLabel: ticket.tableLabel?.trim() || ticket.modeLabel?.trim() || undefined,
            waiterName: ticket.waiterName?.trim() || undefined,
            notes: ticket.notes?.trim() || undefined,
            isOrderUpdate: Boolean(ticket.isOrderUpdate),
            lines: group.lines.map((l) => ({
              label: l.lineLabel,
              qty: l.qty,
              unitPrice: 0,
            })),
            subtotal: 0,
            discount: 0,
            service: 0,
            tax: 0,
            total: 0,
            servicePct: 0,
            discountPct: 0,
            kotSettings: loadKotPrintSettings(job.branchCode),
          };
          const enriched = withPrinterProfile(base, group.profile);
          const html = buildTicketHtml({ ...enriched, kind: "kot" });
          const result = await printPngToResolvedPrinter({
            branchCode: job.branchCode,
            kind: "kot",
            orderId: job.orderId,
            jobId: job.id,
            userId,
            sectionId: group.sectionId,
            printerHint:
              group.profile?.systemPrinterName?.trim() ||
              job.printerName ||
              group.profile?.name ||
              null,
            html,
            copies: resolveJobCopies(enriched.copies),
            paperSize: enriched.paperSize ?? null,
          });
          if (result.ok) {
            okCount += 1;
            lastPrinter = result.printer;
          } else if (result.error) {
            errors.push(result.error);
          }
        }

        if (okCount > 0) return { ok: true, printer: lastPrinter };
        return {
          ok: false,
          error: errors[0] ?? "KOT print failed",
          printer: lastPrinter,
        };
      }

      // Receipt — rebuild with EXE bill design (customization, payments, PRA, paper size).
      const profile = resolveReceiptPrinter(job.branchCode, userId);
      const lines = ticket.lines.map((l) => ({
        label: l.label,
        qty: Math.max(1, Number(l.qty) || 1),
        unitPrice: Number(l.unitPrice) || 0,
      }));
      const subtotal =
        ticket.subtotal ??
        lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
      const payments = (ticket.payments ?? [])
        .map((p) => ({
          method: String(p.method ?? "cash").toLowerCase(),
          amount: Math.max(0, Number(p.amount) || 0),
        }))
        .filter(
          (p) =>
            p.amount > 0 &&
            (p.method === "cash" ||
              p.method === "card" ||
              p.method === "wallet" ||
              p.method === "bank"),
        ) as Array<{ method: "cash" | "card" | "wallet" | "bank"; amount: number }>;

      let praFiscal: import("./praReceiptFooter").PraReceiptFooter | null = null;
      const praRaw = ticket.praFiscal;
      if (praRaw?.invoiceNumber?.trim()) {
        try {
          const { preparePraReceiptFooter } = await import("./praReceiptFooter");
          const mode =
            praRaw.mode === "real" || praRaw.mode === "fake" ? praRaw.mode : "fake";
          // Must await — sync assign left a Promise in praFiscal so invoice#/QR never printed.
          praFiscal = await preparePraReceiptFooter({
            mode,
            invoiceNumber: praRaw.invoiceNumber.trim(),
            orderRef: praRaw.orderRef?.trim() || orderRef,
            qrPayload: praRaw.qrPayload?.trim() || praRaw.invoiceNumber.trim(),
            branchCode: job.branchCode,
          });
        } catch {
          praFiscal = null;
        }
      }

      const base = {
        branchName,
        branchCode: job.branchCode,
        orderRef,
        billRef: ticket.billRef?.trim() || undefined,
        modeLabel: ticket.modeLabel?.trim() || "Staff",
        tableLabel: ticket.tableLabel?.trim() || undefined,
        waiterName: ticket.waiterName?.trim() || undefined,
        notes: ticket.notes?.trim() || undefined,
        lines,
        subtotal,
        discount: ticket.discount ?? 0,
        service: ticket.service ?? 0,
        tax: ticket.tax ?? 0,
        deliveryCharge: ticket.deliveryCharge ?? 0,
        total: ticket.total ?? subtotal + (ticket.service ?? 0) + (ticket.tax ?? 0),
        servicePct: ticket.servicePct ?? 0,
        taxPct: ticket.taxPct,
        discountPct: ticket.discountPct ?? 0,
        payments: payments.length ? payments : undefined,
        praFiscal,
        billPrintSettings: loadBillPrintSettings(job.branchCode),
      };
      const enriched = withPrinterProfile(base, profile);
      const html = buildTicketHtml({ ...enriched, kind: "receipt" });
      return printPngToResolvedPrinter({
        branchCode: job.branchCode,
        kind: "receipt",
        orderId: job.orderId,
        jobId: job.id,
        userId,
        sectionId: null,
        printerHint: job.printerName ?? profile?.name ?? null,
        html,
        copies: resolveJobCopies(enriched.copies),
        paperSize: enriched.paperSize ?? null,
      });
    } catch (err) {
      // Fall through to legacy HTML path if rebuild fails.
      console.warn("[branchPrint] structured mobile rebuild failed", err);
    }
  }

  // Legacy HTML path — still apply sectionId + profile paper size when possible.
  let paperOverride: string | null = payload.paperSize?.trim() || null;
  try {
    const { resolveKotPrinter, resolveReceiptPrinter } = await import("./printerRouting");
    const profile =
      kind === "kot"
        ? resolveKotPrinter(job.branchCode, sectionId, userId, "kitchen")
        : resolveReceiptPrinter(job.branchCode, userId);
    if (profile?.paperSize) paperOverride = profile.paperSize;
  } catch {
    // ignore
  }

  return printPngToResolvedPrinter({
    branchCode: job.branchCode,
    kind,
    orderId: job.orderId,
    jobId: job.id,
    userId,
    sectionId,
    printerHint: job.printerName ?? payload.systemPrinterName ?? null,
    html: payload.html?.trim() || "",
    copies: resolveJobCopies(payload.copies),
    paperSize: paperOverride,
  });
}

/** Drain local SQLite queue via HTML→PNG + named Windows printer (no dialog). */
export function ensureBranchPrintWorker(): void {
  if (workerStarted || !isDesktopAppRuntime()) return;
  workerStarted = true;
  const tick = async () => {
    if (localWorkerBusy) return;
    localWorkerBusy = true;
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
      announcePrintJobDone({
        ok,
        orderId: job.orderId,
        printerName: printerName ?? job.printerName,
        error: error ?? null,
        source: "local",
      });
    } catch {
      // ignore
    } finally {
      localWorkerBusy = false;
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
    if (cloudWorkerBusy) return;
    cloudWorkerBusy = true;
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
        userId?: string | null;
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
        userId: row.userId ?? null,
        orderId: row.orderId ?? null,
        priority: 100,
        status: "printing",
        retryCount: 0,
        error: null,
        payloadJson: JSON.stringify({
          ...payload,
          meta: {
            ...(payload.meta && typeof payload.meta === "object" ? payload.meta : {}),
            userId: row.userId ?? null,
          },
        }),
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
      announcePrintJobDone({
        ok: result.ok,
        orderId: localJob.orderId,
        printerName: result.printer ?? localJob.printerName,
        error: result.error ?? null,
        source: "cloud",
        kind: payload.kind === "kot" ? "kot" : "receipt",
      });
    } catch {
      // ignore network / auth blips
    } finally {
      cloudWorkerBusy = false;
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
  // Keep the user's queue preference. Forcing useQueue:true made every POS Print
  // click enqueue + toast "sent" while the thermal stayed silent if the worker failed.
  // Cloud/mobile workers still run below regardless of useQueue.
  const next: BranchPrintServerSettings = {
    ...settings,
    branchCode: code,
    branchName: branchName || settings.branchName || code,
    enabled: true,
    cloudHeartbeat: settings.cloudHeartbeat !== false,
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

