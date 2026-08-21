/** Tracks in-flight prints, slow/timeout detection, and alert helpers. */

import {
  classifyPrintSource,
  loadPrintHistory,
  logPrintEvent,
  PRINT_HISTORY_CHANGED_EVENT,
  type PrintHistoryEntry,
  type PrintKind,
  type PrintSource,
} from "./printHistory";
import type { PopsAlert } from "./popsAlerts";

export const PRINT_QUEUE_MONITOR_CHANGED = "pops-print-queue-monitor-changed";
export const PRINT_SLOW_MS = 15_000;
export const PRINT_TIMEOUT_MS = 45_000;
export const QUEUE_STUCK_MS = 60_000;

export type ActivePrintJob = {
  id: string;
  branchCode: string;
  kind: PrintKind;
  orderRef?: string;
  printerName?: string;
  source: PrintSource;
  startedAt: number;
  status: "running" | "slow";
};

export type QueueJobSnapshot = {
  id: string;
  branchCode: string;
  status: string;
  kind?: string | null;
  printerName?: string | null;
  orderId?: string | null;
  error?: string | null;
  deviceLabel?: string | null;
  updatedAt?: string | null;
  source: "local" | "cloud";
};

type TrackParams = {
  branchCode?: string;
  kind: PrintKind;
  orderRef?: string;
  printerName?: string;
  source?: PrintSource;
  deviceLabel?: string;
};

const activeJobs = new Map<string, ActivePrintJob>();
const timers = new Map<
  string,
  { slow: ReturnType<typeof setTimeout>; timeout: ReturnType<typeof setTimeout> }
>();

function dispatchMonitorChanged(branchCode?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PRINT_QUEUE_MONITOR_CHANGED, { detail: { branchCode } }),
  );
}

function resolveOutcome(
  ok: boolean,
  durationMs: number,
): PrintHistoryEntry["outcome"] {
  if (!ok) return "failed";
  if (durationMs >= PRINT_SLOW_MS) return "slow";
  return "ok";
}

/** Begin tracking a direct print (KOT, receipt, PRA, FBR, test). Call finish when done. */
export function trackPrintJob(params: TrackParams): {
  finish: (ok: boolean, error?: string) => void;
} {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const branchCode = (params.branchCode || "MAIN").trim();
  const source =
    params.source ?? classifyPrintSource(params.deviceLabel, undefined);

  const job: ActivePrintJob = {
    id,
    branchCode,
    kind: params.kind,
    orderRef: params.orderRef,
    printerName: params.printerName,
    source,
    startedAt: Date.now(),
    status: "running",
  };
  activeJobs.set(id, job);
  dispatchMonitorChanged(branchCode);

  const slowTimer = setTimeout(() => {
    const current = activeJobs.get(id);
    if (!current || current.status !== "running") return;
    current.status = "slow";
    dispatchMonitorChanged(branchCode);
  }, PRINT_SLOW_MS);

  const timeoutTimer = setTimeout(() => {
    const current = activeJobs.get(id);
    if (!current) return;
    const durationMs = Date.now() - current.startedAt;
    activeJobs.delete(id);
    timers.delete(id);
    logPrintEvent(branchCode, {
      kind: params.kind,
      printerName: params.printerName,
      orderRef: params.orderRef,
      ok: false,
      source,
      deviceLabel: params.deviceLabel,
      error: "Print timed out — printer did not respond in time.",
      durationMs,
      outcome: "timeout",
    });
    dispatchMonitorChanged(branchCode);
  }, PRINT_TIMEOUT_MS);

  timers.set(id, { slow: slowTimer, timeout: timeoutTimer });

  return {
    finish(ok: boolean, error?: string) {
      const current = activeJobs.get(id);
      const t = timers.get(id);
      if (t) {
        clearTimeout(t.slow);
        clearTimeout(t.timeout);
        timers.delete(id);
      }
      if (!current) return;
      activeJobs.delete(id);
      const durationMs = Date.now() - current.startedAt;
      logPrintEvent(branchCode, {
        kind: params.kind,
        printerName: params.printerName,
        orderRef: params.orderRef,
        ok,
        source,
        deviceLabel: params.deviceLabel,
        error: ok ? undefined : error,
        durationMs,
        outcome: resolveOutcome(ok, durationMs),
      });
      dispatchMonitorChanged(branchCode);
    },
  };
}

export function getActivePrintJobs(branchCode?: string): ActivePrintJob[] {
  const code = branchCode?.trim();
  const rows = [...activeJobs.values()];
  if (!code) return rows.sort((a, b) => a.startedAt - b.startedAt);
  return rows.filter((j) => j.branchCode === code).sort((a, b) => a.startedAt - b.startedAt);
}

