import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { getApiBaseUrl } from "../lib/apiBase";
import { decodeAccessToken, type AccessTokenClaims } from "../lib/jwt";

const ACCESS_KEY = "pops-waiter-access";
const REFRESH_KEY = "pops-waiter-refresh";
const EMAIL_KEY = "pops-waiter-email";
const API_BASE_KEY = "pops-waiter-api-base";

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
    void SecureStore.setItemAsync(API_BASE_KEY, getApiBaseUrl());
    if (email) void SecureStore.setItemAsync(EMAIL_KEY, email);
    set({ accessToken: access, refreshToken: refresh, claims, waiterEmail: email ?? null });
  },

  clear: () => {
    void SecureStore.deleteItemAsync(ACCESS_KEY);
    void SecureStore.deleteItemAsync(REFRESH_KEY);
    void SecureStore.deleteItemAsync(EMAIL_KEY);
    void SecureStore.deleteItemAsync(API_BASE_KEY);
    set({ accessToken: null, refreshToken: null, claims: null, waiterEmail: null });
  },

  hydrate: async () => {
    const currentApiBase = getApiBaseUrl();
    const [access, refresh, email, storedApiBase] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(EMAIL_KEY),
      SecureStore.getItemAsync(API_BASE_KEY),
    ]);

    // Tokens from localhost / old backend are invalid after switching to Railway.
    if (storedApiBase && storedApiBase !== currentApiBase) {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
        SecureStore.deleteItemAsync(EMAIL_KEY),
        SecureStore.deleteItemAsync(API_BASE_KEY),
      ]);
      set({
        accessToken: null,
        refreshToken: null,
        claims: null,
        waiterEmail: null,
        hydrated: true,
      });
      return;
    }

    let claims: AccessTokenClaims | null = null;
    if (access) {
      try {
        claims = decodeAccessToken(access);
      } catch {
        claims = null;
      }
    }
    set({
      accessToken: access,
      refreshToken: refresh,
      claims,
      waiterEmail: email,
      hydrated: true,
    });
  },
}));
