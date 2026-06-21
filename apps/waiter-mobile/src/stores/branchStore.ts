import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { PopsBranch } from "@platform/contracts";

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
    void SecureStore.setItemAsync(BRANCH_KEY, JSON.stringify(branch));
    set({ branch });
  },

  clear: () => {
    void SecureStore.deleteItemAsync(BRANCH_KEY);
    set({ branch: null });
  },

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(BRANCH_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }
    try {
      set({ branch: JSON.parse(raw) as PopsBranch, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
