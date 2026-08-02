/** Mobile branch print server discovery + silent job submission. */

import {
  BRANCH_PRINT_SERVER_DEFAULT_PORT,
  type CreatePrintJob,
  type PrintJobPayload,
} from "@platform/contracts";
import { secureGet, secureSet } from "./secureStorage";

const PREFERRED_KEY = "waiter-preferred-branch-print-server-v1";
const DISCOVERY_CACHE_KEY = "waiter-discovered-branch-print-servers-v1";
const USE_BRANCH_KEY = "waiter-use-branch-print-server-v1";

export type MobileDiscoveredServer = {
  id: string;
  branchCode: string;
  branchName: string;
  serverName: string;
  localIp: string;
  port: number;
  status: string;
  pingMs?: number | null;
};

export async function loadUseBranchPrintServer(): Promise<boolean> {
  try {
    const raw = await secureGet(USE_BRANCH_KEY);
    if (raw == null) return true;
    return raw === "1" || raw === "true";
  } catch {
    return true;
  }
}

export async function saveUseBranchPrintServer(enabled: boolean): Promise<void> {
  await secureSet(USE_BRANCH_KEY, enabled ? "1" : "0");
}

export async function loadPreferredBranchServer(): Promise<MobileDiscoveredServer | null> {
  try {
    const raw = await secureGet(PREFERRED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileDiscoveredServer;
  } catch {
    return null;
  }
}

export async function savePreferredBranchServer(server: MobileDiscoveredServer | null): Promise<void> {
  if (!server) {
    await secureSet(PREFERRED_KEY, "");
    return;
  }
  await secureSet(PREFERRED_KEY, JSON.stringify(server));
}

export async function loadCachedDiscoveredServers(): Promise<MobileDiscoveredServer[]> {
  try {
    const raw = await secureGet(DISCOVERY_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MobileDiscoveredServer[];
  } catch {
    return [];
  }
}

async function cacheDiscovered(servers: MobileDiscoveredServer[]): Promise<void> {
  await secureSet(DISCOVERY_CACHE_KEY, JSON.stringify(servers));
}

function baseUrl(server: Pick<MobileDiscoveredServer, "localIp" | "port">): string {
  return `http://${server.localIp}:${server.port || BRANCH_PRINT_SERVER_DEFAULT_PORT}`;
}

/** Accept `192.168.1.50` or `192.168.1.50:9740` (UI often pastes host:port). */
export function parseHostPort(
  input: string,
  defaultPort = BRANCH_PRINT_SERVER_DEFAULT_PORT,
): { localIp: string; port: number } | null {
  const trimmed = input.trim().replace(/^https?:\/\//i, "");
  if (!trimmed) return null;
  const withoutPath = trimmed.split("/")[0] ?? trimmed;
  const hostPart = withoutPath.includes("@") ? (withoutPath.split("@").pop() ?? withoutPath) : withoutPath;

  let localIp: string;
  let port: number;

  // [ipv6]:port
  if (hostPart.startsWith("[")) {
    const close = hostPart.indexOf("]");
    if (close > 1) {
      localIp = hostPart.slice(1, close);
      const rest = hostPart.slice(close + 1);
      port = rest.startsWith(":") ? Number(rest.slice(1)) : defaultPort;
      if (!localIp || !Number.isFinite(port) || port <= 0) return null;
    } else {
      return null;
    }
  } else {
    const lastColon = hostPart.lastIndexOf(":");
    if (lastColon > 0 && hostPart.indexOf(":") === lastColon) {
      localIp = hostPart.slice(0, lastColon).trim();
      port = Number(hostPart.slice(lastColon + 1));
      if (!localIp || !Number.isFinite(port) || port <= 0) return null;
    } else {
      localIp = hostPart;
      port = defaultPort;
    }
  }

  // Users often paste UDP discovery port (9741); HTTP API listens on 9740.
  if (port === 9741) port = BRANCH_PRINT_SERVER_DEFAULT_PORT;

  return { localIp, port };
}

export async function probeBranchServer(
  server: Pick<MobileDiscoveredServer, "localIp" | "port">,
): Promise<{ ok: boolean; pingMs?: number; info?: Record<string, unknown> }> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${baseUrl(server)}/v1/status`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const info = (await res.json()) as Record<string, unknown>;
    return { ok: true, pingMs: Date.now() - started, info };
  } catch {
    return { ok: false };
  }
}

/**
 * Discover branch servers:
 * 1) Probe preferred + cached IPs
 * 2) Probe common LAN candidates around device IP when available
 * UDP broadcast is not available in Expo Go without a native module — HTTP probe covers most restaurant LANs.
 */
export async function discoverBranchPrintServers(options?: {
  branchCode?: string;
  extraHosts?: string[];
}): Promise<MobileDiscoveredServer[]> {
  const candidates: Array<{ localIp: string; port: number }> = [];
  const preferred = await loadPreferredBranchServer();
  if (preferred?.localIp) candidates.push({ localIp: preferred.localIp, port: preferred.port });
  for (const cached of await loadCachedDiscoveredServers()) {
    if (!candidates.some((c) => c.localIp === cached.localIp && c.port === cached.port)) {
      candidates.push({ localIp: cached.localIp, port: cached.port });
    }
  }
  for (const host of options?.extraHosts ?? []) {
    const parsed = parseHostPort(host);
    if (!parsed) continue;
    if (!candidates.some((c) => c.localIp === parsed.localIp && c.port === parsed.port)) {
      candidates.push(parsed);
    }
  }

  // Common private LAN guesses when nothing cached (best-effort)
  const guesses = [
    "192.168.1.1",
    "192.168.0.1",
    "192.168.1.100",
    "192.168.100.1",
    "192.168.100.6",
    "10.0.0.1",
  ];
  for (const g of guesses) {
    if (!candidates.some((c) => c.localIp === g)) {
      candidates.push({ localIp: g, port: BRANCH_PRINT_SERVER_DEFAULT_PORT });
    }
  }

  const found: MobileDiscoveredServer[] = [];
  await Promise.all(
    candidates.slice(0, 16).map(async (c) => {
      const probe = await probeBranchServer(c);
      if (!probe.ok || !probe.info) return;
      const info = probe.info;
      const server: MobileDiscoveredServer = {
        id: String(info.serverId ?? `${c.localIp}:${c.port}`),
        branchCode: String(info.branchCode ?? ""),
        branchName: String(info.branchName ?? ""),
        serverName: String(info.serverName ?? "Branch Print Server"),
        localIp: String(info.localIp ?? c.localIp),
        port: Number(info.port ?? c.port),
        status: String(info.status ?? "online"),
        pingMs: probe.pingMs ?? null,
      };
      if (options?.branchCode && server.branchCode && server.branchCode !== options.branchCode) {
        return;
      }
      if (!found.some((f) => f.id === server.id || (f.localIp === server.localIp && f.port === server.port))) {
        found.push(server);
      }
    }),
  );

  await cacheDiscovered(found);
  return found.sort((a, b) => (a.pingMs ?? 9999) - (b.pingMs ?? 9999));
}

export async function submitSilentPrintJob(
  server: Pick<MobileDiscoveredServer, "localIp" | "port">,
  job: CreatePrintJob & { id?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${baseUrl(server)}/v1/print-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: job.id,
        branchCode: job.branchCode,
        printerId: job.printerId,
        printerName: job.printerName,
        userId: job.userId ?? null,
        orderId: job.orderId,
        priority: job.priority ?? 100,
        deviceLabel: job.deviceLabel ?? "waiter-mobile",
        payload: job.payload,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "submit failed" };
  }
}

/**
 * Try silent print paths — each mode is independent; first success wins (no multi-path leak).
 * - Live: API only (EXE claims) — never uses LAN
 * - IP: preferred PC IP only (no discover)
 * - Server: LAN discover / preferred from discover
 * Returns true if a silent path accepted the job (no Expo dialog needed).
 */
export async function trySilentBranchPrint(input: {
  branchCode: string;
  printerName?: string | null;
  orderId?: string | null;
  /** Logged-in waiter / cashier — desktop routes bill to their assigned receipt printer only. */
  userId?: string | null;
  payload: PrintJobPayload;
}): Promise<boolean> {
  const { loadMobilePrinterSettings } = await import("./mobilePrinterSettings");
  const settings = await loadMobilePrinterSettings();
  if (!settings.autoPrint) return false;

  // Strip any accidental OS/virtual printer names from mobile payload.
  const payload: PrintJobPayload = {
    ...input.payload,
    systemPrinterName: null,
    meta: {
      ...(input.payload.meta && typeof input.payload.meta === "object" ? input.payload.meta : {}),
      userId: input.userId ?? null,
    },
  };

  // Soft profile hint only (Kitchen 1 / Cashier) — desktop maps via POS routing.
  const printerName = input.printerName?.trim() || null;

  // 1) Live link — completely separate from IP / LAN
  if (settings.modeLive) {
    try {
      const { createCloudPrintJob } = await import("../api/printing");
      const cloud = await createCloudPrintJob({
        branchCode: input.branchCode,
        printerName,
        orderId: input.orderId ?? null,
        userId: input.userId ?? null,
        payload,
        deviceLabel: "waiter-mobile",
      });
      if (cloud.ok) return true;
    } catch {
      // Live failed — fall through only if other modes ON
    }
  }

  // 2) IP attach — only the manually connected preferred PC (no LAN scan)
  if (settings.modeIp) {
    const preferred = await loadPreferredBranchServer();
    if (preferred?.localIp) {
      const probe = await probeBranchServer(preferred);
      if (probe.ok) {
        const result = await submitSilentPrintJob(preferred, {
          branchCode: input.branchCode,
          printerName,
          orderId: input.orderId ?? null,
          userId: input.userId ?? null,
          deviceLabel: "waiter-mobile-ip",
          payload,
        });
        if (result.ok) return true;
      }
    }
  }

  // 3) Computer as server — LAN discover only (separate from manual IP)
  if (settings.modeServer) {
    const found = await discoverBranchPrintServers({ branchCode: input.branchCode });
    const server = found[0] ?? null;
    if (server) {
      const result = await submitSilentPrintJob(server, {
        branchCode: input.branchCode,
        printerName,
        orderId: input.orderId ?? null,
        userId: input.userId ?? null,
        deviceLabel: "waiter-mobile-lan",
        payload,
      });
      if (result.ok) return true;
    }
  }

  return false;
}

/** Manually enroll a server by IP (settings UI). */
export async function enrollBranchServerByIp(
  localIp: string,
  port = BRANCH_PRINT_SERVER_DEFAULT_PORT,
): Promise<MobileDiscoveredServer | null> {
  const parsed = parseHostPort(localIp, port);
  if (!parsed) return null;
  const probe = await probeBranchServer(parsed);
  if (!probe.ok || !probe.info) return null;
  const info = probe.info;
  const server: MobileDiscoveredServer = {
    id: String(info.serverId ?? `${parsed.localIp}:${parsed.port}`),
    branchCode: String(info.branchCode ?? ""),
    branchName: String(info.branchName ?? ""),
    serverName: String(info.serverName ?? "Branch Print Server"),
    localIp: String(info.localIp ?? parsed.localIp),
    port: Number(info.port ?? parsed.port),
    status: "online",
    pingMs: probe.pingMs ?? null,
  };
  await savePreferredBranchServer(server);
  const cached = await loadCachedDiscoveredServers();
  if (!cached.some((c) => c.id === server.id)) {
    await cacheDiscovered([server, ...cached]);
  }
  return server;
}
