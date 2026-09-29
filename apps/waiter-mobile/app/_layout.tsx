import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { bootstrapSession, SessionExpiredError } from "../src/lib/authFetch";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { MobileUpdateBanner } from "../src/components/MobileUpdateBanner";
import { useColors } from "../src/components/ui";
import { getColors } from "../src/stores/themeStore";
import { warmApiConnection } from "../src/lib/warmApi";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";
import { useThemeStore } from "../src/stores/themeStore";

/** Hard cap so SecureStore hangs never leave a permanent blank root. */
const BOOT_HYDRATE_TIMEOUT_MS = 4000;

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("[RootErrorBoundary]", error.message, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      const colors = getColors();
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
          collapsable={false}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Something went wrong</Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={() => {
              useSessionStore.getState().clear();
              useBranchStore.getState().clear();
              this.setState({ error: null });
            }}
            style={{
              marginTop: 8,
              backgroundColor: colors.accent,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: colors.accentText, fontWeight: "700" }}>Back to login</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof SessionExpiredError) {
        useSessionStore.getState().clear();
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof SessionExpiredError) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof SessionExpiredError) {
          useSessionStore.getState().clear();
        }
      },
    },
  },
});

function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!accessToken && pathname !== "/") {
      router.replace("/");
    }
  }, [accessToken, pathname, router, sessionHydrated]);

  return null;
}

function BootOverlay({ label }: { label: string }) {
  const colors = getColors();
  return (
    <View
      pointerEvents="auto"
      collapsable={false}
      style={[StyleSheet.absoluteFillObject, styles.bootOverlay, { backgroundColor: colors.bg }]}
    >
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function ThemedStack() {
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);

  // Stack must be a flex:1 sibling — never a Fragment peer of banners.
  // Fragment + Stack without flex collapses to 0-height on some Android OEMs.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} collapsable={false}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SessionGuard />
      <MobileUpdateBanner />
      <OfflineBanner />
      <View style={{ flex: 1 }} collapsable={false}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { flex: 1, backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="branch" options={{ title: "Select branch" }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="rider-home" options={{ headerShown: false }} />
          <Stack.Screen name="rider-deliveries" options={{ title: "My deliveries" }} />
          <Stack.Screen name="rider-delivery" options={{ title: "Delivery detail" }} />
          <Stack.Screen name="order" options={{ title: "Take order" }} />
          <Stack.Screen name="orders" options={{ title: "View orders" }} />
          <Stack.Screen name="table-transfer" options={{ title: "Table transfer" }} />
          <Stack.Screen name="history" options={{ title: "Order history" }} />
          <Stack.Screen name="manage-pin" options={{ title: "Manage PIN" }} />
          <Stack.Screen name="printers" options={{ title: "Printers" }} />
          <Stack.Screen name="admin-home" options={{ headerShown: false }} />
          <Stack.Screen name="admin-orders" options={{ headerShown: false }} />
          <Stack.Screen name="admin-menu" options={{ headerShown: false }} />
          <Stack.Screen name="admin-tax" options={{ headerShown: false }} />
          <Stack.Screen name="admin-more" options={{ headerShown: false }} />
          <Stack.Screen name="admin-tables" options={{ headerShown: false }} />
          <Stack.Screen name="admin-kitchen" options={{ headerShown: false }} />
          <Stack.Screen name="admin-inventory" options={{ headerShown: false }} />
          <Stack.Screen name="admin-sales" options={{ title: "Sales" }} />
          <Stack.Screen name="admin-reports" options={{ title: "Reports" }} />
          <Stack.Screen name="admin-ledger" options={{ title: "Ledgers" }} />
          <Stack.Screen name="admin-payout" options={{ title: "Pay out" }} />
          <Stack.Screen name="admin-cash" options={{ title: "Cash drawer" }} />
          <Stack.Screen name="admin-vendors" options={{ title: "Vendors" }} />
          <Stack.Screen name="admin-users" options={{ title: "User management" }} />
          <Stack.Screen name="admin-activity" options={{ title: "Activity & reports" }} />
          <Stack.Screen name="admin-pra" options={{ headerShown: false }} />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const hydrateBranch = useBranchStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const branchHydrated = useBranchStore((s) => s.hydrated);
  const accessToken = useSessionStore((s) => s.accessToken);
  const colors = getColors();
  const booting = !sessionHydrated || !branchHydrated;

  useEffect(() => {
    void warmApiConnection();
  }, []);

  useEffect(() => {
    void hydrateSession();
    void hydrateBranch();
    void hydrateTheme();
    // Fail-open: never stay on a blank root forever.
    const timer = setTimeout(() => {
      const session = useSessionStore.getState();
      const branch = useBranchStore.getState();
      const theme = useThemeStore.getState();
      if (!session.hydrated) {
        useSessionStore.setState({ hydrated: true });
      }
      if (!branch.hydrated) {
        useBranchStore.setState({ hydrated: true });
      }
      if (!theme.hydrated) {
        useThemeStore.setState({ hydrated: true });
      }
    }, BOOT_HYDRATE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hydrateSession, hydrateBranch, hydrateTheme]);

  // Re-run when tokens appear after late SecureStore hydrate (fail-open can mark
  // hydrated=true with null tokens first; login also sets tokens later).
  useEffect(() => {
    if (!sessionHydrated) return;
    void bootstrapSession();
  }, [sessionHydrated, accessToken]);

  // After app kill / background, re-warm API + refresh session so KOT Live print
  // works without forcing sign-out / sign-in.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return;
      void warmApiConnection();
      void bootstrapSession();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  // Always mount <Stack /> on first paint. Returning only a View/null here leaves an
  // empty white FrameLayout after expo-router hides the splash (seen on TECNO devices).
  return (
    <SafeAreaProvider>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <View style={{ flex: 1, backgroundColor: colors.bg }} collapsable={false}>
            <ThemedStack />
            {booting ? <BootOverlay label="Starting..." /> : null}
          </View>
        </QueryClientProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 1000,
    elevation: 1000,
  },
});
