import Constants from "expo-constants";
import { Platform } from "react-native";

/** Default API URL for local dev (simulator / emulator). */
function defaultApiBaseUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }
  return "http://127.0.0.1:3000";
}

export function getApiBaseUrl(): string {
  const fromEnv = (
    globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");

  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  if (extra?.apiBaseUrl?.trim()) return extra.apiBaseUrl.replace(/\/$/, "");

  return defaultApiBaseUrl();
}
