/** Per-branch 4-digit PIN map for quick staff login (admin configures in Users). */

const STORAGE_KEY = "pops-user-pins-v1";

export const POS_PIN_CHANGED_EVENT = "pops-user-pin-changed";

function readAll(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Record<string, string>>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Record<string, string>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function setUserPin(branchCode: string, userId: string, pin: string): void {
  const all = readAll();
  const branch = { ...(all[branchCode] ?? {}) };
  if (!isValidPin(pin)) {
    delete branch[userId];
  } else {
    branch[userId] = pin;
  }
  all[branchCode] = branch;
  writeAll(all);
  window.dispatchEvent(new CustomEvent(POS_PIN_CHANGED_EVENT, { detail: { branchCode, userId } }));
}

export function getUserPin(branchCode: string, userId: string): string | null {
  return readAll()[branchCode]?.[userId] ?? null;
}

export function loadBranchPinMap(branchCode: string | undefined): Record<string, string> {
  if (!branchCode) return {};
  return readAll()[branchCode] ?? {};
}

/** Find user id by 4-digit PIN within a branch. */
export function findUserIdByPin(branchCode: string, pin: string): string | null {
  if (!isValidPin(pin)) return null;
  const map = loadBranchPinMap(branchCode);
  for (const [userId, stored] of Object.entries(map)) {
    if (stored === pin) return userId;
  }
  return null;
}
