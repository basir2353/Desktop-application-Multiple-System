import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type BusinessSystemId,
  getBusinessSystem,
  isBusinessSystemId,
} from "../lib/businessSystems";
import { getLockedSystemId } from "../lib/edition";

type SystemState = {
  systemId: BusinessSystemId | null;
  setSystem: (id: BusinessSystemId) => void;
  clearSystem: () => void;
};

// Single-system installers lock the store to their baked-in edition. The picker
// and any "switch system" action become no-ops so only that system is visible.
const lockedSystemId = getLockedSystemId();

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      systemId: lockedSystemId,
      setSystem: (systemId) => set({ systemId: lockedSystemId ?? systemId }),
      clearSystem: () => set({ systemId: lockedSystemId }),
    }),
    {
      name: "platform-system-v1",
      partialize: (s) => ({ systemId: s.systemId }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<SystemState>) };
        // A locked edition always wins over any previously persisted selection.
        if (lockedSystemId) merged.systemId = lockedSystemId;
        return merged;
      },
    },
  ),
);

export function useActiveBusinessSystem() {
  const systemId = useSystemStore((s) => s.systemId);
  return systemId ? getBusinessSystem(systemId) : null;
}

export function readPersistedSystemId(): BusinessSystemId | null {
  if (lockedSystemId) return lockedSystemId;
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
