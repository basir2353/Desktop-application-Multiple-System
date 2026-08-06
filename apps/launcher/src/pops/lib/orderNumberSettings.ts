import { POS_ORDER_MODES, type PosOrderMode } from "./posOrderMode";

export type OrderNumberModeSettings = {
  /** First number issued for this sequence (e.g. 1 → first order is …-1). */
  startAt: number;
  /** Short prefix before the number (letters/digits, no spaces). */
  prefix: string;
};

export type OrderNumberSettings = {
  /** Shared prefix when not using separate sequences per order type. */
  prefix: string;
  /**
   * How many digits to show (pad with leading zeros).
   * 0 or 1 = no padding (ORD-7). 4 → ORD-0007.
   */
  digitCount: number;
  /** Shared start when separateByOrderType is off. */
  startAt: number;
  /** Independent counters + prefixes for dine-in / takeaway / etc. */
  separateByOrderType: boolean;
  byMode: Record<PosOrderMode, OrderNumberModeSettings>;
};

export const ORDER_NUMBER_SETTINGS_CHANGED_EVENT = "pops-order-number-settings-changed";

const STORAGE_KEY = "pops-order-number-settings-v1";

const DEFAULT_MODE_PREFIX: Record<PosOrderMode, string> = {
  "dine-in": "DI",
  takeaway: "TW",
  delivery: "DL",
  online: "ON",
  foodpanda: "FP",
  "staff-food": "SF",
};

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizePrefix(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned || fallback;
}

export function defaultOrderNumberSettings(): OrderNumberSettings {
  const byMode = {} as Record<PosOrderMode, OrderNumberModeSettings>;
  for (const { id } of POS_ORDER_MODES) {
    byMode[id] = { startAt: 1, prefix: DEFAULT_MODE_PREFIX[id] };
  }
  return {
    prefix: "ORD",
    digitCount: 0,
    startAt: 1,
    separateByOrderType: false,
    byMode,
  };
}

export function normalizeOrderNumberSettings(
  input?: Partial<OrderNumberSettings> | null,
): OrderNumberSettings {
  const base = defaultOrderNumberSettings();
  const byMode = { ...base.byMode };
  for (const { id } of POS_ORDER_MODES) {
    const row = input?.byMode?.[id];
    byMode[id] = {
      startAt: clampInt(row?.startAt ?? byMode[id].startAt, 1, 999_999_999, 1),
      prefix: sanitizePrefix(row?.prefix, DEFAULT_MODE_PREFIX[id]),
    };
  }
  return {
    prefix: sanitizePrefix(input?.prefix, "ORD"),
    digitCount: clampInt(input?.digitCount ?? 0, 0, 8, 0),
    startAt: clampInt(input?.startAt ?? 1, 1, 999_999_999, 1),
    separateByOrderType: Boolean(input?.separateByOrderType),
    byMode,
  };
}

function readAll(): Record<string, OrderNumberSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, OrderNumberSettings>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, OrderNumberSettings>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function branchKey(branchCode: string | undefined): string {
  return branchCode?.trim() || "__default__";
}

export function loadOrderNumberSettings(branchCode?: string): OrderNumberSettings {
  const all = readAll();
  return normalizeOrderNumberSettings(all[branchKey(branchCode)]);
}

export function saveOrderNumberSettings(
  branchCode: string | undefined,
  input: Partial<OrderNumberSettings>,
): OrderNumberSettings {
  const next = normalizeOrderNumberSettings(input);
  const all = readAll();
  all[branchKey(branchCode)] = next;
  writeAll(all);
  try {
    window.dispatchEvent(
      new CustomEvent(ORDER_NUMBER_SETTINGS_CHANGED_EVENT, {
        detail: { branchCode: branchKey(branchCode), settings: next },
      }),
    );
  } catch {
    // ignore
  }
  return next;
}

export function resolveOrderNumberModeSettings(
  settings: OrderNumberSettings,
  mode?: PosOrderMode | null,
): { prefix: string; startAt: number } {
  if (settings.separateByOrderType && mode) {
    const row = settings.byMode[mode] ?? defaultOrderNumberSettings().byMode[mode];
    return { prefix: row.prefix, startAt: row.startAt };
  }
  return { prefix: settings.prefix, startAt: settings.startAt };
}

/** Live preview for settings UI. */
export function previewOrderRef(
  settings: OrderNumberSettings,
  seq: number,
  mode?: PosOrderMode | null,
): string {
  const { prefix } = resolveOrderNumberModeSettings(settings, mode);
  const digits = Math.max(0, settings.digitCount);
  const n = Math.max(1, Math.floor(seq));
  const body = digits > 1 ? String(n).padStart(digits, "0") : String(n);
  return `${prefix}-${body}`.slice(0, 32);
}
