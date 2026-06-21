import { syncPushBatchSchema } from "@platform/contracts";
import type { PlatformSqliteDb } from "@platform/database-sqlite";
import { listPendingOutbox, markOutboxCompleted, markOutboxFailed } from "./outbox";

export type SyncEngineOptions = {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

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
    let pushed = 0;

    for (const row of pending) {
      const payload = JSON.parse(row.payloadJson) as unknown;
      const batch = syncPushBatchSchema.parse(payload);
      const res = await fetchImpl(`${this.opts.apiBaseUrl}/v1/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.accessToken}`,
        },
        body: JSON.stringify(batch),
      });

      if (res.ok) {
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
