import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DataMode = "cloud" | "local";

/** Which API host the desktop/web client calls (works in installed .exe). */
export type ApiPreset = "live" | "local" | "custom";

type DataModeState = {
  dataMode: DataMode;
  /** Live / local / custom API selection for installed apps. */
  apiPreset: ApiPreset;
  /** Custom API URL when apiPreset is "custom". */
  cloudApiUrl: string;
  lastSyncedAt: string | null;
  setDataMode: (mode: DataMode) => void;
  setApiPreset: (preset: ApiPreset) => void;
  setCloudApiUrl: (url: string) => void;
  markSynced: () => void;
};

export const useDataModeStore = create<DataModeState>()(
  persist(
    (set) => ({
      dataMode: "cloud",
      apiPreset: "live",
      cloudApiUrl: "",
      lastSyncedAt: null,
      setDataMode: (dataMode) => set({ dataMode }),
      setApiPreset: (apiPreset) => set({ apiPreset }),
      setCloudApiUrl: (cloudApiUrl) => set({ cloudApiUrl: cloudApiUrl.trim().replace(/\/$/, "") }),
      markSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
    }),
    { name: "platform-data-mode-v2" },
  ),
);

export function isCloudDataMode(): boolean {
  return useDataModeStore.getState().dataMode === "cloud";
}

export function isLocalDataMode(): boolean {
  return useDataModeStore.getState().dataMode === "local";
}

export function shouldAutoSyncToCloud(): boolean {
  return isCloudDataMode();
}