function queueKindFromLabel(raw?: string | null): PrintKind {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("kot")) return "kot";
  if (s.includes("pra")) return "pra";
  if (s.includes("fbr")) return "fbr";
  if (s.includes("receipt") || s.includes("bill")) return "receipt";
  return "receipt";
}

function isPendingStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending" || s === "queued" || s === "claimed" || s === "processing";
}

function isFailedStatus(status: string, error?: string | null): boolean {
  const s = status.toLowerCase();
  return s === "failed" || s === "error" || s === "dead" || Boolean(error);
}

function stuckSinceMs(job: QueueJobSnapshot): number | null {
  if (!isPendingStatus(job.status)) return null;
  const anchor = job.updatedAt ? Date.parse(job.updatedAt) : Date.now();
  if (Number.isNaN(anchor)) return null;
  const elapsed = Date.now() - anchor;
  return elapsed >= QUEUE_STUCK_MS ? elapsed : null;
}

export function printAlertsFromState(input: {
  branchCode?: string;
  queueJobs?: QueueJobSnapshot[];
  historyLimit?: number;
}): PopsAlert[] {
  const branchCode = input.branchCode?.trim();
  if (!branchCode) return [];

  const now = new Date().toISOString();
  const alerts: PopsAlert[] = [];
  const history = loadPrintHistory(branchCode).slice(0, input.historyLimit ?? 80);
  const recentCutoff = Date.now() - 30 * 60_000;

  for (const job of getActivePrintJobs(branchCode)) {
    const elapsedSec = Math.round((Date.now() - job.startedAt) / 1000);
    if (job.status === "slow") {
      alerts.push({
        id: `print-slow-active-${job.id}`,
        kind: "print_slow",
        tone: "warning",
        title: "Print taking long",
        message: `${job.kind.toUpperCase()}${job.orderRef ? ` · ${job.orderRef}` : ""} — ${elapsedSec}s on ${job.printerName ?? "printer"}`,
        href: "/pops/printers?tab=activity",
        at: now,
      });
    }
  }

  for (const entry of history) {
    if (Date.parse(entry.at) < recentCutoff) continue;
    if (entry.ok && entry.outcome !== "slow") continue;
    const tone = entry.outcome === "slow" ? "warning" : "danger";
    const title =
      entry.outcome === "timeout"
        ? "Print timed out"
        : entry.outcome === "slow"
          ? "Slow print"
          : "Print failed";
    alerts.push({
      id: `print-hist-${entry.id}`,
      kind: entry.outcome === "slow" ? "print_slow" : "print_failed",
      tone,
      title,
      message: `${entry.kind.toUpperCase()}${entry.orderRef ? ` · ${entry.orderRef}` : ""}${entry.error ? ` — ${entry.error}` : ""}`,
      href: "/pops/printers?tab=activity",
      at: entry.at,
    });
  }

  for (const job of input.queueJobs ?? []) {
    if (job.branchCode !== branchCode) continue;

    if (isFailedStatus(job.status, job.error)) {
      alerts.push({
        id: `print-queue-fail-${job.source}-${job.id}`,
        kind: "print_failed",
        tone: "danger",
        title: "Missed print (queue)",
        message: `${queueKindFromLabel(job.kind).toUpperCase()}${job.orderId ? ` · ${job.orderId}` : ""} — ${job.error ?? job.status}`,
        href: "/pops/printers?tab=activity",
        at: now,
      });
      continue;
    }

    const stuckMs = stuckSinceMs(job);
    if (stuckMs != null) {
      const mins = Math.max(1, Math.round(stuckMs / 60_000));
      alerts.push({
        id: `print-queue-stuck-${job.source}-${job.id}`,
        kind: "print_stuck",
        tone: "warning",
        title: "Print stuck in queue",
        message: `${queueKindFromLabel(job.kind).toUpperCase()}${job.orderId ? ` · ${job.orderId}` : ""} pending ${mins} min — check EXE / printer`,
        href: "/pops/printers?tab=activity",
        at: now,
      });
    }
  }

  const toneRank = { danger: 0, warning: 1, info: 2 };
  const kindRank = { print_failed: 0, print_stuck: 1, print_slow: 2, print_timeout: 3 };

  return alerts.sort((a, b) => {
    const t = toneRank[a.tone] - toneRank[b.tone];
    if (t !== 0) return t;
    return (kindRank[a.kind as keyof typeof kindRank] ?? 9) - (kindRank[b.kind as keyof typeof kindRank] ?? 9);
  });
}

export function formatPrintDuration(ms?: number): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export { PRINT_HISTORY_CHANGED_EVENT };
