export type BusinessDaySettings = {
  dayStart: string;
  dayEnd: string;
};

export const DEFAULT_BUSINESS_DAY: BusinessDaySettings = {
  dayStart: "00:00",
  dayEnd: "23:59",
};

const STORAGE_KEY = "pops-business-day-v1";

export const BUSINESS_DAY_CHANGED_EVENT = "pops-business-day-changed";

export function normalizeBusinessDaySettings(input: Partial<BusinessDaySettings>): BusinessDaySettings {
  const dayStart = normalizeTime(input.dayStart ?? DEFAULT_BUSINESS_DAY.dayStart);
  const dayEnd = normalizeTime(input.dayEnd ?? DEFAULT_BUSINESS_DAY.dayEnd);
  return { dayStart, dayEnd };
}

function normalizeTime(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "00:00";
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function loadBusinessDaySettings(branchCode: string | undefined): BusinessDaySettings {
  if (!branchCode) return DEFAULT_BUSINESS_DAY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUSINESS_DAY;
    const parsed = JSON.parse(raw) as Record<string, Partial<BusinessDaySettings>>;
    return normalizeBusinessDaySettings(parsed[branchCode] ?? DEFAULT_BUSINESS_DAY);
  } catch {
    return DEFAULT_BUSINESS_DAY;
  }
}

export function saveBusinessDaySettings(branchCode: string, settings: BusinessDaySettings): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, BusinessDaySettings>) : {};
    parsed[branchCode] = normalizeBusinessDaySettings(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(BUSINESS_DAY_CHANGED_EVENT, { detail: { branchCode, settings: parsed[branchCode] } }),
    );
  } catch {
    // ignore storage errors
  }
}

export function formatBusinessDayRange(settings: BusinessDaySettings): string {
  const { dayStart, dayEnd } = normalizeBusinessDaySettings(settings);
  if (dayStart === "00:00" && dayEnd === "23:59") return "Midnight – midnight";
  return `${dayStart} – ${dayEnd}`;
}
