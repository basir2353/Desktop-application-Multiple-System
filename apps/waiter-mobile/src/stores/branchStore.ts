import { create } from "zustand";
import type { PopsBranch } from "@platform/contracts";
import { secureDelete, secureGet, secureSet } from "../lib/secureStorage";

const BRANCH_KEY = "pops-waiter-branch";

type BranchState = {
  branch: PopsBranch | null;
  hydrated: boolean;
  setBranch: (branch: PopsBranch) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

export const useBranchStore = create<BranchState>((set) => ({
  branch: null,
  hydrated: false,

  setBranch: (branch) => {
    void secureSet(BRANCH_KEY, JSON.stringify(branch));
    set({ branch });
  },

  clear: () => {
    void secureDelete(BRANCH_KEY);
    set({ branch: null });
  },

  hydrate: async () => {
    try {
      const raw = await secureGet(BRANCH_KEY);
      if (!raw) {
        set({ hydrated: true });
        return;
      }
      try {
        set({ branch: JSON.parse(raw) as PopsBranch, hydrated: true });
      } catch {
        set({ branch: null, hydrated: true });
      }
    } catch (err) {
      console.warn("[branchStore] hydrate failed:", err);
      set({ branch: null, hydrated: true });
    }
  },
}));
