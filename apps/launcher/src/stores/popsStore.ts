import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PopsBranch = {
  id: string;
  name: string;
  city: string;
  code: string;
};

export type PopsRole =
  | "admin"
  | "cashier"
  | "waiter"
  | "kitchen"
  | "manager"
  | "accountant"
  | "hr"
  | "rider";

export type PopsSessionState = {
  branch: PopsBranch | null;
  /** User-added branches (persisted locally until synced to control plane). */
  customBranches: PopsBranch[];
  /** Workspace role label; API authorization remains on JWT claims. */
  displayRole: PopsRole;
  pinSession: boolean;
  setBranch: (branch: PopsBranch | null) => void;
  addBranch: (input: { name: string; city: string; code: string }) => PopsBranch;
  removeBranch: (id: string) => void;
  setDisplayRole: (role: PopsRole) => void;
  setPinSession: (value: boolean) => void;
  clearBranch: () => void;
};

function normalizeBranchCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
}

export const usePopsStore = create<PopsSessionState>()(
  persist(
    (set) => ({
      branch: null,
      customBranches: [],
      displayRole: "admin",
      pinSession: false,
      setBranch: (branch) => set({ branch }),
      addBranch: (input) => {
        const name = input.name.trim();
        const city = input.city.trim();
        const id = `custom-${Date.now()}`;
        let created!: PopsBranch;
        set((s) => {
          let code = normalizeBranchCode(input.code) || `BR-${Date.now().toString(36).toUpperCase()}`;
          const existingCodes = new Set(s.customBranches.map((b) => b.code));
          if (existingCodes.has(code)) {
            code = `${code}-${(s.customBranches.length + 1).toString(36)}`.slice(0, 18);
          }
          created = { id, name, city, code };
          return { customBranches: [...s.customBranches, created] };
        });
        return created;
      },
      removeBranch: (id) => {
        if (!id.startsWith("custom-")) return;
        set((s) => {
          const customBranches = s.customBranches.filter((b) => b.id !== id);
          const branch = s.branch?.id === id ? null : s.branch;
          return { customBranches, branch };
        });
      },
      setDisplayRole: (displayRole) => set({ displayRole }),
      setPinSession: (pinSession) => set({ pinSession }),
      clearBranch: () => set({ branch: null }),
    }),
    {
      name: "pops-session-v2",
      partialize: (s) => ({
        branch: s.branch,
        displayRole: s.displayRole,
        customBranches: s.customBranches,
      }),
    },
  ),
);
