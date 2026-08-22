import { syncPushBatchSchema } from "@platform/contracts";
import type { PlatformSqliteDb } from "@platform/database-sqlite";
import { listPendingOutbox, markOutboxCompleted, markOutboxFailed } from "./outbox";

export type SyncEngineOptions = {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 45_000;

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 503 || status === 502 || status === 504 || status === 429;
}

/**
 * Minimal sync loop: pushes pending outbox rows as idempotent batches.
 * Conflict resolution and pull replication are intentionally omitted from this scaffold.
 */
export class SyncEngine {
  constructor(private readonly opts: SyncEngineOptions) {}

  async flushOnce(db: PlatformSqliteDb): Promise<{ pushed: number }> {
    const pending = await listPendingOutbox(db, 25);
    if (pending.length === 0) return { pushed: 0 };

    const fetchImpl =
      this.opts.fetchImpl ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
    const timeoutMs = this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let pushed = 0;

    for (const row of pending) {
      const payload = JSON.parse(row.payloadJson) as unknown;
      const batch = syncPushBatchSchema.parse(payload);
      const url = `${this.opts.apiBaseUrl}/v1/sync/push`;
      const init: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.accessToken}`,
        },
        body: JSON.stringify(batch),
      };

      let res: Response | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          res = await fetchWithTimeout(fetchImpl, url, init, timeoutMs);
          if (isRetryableStatus(res.status) && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            continue;
          }
          break;
        } catch {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            continue;
          }
          res = null;
        }
      }

      if (res?.ok) {
        await markOutboxCompleted(db, row.id);
        pushed += 1;
        continue;
      }

      const nextAttempt = row.attempts + 1;
      const backoffMs = Math.min(60_000, 250 * 2 ** Math.min(nextAttempt, 10));
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
      await markOutboxFailed(db, row.id, nextAttempt, nextRetryAt);
    }

    return { pushed };
  }
}
