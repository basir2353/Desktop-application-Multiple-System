import type { CreateHrPayrollRun, CreatePopsCashMovement } from "@platform/contracts";

const CASH_KEY = "pops-offline-cash-movements-v1";
const PAYROLL_KEY = "pops-offline-payroll-runs-v1";

export type OfflineCashEntry = {
  id: string;
  createdAt: string;
  attempts: number;
  payload: CreatePopsCashMovement;
};

export type OfflinePayrollEntry = {
  id: string;
  createdAt: string;
  attempts: number;
  payload: CreateHrPayrollRun;
};

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

export function newClientRequestId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function queueOfflineCashMovement(payload: CreatePopsCashMovement): OfflineCashEntry {
  const entry: OfflineCashEntry = {
    id: payload.clientRequestId ?? newClientRequestId("cash"),
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload: {
      ...payload,
      clientRequestId: payload.clientRequestId ?? newClientRequestId("cash"),
    },
  };
  const rows = readJson<OfflineCashEntry>(CASH_KEY);
  rows.push(entry);
  writeJson(CASH_KEY, rows);
  return entry;
}

export function loadOfflineCashMovements(): OfflineCashEntry[] {
  return readJson<OfflineCashEntry>(CASH_KEY);
}

export function removeOfflineCashMovement(id: string): void {
  writeJson(
    CASH_KEY,
    readJson<OfflineCashEntry>(CASH_KEY).filter((e) => e.id !== id),
  );
}

export function bumpOfflineCashAttempt(id: string): void {
  writeJson(
    CASH_KEY,
    readJson<OfflineCashEntry>(CASH_KEY).map((e) =>
      e.id === id ? { ...e, attempts: e.attempts + 1 } : e,
    ),
  );
}

export function queueOfflinePayrollRun(payload: CreateHrPayrollRun): OfflinePayrollEntry {
  const entry: OfflinePayrollEntry = {
    id: payload.clientRequestId ?? newClientRequestId("pay"),
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload: {
      ...payload,
      clientRequestId: payload.clientRequestId ?? newClientRequestId("pay"),
    },
  };
  const rows = readJson<OfflinePayrollEntry>(PAYROLL_KEY);
  rows.push(entry);
  writeJson(PAYROLL_KEY, rows);
  return entry;
}

export function loadOfflinePayrollRuns(): OfflinePayrollEntry[] {
  return readJson<OfflinePayrollEntry>(PAYROLL_KEY);
}

export function removeOfflinePayrollRun(id: string): void {
  writeJson(
    PAYROLL_KEY,
    readJson<OfflinePayrollEntry>(PAYROLL_KEY).filter((e) => e.id !== id),
  );
}

export function bumpOfflinePayrollAttempt(id: string): void {
  writeJson(
    PAYROLL_KEY,
    readJson<OfflinePayrollEntry>(PAYROLL_KEY).map((e) =>
      e.id === id ? { ...e, attempts: e.attempts + 1 } : e,
    ),
  );
}

export function isLikelyOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /failed to fetch|networkerror|network request failed|offline|timeout|ECONNREFUSED|ERR_NETWORK/i.test(
      msg,
    ) || msg === "Load failed"
  );
}
