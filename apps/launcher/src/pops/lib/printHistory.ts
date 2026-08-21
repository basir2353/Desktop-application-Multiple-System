/** Local log of print attempts — per-branch, localStorage-backed.
 * Backs the "Print Queue" / "Today's print count" / Activity report views. */

export type PrintSource = "mobile" | "pc" | "unknown";

export type PrintKind = "kot" | "receipt" | "test" | "pra" | "fbr";

export type PrintOutcome = "ok" | "failed" | "timeout" | "slow";

export type PrintHistoryEntry = {
  id: string;
  at: string;
  kind: PrintKind;
  printerName?: string;
  orderRef?: string;
  ok: boolean;
  /** Where the job originated — mobile app vs desktop/PC. */
  source?: PrintSource;
  /** Raw device label from cloud/branch queue when available. */
  deviceLabel?: string;
  error?: string;
  /** Wall time from send to result when tracked locally. */
  durationMs?: number;
  outcome?: PrintOutcome;
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

export function classifyPrintSource(
  deviceLabel?: string | null,
  metaSource?: string | null,
): PrintSource {
  const s = `${deviceLabel ?? ""} ${metaSource ?? ""}`.toLowerCase();
  if (!s.trim()) return "unknown";
  if (s.includes("mobile") || s.includes("waiter") || s.includes("android") || s.includes("staff")) {
    return "mobile";
  }
  if (
    s.includes("desktop") ||
    s.includes("launcher") ||
    s.includes("pc") ||
    s.includes("windows") ||
    s.includes("pos")
  ) {
    return "pc";
  }
  return "unknown";
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
  const source =
    entry.source ??
    classifyPrintSource(entry.deviceLabel, undefined);
  const next: PrintHistoryEntry = {
    ...entry,
    source,
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

export function summarizePrintHistory(entries: PrintHistoryEntry[]): {
  total: number;
  mobile: number;
  pc: number;
  unknown: number;
  failed: number;
  missed: number;
} {
  let mobile = 0;
  let pc = 0;
  let unknown = 0;
  let failed = 0;
  for (const e of entries) {
    if (e.source === "mobile") mobile += 1;
    else if (e.source === "pc") pc += 1;
    else unknown += 1;
    if (!e.ok) failed += 1;
  }
  return {
    total: entries.length,
    mobile,
    pc,
    unknown,
    failed,
    missed: failed,
  };
}
