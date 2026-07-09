import { SyncEngine, listPendingOutbox } from "@platform/sync-engine";
import { isOnline } from "@platform/connectivity";
import { getApiBaseUrl } from "./apiBase";
import { getRuntimeDb, persistRuntimeDb } from "./runtimeDb";
import { shouldAutoSyncToCloud } from "../stores/dataModeStore";
import { useDataModeStore } from "../stores/dataModeStore";
import { createStoreSale } from "../store/api/store";
import {
  bumpOfflineAttempt,
  loadOfflineQueue,
  removeOfflineSale,
} from "../store/lib/storePosSync";

export type SyncSummary = {
  outboxPushed: number;
  salesSynced: number;
  salesFailed: number;
};

/** Push outbox rows and replay queued store POS sales to the hosted API. */
export async function flushAllOfflineData(accessToken: string): Promise<SyncSummary> {
  const summary: SyncSummary = { outboxPushed: 0, salesSynced: 0, salesFailed: 0 };

  if (!isOnline()) return summary;

  try {
    const { db } = await getRuntimeDb();
    const engine = new SyncEngine({ apiBaseUrl: getApiBaseUrl(), accessToken });
    const result = await engine.flushOnce(db);
    summary.outboxPushed = result.pushed;
    if (result.pushed > 0) await persistRuntimeDb();
  } catch {
    // SQLite / sync unavailable in some web contexts — store queue still flushes below.
  }

  for (const entry of loadOfflineQueue()) {
    try {
      await createStoreSale(entry.payload);
      removeOfflineSale(entry.id);
      summary.salesSynced += 1;
    } catch {
      bumpOfflineAttempt(entry.id);
      summary.salesFailed += 1;
    }
  }

  if (summary.salesSynced > 0 || summary.outboxPushed > 0) {
    useDataModeStore.getState().markSynced();
  }

  return summary;
}

/** Auto-sync only in cloud mode (local mode keeps data on device until manual sync). */
export async function autoSyncIfNeeded(accessToken: string): Promise<void> {
  if (!shouldAutoSyncToCloud()) return;
  await flushAllOfflineData(accessToken);
}

export async function countPendingOutbox(): Promise<number> {
  try {
    const { db } = await getRuntimeDb();
    const rows = await listPendingOutbox(db, 500);
    return rows.length;
  } catch {
    return 0;
  }
}
