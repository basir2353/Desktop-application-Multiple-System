/** Local log of print attempts — per-branch, localStorage-backed. There is no real
 * async print queue (printing is synchronous, dialog-based), so this history log is
 * what backs the "Print Queue" / "Today's print count" views. */

export type PrintHistoryEntry = {
  id: string;
  at: string;
  kind: "kot" | "receipt" | "test";
  printerName?: string;
  orderRef?: string;
  ok: boolean;
};

export const PRINT_HISTORY_CHANGED_EVENT = "pops-print-history-changed";

const STORAGE_KEY = "pops-print-history-v1";
const MAX_ENTRIES_PER_BRANCH = 200;

function readAll(): Record<string, PrintHistoryEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PrintHistoryEntry[]>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PrintHistoryEntry[]>, branchCode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(PRINT_HISTORY_CHANGED_EVENT, { detail: { branchCode } }));
  } catch {
    // ignore storage errors
  }
}

export function loadPrintHistory(branchCode: string | undefined): PrintHistoryEntry[] {
  if (!branchCode) return [];
  const all = readAll();
  return all[branchCode] ?? [];
}

export function logPrintEvent(
  branchCode: string | undefined,
  entry: Omit<PrintHistoryEntry, "id" | "at">,
): void {
  if (!branchCode) return;
  const all = readAll();
  const existing = all[branchCode] ?? [];
  const next: PrintHistoryEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  };
  all[branchCode] = [next, ...existing].slice(0, MAX_ENTRIES_PER_BRANCH);
  writeAll(all, branchCode);
}

export function clearPrintHistory(branchCode: string): void {
  const all = readAll();
  all[branchCode] = [];
  writeAll(all, branchCode);
}

export function todaysPrintCount(branchCode: string | undefined): number {
  const today = new Date().toISOString().slice(0, 10);
  return loadPrintHistory(branchCode).filter((e) => e.at.slice(0, 10) === today).length;
}
