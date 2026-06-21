export type PosSettings = {
  servicePct: number;
  taxPct: number;
};

export const DEFAULT_POS_SETTINGS: PosSettings = {
  servicePct: 10,
  taxPct: 15,
};

export const POS_SETTINGS_CHANGED_EVENT = "pops-pos-settings-changed";

const STORAGE_KEY = "pops-pos-settings-v1";

function clampPct(value: number, max = 30): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function normalizePosSettings(input: Partial<PosSettings>): PosSettings {
  return {
    servicePct: clampPct(input.servicePct ?? DEFAULT_POS_SETTINGS.servicePct),
    taxPct: clampPct(input.taxPct ?? DEFAULT_POS_SETTINGS.taxPct),
  };
}

export function loadPosSettings(branchCode: string | undefined): PosSettings {
  if (!branchCode) return DEFAULT_POS_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POS_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<PosSettings>>;
    return normalizePosSettings(parsed[branchCode] ?? DEFAULT_POS_SETTINGS);
  } catch {
    return DEFAULT_POS_SETTINGS;
  }
}

export function savePosSettings(branchCode: string, settings: PosSettings): void {
  const next = normalizePosSettings(settings);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PosSettings>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(POS_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
    );
  } catch {
    // ignore storage errors
  }
}
