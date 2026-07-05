export type HappyHourTimeSlot = {
  id: string;
  startHour: number;
  endHour: number;
  /** Percentage off regular menu prices (0–100). */
  percentOff: number;
  bonusMenuItemId: string | null;
  bonusVariantId: string | null;
};

export type HappyHourSettings = {
  enabled: boolean;
  slots: HappyHourTimeSlot[];
};

export const DEFAULT_HAPPY_HOUR_SLOT: HappyHourTimeSlot = {
  id: "default",
  startHour: 17,
  endHour: 19,
  percentOff: 0,
  bonusMenuItemId: null,
  bonusVariantId: null,
};

export const DEFAULT_HAPPY_HOUR_SETTINGS: HappyHourSettings = {
  enabled: false,
  slots: [DEFAULT_HAPPY_HOUR_SLOT],
};

export const HAPPY_HOUR_SETTINGS_CHANGED_EVENT = "pops-happy-hour-settings-changed";

const STORAGE_KEY = "pops-happy-hour-settings-v2";

/** @deprecated Legacy shape kept for migration from v1 storage. */
type LegacyHappyHourSettings = {
  enabled?: boolean;
  startHour?: number;
  endHour?: number;
  bonusMenuItemId?: string | null;
  bonusVariantId?: string | null;
};

type RawHappyHourSettings = Partial<HappyHourSettings> & LegacyHappyHourSettings;

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(23, Math.round(value)));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createHappyHourSlotId(): string {
  return `slot-${Date.now().toString(36)}`;
}

export function normalizeHappyHourSlot(input: Partial<HappyHourTimeSlot>): HappyHourTimeSlot {
  return {
    id: input.id ?? createHappyHourSlotId(),
    startHour: clampHour(input.startHour ?? DEFAULT_HAPPY_HOUR_SLOT.startHour),
    endHour: clampHour(input.endHour ?? DEFAULT_HAPPY_HOUR_SLOT.endHour),
    percentOff: clampPercent(input.percentOff ?? 0),
    bonusMenuItemId: input.bonusMenuItemId ?? null,
    bonusVariantId: input.bonusVariantId ?? null,
  };
}

export function normalizeHappyHourSettings(input: RawHappyHourSettings): HappyHourSettings {
  if (input.slots && input.slots.length > 0) {
    return {
      enabled: input.enabled ?? false,
      slots: input.slots.map((slot) => normalizeHappyHourSlot(slot)),
    };
  }

  // Migrate legacy single-window settings.
  return {
    enabled: input.enabled ?? false,
    slots: [
      normalizeHappyHourSlot({
        id: "default",
        startHour: input.startHour ?? DEFAULT_HAPPY_HOUR_SLOT.startHour,
        endHour: input.endHour ?? DEFAULT_HAPPY_HOUR_SLOT.endHour,
        percentOff: 0,
        bonusMenuItemId: input.bonusMenuItemId ?? null,
        bonusVariantId: input.bonusVariantId ?? null,
      }),
    ],
  };
}

function loadRawSettings(branchCode: string): RawHappyHourSettings {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
      const parsed = JSON.parse(v2) as Record<string, RawHappyHourSettings>;
      return parsed[branchCode] ?? DEFAULT_HAPPY_HOUR_SETTINGS;
    }
    const v1 = localStorage.getItem("pops-happy-hour-settings-v1");
    if (v1) {
      const parsed = JSON.parse(v1) as Record<string, LegacyHappyHourSettings>;
      return parsed[branchCode] ?? DEFAULT_HAPPY_HOUR_SETTINGS;
    }
  } catch {
    // ignore
  }
  return DEFAULT_HAPPY_HOUR_SETTINGS;
}

export function loadHappyHourSettings(branchCode: string | undefined): HappyHourSettings {
  if (!branchCode) return DEFAULT_HAPPY_HOUR_SETTINGS;
  return normalizeHappyHourSettings(loadRawSettings(branchCode));
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

export function formatHourLabel(hour: number): string {
  const h = hour % 12 || 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h}:00 ${suffix}`;
}

export function formatHappyHourSlot(slot: HappyHourTimeSlot): string {
  return `${formatHourLabel(slot.startHour)} – ${formatHourLabel(slot.endHour)}`;
}

export function formatHappyHourSlotSummary(slot: HappyHourTimeSlot): string {
  const parts: string[] = [formatHappyHourSlot(slot)];
  if (slot.percentOff > 0) parts.push(`${slot.percentOff}% off`);
  if (slot.bonusMenuItemId) parts.push("free gift");
  return parts.join(" · ");
}

/** @deprecated Use formatHappyHourSlot on the active slot. */
export function formatHappyHourWindow(settings: HappyHourSettings): string {
  const slot = settings.slots[0];
  return slot ? formatHappyHourSlot(slot) : "—";
}

export function formatHappyHourSlots(settings: HappyHourSettings): string {
  if (settings.slots.length === 0) return "No slots configured";
  return settings.slots.map(formatHappyHourSlotSummary).join(" · ");
}
