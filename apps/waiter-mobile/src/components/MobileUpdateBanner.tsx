import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./ui";

type Feed = {
  version: string;
  versionCode: number;
  notes?: string;
  url: string;
};

type BannerState =
  | { kind: "hidden" }
  | { kind: "available"; feed: Feed }
  | { kind: "error"; message: string };

function currentVersionCode(): number {
  // Must use native Android versionCode — not expoConfig alone.
  // Fast builds used to leave Gradle at versionCode 1 while app.json said 1.1.x;
  // comparing expoConfig hid the update and / or looped forever against the feed.
  const native = Number(Constants.nativeBuildVersion ?? 0);
  if (Number.isFinite(native) && native > 0) return native;
  const configured = Number(Constants.expoConfig?.android?.versionCode ?? 0);
  return Number.isFinite(configured) ? configured : 0;
}

function resolveAppVariant(): "admin" | "staff" {
  const extra = Constants.expoConfig?.extra as
    | { updateFeedUrl?: string; appVariant?: string; appKind?: string }
    | undefined;
  if (extra?.appVariant === "admin" || extra?.appKind === "admin") return "admin";
  if (extra?.appVariant === "staff" || extra?.appKind === "staff") return "staff";
  // Fallback: Android package id (admin APK must not check the staff feed).
  const pkg = String(
    Constants.expoConfig?.android?.package ??
      (Constants as { androidId?: string }).androidId ??
      "",
  ).toLowerCase();
  if (pkg.includes(".admin") || pkg.endsWith("admin")) return "admin";
  return "staff";
}

function feedUrl(): string {
  const extra = Constants.expoConfig?.extra as { updateFeedUrl?: string } | undefined;
  if (extra?.updateFeedUrl) return extra.updateFeedUrl;
  const variant = resolveAppVariant();
  return `https://github.com/basir2353/pops-mobile-updates/releases/latest/download/latest-${variant}.json`;
}

/**
 * Checks public GitHub feed and offers APK download/install (same idea as desktop updater).
 */
export function MobileUpdateBanner(): JSX.Element | null {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<BannerState>({ kind: "hidden" });
  const [dismissedCode, setDismissedCode] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      try {
        const res = await fetch(feedUrl(), { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`Update check failed (${res.status})`);
        const feed = (await res.json()) as Feed;
        if (cancelled) return;
        const remoteCode = Number(feed.versionCode ?? 0);
        const localCode = currentVersionCode();
        if (!feed.url || !Number.isFinite(remoteCode) || remoteCode <= localCode) {
          setState({ kind: "hidden" });
          return;
        }
        if (dismissedCode != null && dismissedCode === remoteCode) {
          setState({ kind: "hidden" });
          return;
        }
        setState({ kind: "available", feed });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (/404|Not Found|failed|network|timed out/i.test(message)) {
          setState({ kind: "error", message });
        }
      }
    }

    void check();
    const timer = setInterval(() => void check(), 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dismissedCode]);

  if (state.kind === "hidden") return null;

  if (state.kind === "error") {
    return (
      <View
        style={{
          paddingTop: Math.max(insets.top, 8),
          paddingHorizontal: 12,
          paddingBottom: 8,
          backgroundColor: "#7f1d1d",
        }}
      >
        <Text style={{ color: "#fecaca", fontSize: 12 }}>{state.message}</Text>
        <Pressable onPress={() => setState({ kind: "hidden" })}>
          <Text style={{ color: "#fda4af", fontSize: 11, marginTop: 4 }}>Dismiss</Text>
        </Pressable>
      </View>
    );
  }

  const { feed } = state;

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 8),
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: "#422006",
        borderBottomWidth: 1,
        borderBottomColor: colors.accent,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 13 }}>
        Update available · v{feed.version} ({feed.versionCode})
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>
        Installed build {currentVersionCode()} → install this APK, then reopen the app.
      </Text>
      {feed.notes ? (
        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={2}>
          {feed.notes}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => void Linking.openURL(feed.url)}
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.accentText, fontWeight: "800", fontSize: 12 }}>
            Download & install
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setDismissedCode(feed.versionCode);
            setState({ kind: "hidden" });
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12 }}>Later</Text>
        </Pressable>
      </View>
    </View>
  );
}
