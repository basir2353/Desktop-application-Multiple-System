import { SyncEngine } from "@platform/sync-engine";
import { isOnline } from "@platform/connectivity";
import { getApiBaseUrl } from "./apiBase";
import { getRuntimeDb } from "./runtimeDb";
import { createStoreSale } from "../store/api/store";
import {
  bumpOfflineAttempt,
  loadOfflineQueue,
  removeOfflineSale,
} from "../store/lib/storePosSync";

/** Push outbox rows and replay queued store POS sales when back online. */
export async function flushAllOfflineData(accessToken: string): Promise<void> {
  if (!isOnline()) return;

  try {
    const { db } = await getRuntimeDb();
    const engine = new SyncEngine({ apiBaseUrl: getApiBaseUrl(), accessToken });
    await engine.flushOnce(db);
  } catch {
    // SQLite / sync unavailable in some web contexts — store queue still flushes below.
  }

  for (const entry of loadOfflineQueue()) {
    try {
      await createStoreSale(entry.payload);
      removeOfflineSale(entry.id);
    } catch {
      bumpOfflineAttempt(entry.id);
    }
  }
}
