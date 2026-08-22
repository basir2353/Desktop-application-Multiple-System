import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type BusinessSystemId,
  getBusinessSystem,
  isBusinessSystemId,
} from "../lib/businessSystems";
import { getEffectiveSystemLock } from "../lib/deviceInstall";

type SystemState = {
  systemId: BusinessSystemId | null;
  setSystem: (id: BusinessSystemId) => void;
  clearSystem: () => void;
};

// Single-system installers lock the store to their baked-in edition, and a
// device that already has a system installed stays on that system. The picker
// and any "switch system" action become no-ops so only that system is visible.
// Read the lock on each call so `/?reset-install=1` can unlock without a stale
// module-level snapshot from first import.
export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      systemId: getEffectiveSystemLock(),
      setSystem: (systemId) => set({ systemId: getEffectiveSystemLock() ?? systemId }),
      clearSystem: () => set({ systemId: getEffectiveSystemLock() }),
    }),
    {
      name: "platform-system-v1",
      partialize: (s) => ({ systemId: s.systemId }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SystemState>;
        const lockedSystemId = getEffectiveSystemLock();
        // A locked edition always wins over any previously persisted selection.
        if (lockedSystemId) {
          return { ...current, ...p, systemId: lockedSystemId };
        }
        const persistedId =
          p.systemId && isBusinessSystemId(p.systemId) ? p.systemId : null;
        const currentId =
          current.systemId && isBusinessSystemId(current.systemId)
            ? current.systemId
            : null;
        // Prefer an in-memory selection set before rehydration finishes; otherwise
        // async hydrate can overwrite setSystem() and bounce the user back to "/".
        return {
          ...current,
          ...p,
          systemId: currentId ?? persistedId ?? null,
        };
      },
    },
  ),
);

export function useActiveBusinessSystem() {
  const systemId = useSystemStore((s) => s.systemId);
  return systemId ? getBusinessSystem(systemId) : null;
}

export function readPersistedSystemId(): BusinessSystemId | null {
  const locked = getEffectiveSystemLock();
  if (locked) return locked;
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
