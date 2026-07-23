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
import { createBillRemoteOnly } from "../pops/api/billing";
import { createKitchenTicketRemoteOnly } from "../pops/api/kitchen";
import { resumeOrders } from "../pops/api/closing";
import {
  bumpOfflineBillAttempt,
  bumpOfflineKotAttempt,
  clearOrdersForceOpen,
  loadOfflineBillEntries,
  loadOfflineKotEntries,
  removeOfflineBill,
  removeOfflineKot,
} from "../pops/lib/popsOfflineOrders";
import {
  bumpOfflineCashAttempt,
  bumpOfflinePayrollAttempt,
  loadOfflineCashMovements,
  loadOfflinePayrollRuns,
  removeOfflineCashMovement,
  removeOfflinePayrollRun,
} from "../pops/lib/offlineCashQueue";
import { recordCashMovement } from "../pops/api/accounting";
import { createHrPayrollRun } from "../pops/api/hr";

export type SyncSummary = {
  outboxPushed: number;
  salesSynced: number;
  salesFailed: number;
  popsOrdersSynced: number;
  popsOrdersFailed: number;
  cashSynced: number;
  cashFailed: number;
  payrollSynced: number;
  payrollFailed: number;
};

/** Push outbox rows and replay queued store POS + restaurant POS orders to the hosted API. */
export async function flushAllOfflineData(accessToken: string): Promise<SyncSummary> {
  const summary: SyncSummary = {
    outboxPushed: 0,
    salesSynced: 0,
    salesFailed: 0,
    popsOrdersSynced: 0,
    popsOrdersFailed: 0,
    cashSynced: 0,
    cashFailed: 0,
    payrollSynced: 0,
    payrollFailed: 0,
  };

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

  // Clear day-close pause once before replaying restaurant orders.
  const popsBills = loadOfflineBillEntries();
  const popsKots = loadOfflineKotEntries();
  if (popsBills.length > 0 || popsKots.length > 0) {
    const branchCode =
      popsBills[0]?.payload.branchCode ?? popsKots[0]?.payload.branchCode ?? "";
    if (branchCode) {
      try {
        await resumeOrders(branchCode);
      } catch {
        /* older API may lack resume — create still may succeed after server fix */
      }
    }
  }

  for (const entry of popsBills) {
    try {
      await createBillRemoteOnly(entry.payload);
      removeOfflineBill(entry.id);
      summary.popsOrdersSynced += 1;
    } catch {
      bumpOfflineBillAttempt(entry.id);
      summary.popsOrdersFailed += 1;
    }
  }

  for (const entry of popsKots) {
    try {
      await createKitchenTicketRemoteOnly(entry.payload);
      removeOfflineKot(entry.id);
      summary.popsOrdersSynced += 1;
    } catch {
      bumpOfflineKotAttempt(entry.id);
      summary.popsOrdersFailed += 1;
    }
  }

  for (const entry of loadOfflineCashMovements()) {
    try {
      await recordCashMovement(entry.payload);
      removeOfflineCashMovement(entry.id);
      summary.cashSynced += 1;
    } catch {
      bumpOfflineCashAttempt(entry.id);
      summary.cashFailed += 1;
    }
  }

  for (const entry of loadOfflinePayrollRuns()) {
    try {
      await createHrPayrollRun(entry.payload);
      removeOfflinePayrollRun(entry.id);
      summary.payrollSynced += 1;
    } catch {
      bumpOfflinePayrollAttempt(entry.id);
      summary.payrollFailed += 1;
    }
  }

  if (
    summary.salesSynced > 0 ||
    summary.outboxPushed > 0 ||
    summary.popsOrdersSynced > 0 ||
    summary.cashSynced > 0 ||
    summary.payrollSynced > 0
  ) {
    useDataModeStore.getState().markSynced();
    if (summary.popsOrdersFailed === 0 && loadOfflineBillEntries().length === 0) {
      clearOrdersForceOpen();
    }
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
