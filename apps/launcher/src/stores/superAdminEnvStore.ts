import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Whole-app live target. Only one is Active. */
export type SuperAdminEnv = "old" | "new";

const BAKED_DEFAULT_ENV: SuperAdminEnv =
  import.meta.env.VITE_LIVE_ENV === "new"
    ? "new"
    : import.meta.env.VITE_LIVE_ENV === "old"
      ? "old"
      : (import.meta.env.VITE_API_BASE_URL ?? "").includes("600b")
        ? "new"
        : "old";

type SuperAdminEnvState = {
  env: SuperAdminEnv;
  setEnv: (env: SuperAdminEnv) => void;
};

export const useSuperAdminEnvStore = create<SuperAdminEnvState>()(
  persist(
    (set) => ({
      env: BAKED_DEFAULT_ENV,
      setEnv: (env) => set({ env }),
    }),
    { name: "platform-sa-env-v1" },
  ),
);
