/** Per-branch settings for automatic low-stock quantity notifications. */

export type StockAlertSettings = {
  /** When false, low-stock toasts / push alerts are suppressed. */
  autoNotifyEnabled: boolean;
  /**
   * Alert when stock is at or below this many units above the ingredient reorder level.
   * 0 = alert exactly at reorder level (default API behavior).
   * Example: reorder=10 and buffer=2 → alert when stock ≤ 12.
   */
  notifyBufferQty: number;
};

export const DEFAULT_STOCK_ALERT_SETTINGS: StockAlertSettings = {
  autoNotifyEnabled: true,
  notifyBufferQty: 0,
};

export const STOCK_ALERT_SETTINGS_CHANGED_EVENT = "pops-stock-alert-settings-changed";

const STORAGE_KEY = "pops-stock-alert-settings-v1";

export function normalizeStockAlertSettings(
  input: Partial<StockAlertSettings>,
): StockAlertSettings {
  return {
    autoNotifyEnabled: input.autoNotifyEnabled ?? true,
    notifyBufferQty: Math.max(0, Math.min(10_000, Math.round(input.notifyBufferQty ?? 0))),
  };
}

export function loadStockAlertSettings(branchCode: string | undefined): StockAlertSettings {
  if (!branchCode) return DEFAULT_STOCK_ALERT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STOCK_ALERT_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<StockAlertSettings>>;
    const stored = parsed[branchCode];
    return stored ? normalizeStockAlertSettings(stored) : DEFAULT_STOCK_ALERT_SETTINGS;
  } catch {
    return DEFAULT_STOCK_ALERT_SETTINGS;
  }
}

export function saveStockAlertSettings(branchCode: string, settings: StockAlertSettings): void {
  const next = normalizeStockAlertSettings(settings);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StockAlertSettings>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(STOCK_ALERT_SETTINGS_CHANGED_EVENT, {
        detail: { branchCode, settings: next },
      }),
    );
  } catch {
    // ignore storage errors
  }
}
