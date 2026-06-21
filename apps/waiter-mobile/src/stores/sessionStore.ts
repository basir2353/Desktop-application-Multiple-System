import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { AccessTokenClaims } from "../lib/jwt";

const ACCESS_KEY = "pops-waiter-access";
const REFRESH_KEY = "pops-waiter-refresh";
const EMAIL_KEY = "pops-waiter-email";

type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  claims: AccessTokenClaims | null;
  waiterEmail: string | null;
  hydrated: boolean;
  setTokens: (access: string, refresh: string, claims: AccessTokenClaims, email?: string) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  claims: null,
  waiterEmail: null,
  hydrated: false,

  setTokens: (access, refresh, claims, email) => {
    void SecureStore.setItemAsync(ACCESS_KEY, access);
    void SecureStore.setItemAsync(REFRESH_KEY, refresh);
    if (email) void SecureStore.setItemAsync(EMAIL_KEY, email);
    set({ accessToken: access, refreshToken: refresh, claims, waiterEmail: email ?? null });
  },

  clear: () => {
    void SecureStore.deleteItemAsync(ACCESS_KEY);
    void SecureStore.deleteItemAsync(REFRESH_KEY);
    void SecureStore.deleteItemAsync(EMAIL_KEY);
    set({ accessToken: null, refreshToken: null, claims: null, waiterEmail: null });
  },

  hydrate: async () => {
    const [access, refresh, email] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(EMAIL_KEY),
    ]);
    set({
      accessToken: access,
      refreshToken: refresh,
      claims: null,
      waiterEmail: email,
      hydrated: true,
    });
  },
}));
