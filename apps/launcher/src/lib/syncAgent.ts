import { type SuperAdminEnv } from "../stores/superAdminEnvStore";

export const SYNC_AGENT_URL = "http://127.0.0.1:1421";

export type SyncTableDetail = {
  table: string;
  columns?: number;
  rows?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  sourceCount?: number;
  error?: string;
  skippedTable?: boolean;
};

export type SyncStatus = {
  ok: boolean;
  running: boolean;
  agent: string;
  active: SuperAdminEnv;
  direction: string;
  startedAt: string | null;
  finishedAt: string | null;
  ms: number;
  elapsedMs?: number;
  etaMs?: number | null;
  lastCycleMs?: number;
  tables: number;
  tablesDone?: number;
  tablesTotal?: number;
  columns: number;
  rows: number;
  inserted: number;
  updated: number;
  skipped?: number;
  currentTable?: string | null;
  phase?: "idle" | "connecting" | "syncing";
  details: SyncTableDetail[];
  errors: string[];
};

export function formatSyncDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export async function fetchSyncStatus(): Promise<SyncStatus | null> {
  try {
    const res = await fetch(`${SYNC_AGENT_URL}/status`, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as SyncStatus;
  } catch {
    return null;
  }
}

export async function triggerManualSync(): Promise<{ ok: boolean; queued?: boolean }> {
  try {
    const res = await fetch(`${SYNC_AGENT_URL}/sync`, { method: "POST" });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { ok?: boolean; queued?: boolean };
    return { ok: body.ok === true, queued: body.queued };
  } catch {
    return { ok: false };
  }
}

export async function activateSyncEnv(env: SuperAdminEnv): Promise<boolean> {
  try {
    const res = await fetch(`${SYNC_AGENT_URL}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
