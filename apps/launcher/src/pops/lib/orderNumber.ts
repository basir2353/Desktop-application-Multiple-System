import type { PosOrderMode } from "./posOrderMode";
import {
  loadOrderNumberSettings,
  previewOrderRef,
  resolveOrderNumberModeSettings,
  type OrderNumberSettings,
} from "./orderNumberSettings";

const STORAGE_KEY = "pops-pos-order-seq-v2";
const LEGACY_STORAGE_KEY = "pops-pos-order-seq-v1";

type CounterState = {
  shared: number;
  byMode: Partial<Record<PosOrderMode, number>>;
};

function branchKey(branchCode: string | undefined): string {
  return branchCode?.trim() || "__default__";
}

function emptyState(): CounterState {
  return { shared: 0, byMode: {} };
}

function readAll(): Record<string, CounterState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, CounterState | number>;
      const out: Record<string, CounterState> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "number") {
          out[key] = { shared: Math.max(0, Math.floor(value)), byMode: {} };
        } else if (value && typeof value === "object") {
          out[key] = {
            shared: Math.max(0, Math.floor(Number(value.shared) || 0)),
            byMode: value.byMode ?? {},
          };
        }
      }
      return out;
    }
  } catch {
    // fall through to legacy
  }

  // Migrate flat v1 counters once.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return {};
    const legacy = JSON.parse(legacyRaw) as Record<string, number>;
    const migrated: Record<string, CounterState> = {};
    for (const [key, value] of Object.entries(legacy)) {
      migrated[key] = { shared: Math.max(0, Math.floor(Number(value) || 0)), byMode: {} };
    }
    writeAll(migrated);
    return migrated;
  } catch {
    return {};
  }
}

function writeAll(counters: Record<string, CounterState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
  } catch {
    // ignore storage errors
  }
}

function getState(branchCode: string | undefined): CounterState {
  const all = readAll();
  return all[branchKey(branchCode)] ?? emptyState();
}

function setState(branchCode: string | undefined, state: CounterState): void {
  const all = readAll();
  all[branchKey(branchCode)] = state;
  writeAll(all);
}

function counterSlot(
  settings: OrderNumberSettings,
  mode?: PosOrderMode | null,
): "shared" | PosOrderMode {
  if (settings.separateByOrderType && mode) return mode;
  return "shared";
}

function readCounter(
  state: CounterState,
  settings: OrderNumberSettings,
  mode?: PosOrderMode | null,
): number {
  const slot = counterSlot(settings, mode);
  if (slot === "shared") return state.shared;
  return state.byMode[slot] ?? 0;
}

function writeCounter(
  state: CounterState,
  settings: OrderNumberSettings,
  mode: PosOrderMode | null | undefined,
  value: number,
): CounterState {
  const next = Math.max(0, Math.floor(value));
  const slot = counterSlot(settings, mode);
  if (slot === "shared") return { ...state, shared: next };
  return { ...state, byMode: { ...state.byMode, [slot]: next } };
}

/**
 * Ensure the next issued number will be at least `startAt`.
 * Call after saving settings so "start from" takes effect immediately.
 */
export function applyOrderNumberStart(
  branchCode: string | undefined,
  settings?: OrderNumberSettings,
  mode?: PosOrderMode | null,
): void {
  const cfg = settings ?? loadOrderNumberSettings(branchCode);
  const { startAt } = resolveOrderNumberModeSettings(cfg, mode);
  const floor = Math.max(0, startAt - 1);
  const state = getState(branchCode);
  const current = readCounter(state, cfg, mode);
  if (current < floor) {
    setState(branchCode, writeCounter(state, cfg, mode, floor));
  }
}

export function formatOrderRef(
  seq: number,
  branchCode?: string,
  mode?: PosOrderMode | null,
  settings?: OrderNumberSettings,
): string {
  const cfg = settings ?? loadOrderNumberSettings(branchCode);
  return previewOrderRef(cfg, seq, mode);
}

/** Parse trailing digits from `ORD-150`, `DI-0007`, etc. */
export function parseOrderRefSeq(ref: string | null | undefined): number | null {
  const match = (ref ?? "").trim().match(/(\d+)\s*$/);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Bump local counter so the next # is above known tickets/bills. */
export function ensureOrderSeqAtLeast(
  branchCode: string | undefined,
  minSeq: number,
  mode?: PosOrderMode | null,
): void {
  if (!Number.isFinite(minSeq) || minSeq <= 0) return;
  const cfg = loadOrderNumberSettings(branchCode);
  const state = getState(branchCode);
  const current = readCounter(state, cfg, mode);
  if (minSeq > current) {
    setState(branchCode, writeCounter(state, cfg, mode, minSeq));
  }
}

/** Returns the next order ref without consuming the counter (preview). */
export function peekNextOrderRef(
  branchCode: string | undefined,
  mode?: PosOrderMode | null,
): string {
  const cfg = loadOrderNumberSettings(branchCode);
  const { startAt } = resolveOrderNumberModeSettings(cfg, mode);
  const state = getState(branchCode);
  const current = readCounter(state, cfg, mode);
  const floor = Math.max(0, startAt - 1);
  const next = Math.max(current, floor) + 1;
  return formatOrderRef(next, branchCode, mode, cfg);
}

/** Consumes and returns the next sequential order ref. */
export function nextOrderRef(
  branchCode: string | undefined,
  mode?: PosOrderMode | null,
): string {
  const cfg = loadOrderNumberSettings(branchCode);
  const { startAt } = resolveOrderNumberModeSettings(cfg, mode);
  const state = getState(branchCode);
  const current = readCounter(state, cfg, mode);
  const floor = Math.max(0, startAt - 1);
  const next = Math.max(current, floor) + 1;
  setState(branchCode, writeCounter(state, cfg, mode, next));
  return formatOrderRef(next, branchCode, mode, cfg);
}
