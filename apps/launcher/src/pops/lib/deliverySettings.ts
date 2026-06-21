export type DeliverySettings = {
  defaultChargePkr: number;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  defaultChargePkr: 150,
};

export const DELIVERY_SETTINGS_CHANGED_EVENT = "pops-delivery-settings-changed";

const STORAGE_KEY = "pops-delivery-settings-v1";

function clampCharge(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(50_000, Math.round(value)));
}

export function normalizeDeliverySettings(input: Partial<DeliverySettings>): DeliverySettings {
  return {
    defaultChargePkr: clampCharge(input.defaultChargePkr ?? DEFAULT_DELIVERY_SETTINGS.defaultChargePkr),
  };
}

export function loadDeliverySettings(branchCode: string | undefined): DeliverySettings {
  if (!branchCode) return DEFAULT_DELIVERY_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DELIVERY_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<DeliverySettings>>;
    return normalizeDeliverySettings(parsed[branchCode] ?? DEFAULT_DELIVERY_SETTINGS);
  } catch {
    return DEFAULT_DELIVERY_SETTINGS;
  }
}

export function saveDeliverySettings(branchCode: string, settings: DeliverySettings): void {
  const next = normalizeDeliverySettings(settings);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, DeliverySettings>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(DELIVERY_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
    );
  } catch {
    // ignore storage errors
  }
}
