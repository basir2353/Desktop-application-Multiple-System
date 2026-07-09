import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DataMode = "cloud" | "local";

type DataModeState = {
  dataMode: DataMode;
  /** Runtime API URL — overrides VITE_API_BASE_URL when set (cloud mode). */
  cloudApiUrl: string;
  lastSyncedAt: string | null;
  setDataMode: (mode: DataMode) => void;
  setCloudApiUrl: (url: string) => void;
  markSynced: () => void;
};

export const useDataModeStore = create<DataModeState>()(
  persist(
    (set) => ({
      dataMode: "cloud",
      cloudApiUrl: "",
      lastSyncedAt: null,
      setDataMode: (dataMode) => set({ dataMode }),
      setCloudApiUrl: (cloudApiUrl) => set({ cloudApiUrl: cloudApiUrl.trim().replace(/\/$/, "") }),
      markSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
    }),
    { name: "platform-data-mode-v1" },
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
