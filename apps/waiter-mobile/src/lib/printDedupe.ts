/**
 * Mobile print dedupe — one tap → one EXE job.
 * Refresh/polling must never re-fire prints; these helpers only guard explicit print calls.
 */

export const MOBILE_PRINT_DEDUPE_MS = 15_000;

/** Stable key for in-flight / recent print suppression. */
export function mobilePrintDedupeKey(opts: {
  branchCode?: string | null;
  kind?: "receipt" | "kot" | string | null;
  orderId?: string | null;
  sectionId?: string | null;
}): string | null {
  const branch = String(opts.branchCode ?? "").trim();
  const orderId = String(opts.orderId ?? "").trim();
  if (!branch || !orderId) return null;
  const kind = String(opts.kind ?? "receipt").trim().toLowerCase() || "receipt";
  const section = String(opts.sectionId ?? "").trim();
  return `${branch}|${kind}|${orderId}|${section}`;
}

export type PrintTransport = "live" | "ip" | "server";

/**
 * Pick exactly one silent transport.
 * Cascading Live→IP→Server caused duplicate EXE dialogs when Live reached the API
 * but the phone treated the response as failure and also submitted LAN.
 */
export function resolveExclusivePrintTransport(settings: {
  modeLive?: boolean;
  modeIp?: boolean;
  modeServer?: boolean;
}): PrintTransport | null {
  if (settings.modeLive) return "live";
  if (settings.modeIp) return "ip";
  if (settings.modeServer) return "server";
  return null;
}

/** In-memory gate used by printHtml (and unit-tested). */
export function createPrintDedupeGate(windowMs = MOBILE_PRINT_DEDUPE_MS) {
  const inflight = new Map<string, Promise<boolean>>();
  const recentAt = new Map<string, number>();

  function prune(now: number): void {
    for (const [key, at] of recentAt) {
      if (now - at > windowMs * 4) recentAt.delete(key);
    }
  }

  return {
    /** Returns existing promise / true (recent) / null (caller should run). */
    begin(key: string | null, now = Date.now()): Promise<boolean> | true | null {
      if (!key) return null;
      prune(now);
      const last = recentAt.get(key);
      if (last != null && now - last < windowMs) return true;
      const existing = inflight.get(key);
      if (existing) return existing;
      return null;
    },
    track(key: string | null, promise: Promise<boolean>): Promise<boolean> {
      if (!key) return promise;
      inflight.set(key, promise);
      return promise.finally(() => {
        inflight.delete(key);
      });
    },
    markDone(key: string | null, now = Date.now()): void {
      if (!key) return;
      recentAt.set(key, now);
    },
    /** Test helper */
    _recentAt: recentAt,
    _inflight: inflight,
  };
}
