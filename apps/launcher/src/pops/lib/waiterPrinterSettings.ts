import { resolvePrinterForUser, resolveReceiptPrinter } from "./printerRouting";

export type WaiterPrinterConfig = {
  /** Profile / station label shown in UI. */
  printerName: string;
  /** OS spooler name for direct print (when known). */
  systemPrinterName?: string;
};

export const WAITER_PRINTER_PRESETS = [
  "Waiter station 1",
  "Waiter station 2",
  "Waiter station 3",
  "Bar printer",
  "Patio printer",
] as const;

export const WAITER_PRINTER_SETTINGS_CHANGED_EVENT = "pops-waiter-printer-settings-changed";

const STORAGE_KEY = "pops-waiter-printers-v1";

function readAll(): Record<string, Record<string, WaiterPrinterConfig>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Record<string, WaiterPrinterConfig>>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Record<string, WaiterPrinterConfig>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

export function loadWaiterPrinterMap(branchCode: string | undefined): Record<string, WaiterPrinterConfig> {
  if (!branchCode) return {};
  return readAll()[branchCode] ?? {};
}

export function getWaiterPrinter(
  branchCode: string | undefined,
  waiterId: string | null | undefined,
): WaiterPrinterConfig | null {
  if (!branchCode || !waiterId) return null;
  const config = loadWaiterPrinterMap(branchCode)[waiterId];
  if (config?.printerName?.trim()) {
    const name = config.printerName.trim();
    // Legacy waiter map stores OS / station names used as the direct-print target.
    return { printerName: name, systemPrinterName: name };
  }

  // Fall back to Assign Users (many-to-many) profiles — never treat display name as OS name.
  const profile =
    resolveReceiptPrinter(branchCode, waiterId) ?? resolvePrinterForUser(branchCode, waiterId);
  if (profile) {
    return {
      printerName: profile.name,
      systemPrinterName: profile.systemPrinterName?.trim() || undefined,
    };
  }
  return null;
}

export function setWaiterPrinter(
  branchCode: string,
  waiterId: string,
  printerName: string,
): WaiterPrinterConfig {
  const all = readAll();
  const branchMap = { ...(all[branchCode] ?? {}) };
  const trimmed = printerName.trim();
  if (!trimmed) {
    delete branchMap[waiterId];
  } else {
    branchMap[waiterId] = { printerName: trimmed };
  }
  all[branchCode] = branchMap;
  writeAll(all);
  window.dispatchEvent(
    new CustomEvent(WAITER_PRINTER_SETTINGS_CHANGED_EVENT, {
      detail: { branchCode, waiterId, printerName: trimmed || null },
    }),
  );
  return branchMap[waiterId] ?? { printerName: "" };
}
