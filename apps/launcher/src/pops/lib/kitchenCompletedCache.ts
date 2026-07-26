import type { KitchenTicket } from "@platform/contracts";

const STORAGE_KEY = "pops-kitchen-completed-v1";
const MAX_ENTRIES = 200;

type CachedCompletedTicket = KitchenTicket & { branchCode: string; completedAt: string };

function loadAll(): CachedCompletedTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is CachedCompletedTicket =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as CachedCompletedTicket).id === "string" &&
        typeof (row as CachedCompletedTicket).branchCode === "string",
    );
  } catch {
    return [];
  }
}

function saveAll(entries: CachedCompletedTicket[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore quota errors
  }
}

export function cacheKitchenCompleted(ticket: KitchenTicket, branchCode: string): void {
  const completedAt = new Date().toISOString();
  const entry: CachedCompletedTicket = {
    ...ticket,
    status: "done",
    branchCode,
    completedAt,
  };
  const next = [entry, ...loadAll().filter((row) => row.id !== ticket.id)];
  saveAll(next);
}

export function loadCachedKitchenCompleted(branchCodes: readonly string[]): KitchenTicket[] {
  const allowed = new Set(branchCodes);
  return loadAll()
    .filter((row) => allowed.has(row.branchCode))
    .map(({ branchCode: _branchCode, completedAt: _completedAt, ...ticket }) => ticket);
}

export function pruneCachedKitchenCompleted(remoteDoneIds: Set<string>): void {
  if (remoteDoneIds.size === 0) return;
  const next = loadAll().filter((row) => !remoteDoneIds.has(row.id));
  saveAll(next);
}
