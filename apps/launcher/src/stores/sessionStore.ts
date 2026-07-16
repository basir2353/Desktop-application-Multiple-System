import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessTokenClaims } from "../lib/jwt";

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  claims: AccessTokenClaims | null;
  /** Whether the POS "Select order type" prompt has already been shown this app run. Not persisted — resets whenever the app is closed and reopened. */
  orderTypeModalShown: boolean;
  /** Whether the POS "Select seating section" auto-prompt has already been shown this app run. Not persisted — resets whenever the app is closed and reopened. */
  seatingModalShown: boolean;
  setTokens: (accessToken: string, refreshToken: string, claims: AccessTokenClaims) => void;
  markOrderTypeModalShown: () => void;
  markSeatingModalShown: () => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      claims: null,
      orderTypeModalShown: false,
      seatingModalShown: false,
      setTokens: (accessToken, refreshToken, claims) => set({ accessToken, refreshToken, claims }),
      markOrderTypeModalShown: () => set({ orderTypeModalShown: true }),
      markSeatingModalShown: () => set({ seatingModalShown: true }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          claims: null,
          orderTypeModalShown: false,
          seatingModalShown: false,
        }),
    }),
    {
      name: "platform-session-v1",
      // orderTypeModalShown / seatingModalShown intentionally excluded — they must
      // reset to false on every fresh app launch, not persist across restarts.
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        claims: s.claims,
      }),
      // Belt-and-suspenders: force these false after rehydration too, in case an
      // older build already wrote them to disk before they were excluded above.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.orderTypeModalShown = false;
          state.seatingModalShown = false;
        }
      },
    },
  ),
);
