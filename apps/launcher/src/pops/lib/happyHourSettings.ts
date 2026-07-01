export type HappyHourSettings = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  bonusMenuItemId: string | null;
  bonusVariantId: string | null;
};

export const DEFAULT_HAPPY_HOUR_SETTINGS: HappyHourSettings = {
  enabled: false,
  startHour: 17,
  endHour: 19,
  bonusMenuItemId: null,
  bonusVariantId: null,
};

export const HAPPY_HOUR_SETTINGS_CHANGED_EVENT = "pops-happy-hour-settings-changed";

const STORAGE_KEY = "pops-happy-hour-settings-v1";

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(23, Math.round(value)));
}

export function normalizeHappyHourSettings(input: Partial<HappyHourSettings>): HappyHourSettings {
  return {
    enabled: input.enabled ?? DEFAULT_HAPPY_HOUR_SETTINGS.enabled,
    startHour: clampHour(input.startHour ?? DEFAULT_HAPPY_HOUR_SETTINGS.startHour),
    endHour: clampHour(input.endHour ?? DEFAULT_HAPPY_HOUR_SETTINGS.endHour),
    bonusMenuItemId: input.bonusMenuItemId ?? null,
    bonusVariantId: input.bonusVariantId ?? null,
  };
}

export function loadHappyHourSettings(branchCode: string | undefined): HappyHourSettings {
  if (!branchCode) return DEFAULT_HAPPY_HOUR_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HAPPY_HOUR_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<HappyHourSettings>>;
    return normalizeHappyHourSettings(parsed[branchCode] ?? DEFAULT_HAPPY_HOUR_SETTINGS);
  } catch {
    return DEFAULT_HAPPY_HOUR_SETTINGS;
  }
}

export function saveHappyHourSettings(branchCode: string, settings: HappyHourSettings): void {
  const next = normalizeHappyHourSettings(settings);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, HappyHourSettings>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(HAPPY_HOUR_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
    );
  } catch {
    // ignore storage errors
  }
}

export function formatHappyHourWindow(settings: HappyHourSettings): string {
  const fmt = (hour: number) => {
    const h = hour % 12 || 12;
    const suffix = hour < 12 ? "AM" : "PM";
    return `${h}:00 ${suffix}`;
  };
  return `${fmt(settings.startHour)} – ${fmt(settings.endHour)}`;
}
