import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessTokenClaims } from "../lib/jwt";

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  claims: AccessTokenClaims | null;
  setTokens: (accessToken: string, refreshToken: string, claims: AccessTokenClaims) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      claims: null,
      setTokens: (accessToken, refreshToken, claims) => set({ accessToken, refreshToken, claims }),
      clear: () => set({ accessToken: null, refreshToken: null, claims: null }),
    }),
    {
      name: "platform-session-v1",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        claims: s.claims,
      }),
    },
  ),
);
