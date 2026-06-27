import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type BusinessSystemId,
  getBusinessSystem,
  isBusinessSystemId,
} from "../lib/businessSystems";

type SystemState = {
  systemId: BusinessSystemId | null;
  setSystem: (id: BusinessSystemId) => void;
  clearSystem: () => void;
};

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      systemId: null,
      setSystem: (systemId) => set({ systemId }),
      clearSystem: () => set({ systemId: null }),
    }),
    {
      name: "platform-system-v1",
      partialize: (s) => ({ systemId: s.systemId }),
    },
  ),
);

export function useActiveBusinessSystem() {
  const systemId = useSystemStore((s) => s.systemId);
  return systemId ? getBusinessSystem(systemId) : null;
}

export function readPersistedSystemId(): BusinessSystemId | null {
  try {
    const raw = localStorage.getItem("platform-system-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { systemId?: string } };
    const id = parsed.state?.systemId;
    return id && isBusinessSystemId(id) ? id : null;
  } catch {
    return null;
  }
}
