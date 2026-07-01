const STORAGE_KEY = "pops-pos-order-seq-v1";

function branchKey(branchCode: string | undefined): string {
  return branchCode?.trim() || "__default__";
}

function readCounters(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeCounters(counters: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
  } catch {
    // ignore storage errors
  }
}

export function formatOrderRef(seq: number): string {
  return `ORD-${seq}`;
}

/** Returns the next order ref without consuming the counter (preview). */
export function peekNextOrderRef(branchCode: string | undefined): string {
  const counters = readCounters();
  const current = counters[branchKey(branchCode)] ?? 0;
  return formatOrderRef(current + 1);
}

/** Consumes and returns the next sequential order ref, starting from 1. */
export function nextOrderRef(branchCode: string | undefined): string {
  const counters = readCounters();
  const key = branchKey(branchCode);
  const next = (counters[key] ?? 0) + 1;
  counters[key] = next;
  writeCounters(counters);
  return formatOrderRef(next);
}
