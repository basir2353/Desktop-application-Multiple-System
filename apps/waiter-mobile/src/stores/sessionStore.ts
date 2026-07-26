import { create } from "zustand";
import { getApiBaseUrl } from "../lib/apiBase";
import { decodeAccessToken, type AccessTokenClaims } from "../lib/jwt";
import { secureDelete, secureGet, secureSet } from "../lib/secureStorage";

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
    void secureSet(ACCESS_KEY, access);
    void secureSet(REFRESH_KEY, refresh);
    void secureSet(API_BASE_KEY, getApiBaseUrl());
    if (email) void secureSet(EMAIL_KEY, email);
    set({ accessToken: access, refreshToken: refresh, claims, waiterEmail: email ?? null });
  },

  clear: () => {
    void secureDelete(ACCESS_KEY);
    void secureDelete(REFRESH_KEY);
    void secureDelete(EMAIL_KEY);
    void secureDelete(API_BASE_KEY);
    set({ accessToken: null, refreshToken: null, claims: null, waiterEmail: null });
  },

  hydrate: async () => {
    try {
      const currentApiBase = getApiBaseUrl();
      const [access, refresh, email, storedApiBase] = await Promise.all([
        secureGet(ACCESS_KEY),
        secureGet(REFRESH_KEY),
        secureGet(EMAIL_KEY),
        secureGet(API_BASE_KEY),
      ]);

      // Tokens from localhost / old backend are invalid after switching to Railway.
      if (storedApiBase && storedApiBase !== currentApiBase) {
        await Promise.all([
          secureDelete(ACCESS_KEY),
          secureDelete(REFRESH_KEY),
          secureDelete(EMAIL_KEY),
          secureDelete(API_BASE_KEY),
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
    } catch (err) {
      console.warn("[sessionStore] hydrate failed:", err);
      set({
        accessToken: null,
        refreshToken: null,
        claims: null,
        waiterEmail: null,
        hydrated: true,
      });
    }
  },
}));
