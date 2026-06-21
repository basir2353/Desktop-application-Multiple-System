import { eq } from "drizzle-orm";
import type { PlatformSqliteDb } from "@platform/database-sqlite";
import { outbox as outboxTable } from "@platform/database-sqlite";
export type OutboxEnqueueInput = {
  organizationId: string;
  payload: unknown;
};

export async function enqueueOutbox(db: PlatformSqliteDb, input: OutboxEnqueueInput): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(outboxTable).values({
    id,
    organizationId: input.organizationId,
    payloadJson: JSON.stringify(input.payload),
    status: "pending",
    attempts: 0,
    nextRetryAt: null,
    createdAt: now,
  });
  return id;
}

export async function listPendingOutbox(
  db: PlatformSqliteDb,
  limit = 50,
): Promise<
  {
    id: string;
    organizationId: string;
    payloadJson: string;
    attempts: number;
  }[]
> {
  return db
    .select({
      id: outboxTable.id,
      organizationId: outboxTable.organizationId,
      payloadJson: outboxTable.payloadJson,
      attempts: outboxTable.attempts,
    })
    .from(outboxTable)
    .where(eq(outboxTable.status, "pending"))
    .limit(limit);
}

export async function markOutboxCompleted(db: PlatformSqliteDb, id: string): Promise<void> {
  await db.update(outboxTable).set({ status: "completed" }).where(eq(outboxTable.id, id));
}

export async function markOutboxFailed(
  db: PlatformSqliteDb,
  id: string,
  attempts: number,
  nextRetryAtIso: string,
): Promise<void> {
  await db
    .update(outboxTable)
    .set({ status: "failed", attempts, nextRetryAt: nextRetryAtIso })
    .where(eq(outboxTable.id, id));
}
