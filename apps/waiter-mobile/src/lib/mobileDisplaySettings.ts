import { secureGet, secureSet } from "./secureStorage";

export type MobileDisplaySettings = {
  /** Show Full Screen Menu button after order type is selected. */
  fullScreenMenuEnabled: boolean;
  /** Default browse mode inside full-screen / menu. */
  menuViewMode: "category" | "all";
};

const STORAGE_KEY = "waiter-mobile-display-v1";

export const DEFAULT_MOBILE_DISPLAY_SETTINGS: MobileDisplaySettings = {
  fullScreenMenuEnabled: false,
  menuViewMode: "category",
};

function normalize(raw: Partial<MobileDisplaySettings> | null | undefined): MobileDisplaySettings {
  return {
    fullScreenMenuEnabled: raw?.fullScreenMenuEnabled === true,
    menuViewMode: raw?.menuViewMode === "all" ? "all" : "category",
  };
}

export async function loadMobileDisplaySettings(): Promise<MobileDisplaySettings> {
  try {
    const raw = await secureGet(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MOBILE_DISPLAY_SETTINGS };
    return normalize(JSON.parse(raw) as Partial<MobileDisplaySettings>);
  } catch {
    return { ...DEFAULT_MOBILE_DISPLAY_SETTINGS };
  }
}

export async function saveMobileDisplaySettings(
  settings: MobileDisplaySettings,
): Promise<MobileDisplaySettings> {
  const next = normalize(settings);
  await secureSet(STORAGE_KEY, JSON.stringify(next));
  return next;
}
