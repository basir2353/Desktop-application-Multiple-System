import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessTokenClaims } from "../lib/jwt";

/** Per-window unlock (survives refresh, not shared with a new .exe process). */
const WINDOW_UNLOCK_KEY = "platform-window-unlocked-v1";

function readWindowUnlocked(): boolean {
  try {
    return sessionStorage.getItem(WINDOW_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeWindowUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) sessionStorage.setItem(WINDOW_UNLOCK_KEY, "1");
    else sessionStorage.removeItem(WINDOW_UNLOCK_KEY);
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  claims: AccessTokenClaims | null;
  /** Login email (JWT `sub` is user id). */
  email: string | null;
  /**
   * Whether THIS window has completed the login screen.
   * Kept in sessionStorage so refresh keeps you signed in, but a newly opened
   * .exe (new browsing context) starts locked even if localStorage still has tokens.
   */
  windowUnlocked: boolean;
  /** Whether the POS "Select order type" prompt has already been shown this app run. Not persisted — resets whenever the app is closed and reopened. */
  orderTypeModalShown: boolean;
  /** Whether the POS "Select seating section" auto-prompt has already been shown this app run. Not persisted — resets whenever the app is closed and reopened. */
  seatingModalShown: boolean;
  setTokens: (
    accessToken: string,
    refreshToken: string,
    claims: AccessTokenClaims,
    email?: string | null,
  ) => void;
  /** Mark this window as unlocked after a successful password/PIN sign-in. */
  unlockWindow: () => void;
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
      email: null,
      windowUnlocked: readWindowUnlocked(),
      orderTypeModalShown: false,
      seatingModalShown: false,
      setTokens: (accessToken, refreshToken, claims, email) =>
        set((state) => ({
          accessToken,
          refreshToken,
          claims,
          email: email !== undefined ? email : state.email,
        })),
      unlockWindow: () => {
        writeWindowUnlocked(true);
        set({ windowUnlocked: true });
      },
      markOrderTypeModalShown: () => set({ orderTypeModalShown: true }),
      markSeatingModalShown: () => set({ seatingModalShown: true }),
      clear: () => {
        writeWindowUnlocked(false);
        set({
          accessToken: null,
          refreshToken: null,
          claims: null,
          email: null,
          windowUnlocked: false,
          orderTypeModalShown: false,
          seatingModalShown: false,
        });
      },
    }),
    {
      name: "platform-session-v1",
      // windowUnlocked lives in sessionStorage (not localStorage) so refresh keeps
      // the unlock while a second .exe starts locked. Modal flags stay in-memory.
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        claims: s.claims,
        email: s.email,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.windowUnlocked = readWindowUnlocked();
          state.orderTypeModalShown = false;
          state.seatingModalShown = false;
        }
      },
    },
  ),
);
