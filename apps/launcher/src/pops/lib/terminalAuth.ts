/** Restrict POS access to registered / authorized terminals per branch. */

const STORAGE_KEY = "pops-authorized-terminals-v1";
const TERMINAL_ID_KEY = "pops-terminal-id";

export const TERMINAL_AUTH_CHANGED_EVENT = "pops-terminal-auth-changed";

function readAll(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function getOrCreateTerminalId(): string {
  try {
    const existing = localStorage.getItem(TERMINAL_ID_KEY);
    if (existing) return existing;
    const id = `term-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(TERMINAL_ID_KEY, id);
    return id;
  } catch {
    return "term-unknown";
  }
}

export function loadAuthorizedTerminals(branchCode: string | undefined): string[] {
  if (!branchCode) return [];
  return readAll()[branchCode] ?? [];
}

export function isTerminalRestrictionEnabled(branchCode: string | undefined): boolean {
  return loadAuthorizedTerminals(branchCode).length > 0;
}

export function isTerminalAuthorized(branchCode: string | undefined): boolean {
  if (!branchCode) return true;
  const allowed = loadAuthorizedTerminals(branchCode);
  if (allowed.length === 0) return true;
  return allowed.includes(getOrCreateTerminalId());
}

export function authorizeTerminal(branchCode: string, terminalId?: string): void {
  const id = terminalId ?? getOrCreateTerminalId();
  const all = readAll();
  const list = new Set(all[branchCode] ?? []);
  list.add(id);
  all[branchCode] = Array.from(list);
  writeAll(all);
  window.dispatchEvent(new CustomEvent(TERMINAL_AUTH_CHANGED_EVENT, { detail: { branchCode } }));
}

export function revokeTerminal(branchCode: string, terminalId: string): void {
  const all = readAll();
  all[branchCode] = (all[branchCode] ?? []).filter((id) => id !== terminalId);
  writeAll(all);
  window.dispatchEvent(new CustomEvent(TERMINAL_AUTH_CHANGED_EVENT, { detail: { branchCode } }));
}

export function clearTerminalRestrictions(branchCode: string): void {
  const all = readAll();
  delete all[branchCode];
  writeAll(all);
  window.dispatchEvent(new CustomEvent(TERMINAL_AUTH_CHANGED_EVENT, { detail: { branchCode } }));
}
