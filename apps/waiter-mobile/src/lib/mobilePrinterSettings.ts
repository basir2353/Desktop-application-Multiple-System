import { secureGet, secureSet } from "./secureStorage";

export const MAX_KITCHEN_PRINTERS = 4;

export type MobilePrinterSettings = {
  /** Up to 4 kitchen / station printer display names (Android print dialog hint). */
  kitchenPrinters: string[];
  /** Cashier / customer bill printer display name. */
  billPrinter: string;
  /** Auto-print on Order / Pay — default ON. */
  autoPrint: boolean;
  /** Silent print via manual PC IP (LAN :9740). */
  modeIp: boolean;
  /** Silent print via discovered / preferred branch print server. */
  modeServer: boolean;
  /** Silent print via live API → desktop EXE claim. */
  modeLive: boolean;
};

const STORAGE_KEY = "waiter-mobile-printers-v1";

export const DEFAULT_MOBILE_PRINTER_SETTINGS: MobilePrinterSettings = {
  kitchenPrinters: ["Kitchen 1", "", "", ""],
  billPrinter: "Cashier / Billing",
  autoPrint: true,
  /** Defaults: Live only. Enabling multiple modes no longer cascades (see printDedupe). */
  modeIp: false,
  modeServer: false,
  modeLive: true,
};

function normalize(raw: Partial<MobilePrinterSettings> | null | undefined): MobilePrinterSettings {
  const kitchen = Array.isArray(raw?.kitchenPrinters)
    ? raw!.kitchenPrinters.map((n) => String(n ?? "").trim()).slice(0, MAX_KITCHEN_PRINTERS)
    : [];
  while (kitchen.length < MAX_KITCHEN_PRINTERS) kitchen.push("");
  return {
    kitchenPrinters: kitchen,
    billPrinter: String(raw?.billPrinter ?? DEFAULT_MOBILE_PRINTER_SETTINGS.billPrinter).trim(),
    autoPrint: raw?.autoPrint !== false,
    modeIp:
      typeof raw?.modeIp === "boolean" ? raw.modeIp : DEFAULT_MOBILE_PRINTER_SETTINGS.modeIp,
    modeServer:
      typeof raw?.modeServer === "boolean"
        ? raw.modeServer
        : DEFAULT_MOBILE_PRINTER_SETTINGS.modeServer,
    modeLive:
      typeof raw?.modeLive === "boolean" ? raw.modeLive : DEFAULT_MOBILE_PRINTER_SETTINGS.modeLive,
  };
}

export async function loadMobilePrinterSettings(): Promise<MobilePrinterSettings> {
  try {
    const raw = await secureGet(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_MOBILE_PRINTER_SETTINGS,
        kitchenPrinters: [...DEFAULT_MOBILE_PRINTER_SETTINGS.kitchenPrinters],
      };
    }
    return normalize(JSON.parse(raw) as Partial<MobilePrinterSettings>);
  } catch {
    return {
      ...DEFAULT_MOBILE_PRINTER_SETTINGS,
      kitchenPrinters: [...DEFAULT_MOBILE_PRINTER_SETTINGS.kitchenPrinters],
    };
  }
}

export async function saveMobilePrinterSettings(settings: MobilePrinterSettings): Promise<void> {
  const next = normalize(settings);
  await secureSet(STORAGE_KEY, JSON.stringify(next));
}

export function activeKitchenPrinters(settings: MobilePrinterSettings): string[] {
  return settings.kitchenPrinters.map((n) => n.trim()).filter(Boolean);
}
