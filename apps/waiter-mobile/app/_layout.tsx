import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { bootstrapSession, SessionExpiredError } from "../src/lib/authFetch";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { MobileUpdateBanner } from "../src/components/MobileUpdateBanner";
import { colors } from "../src/components/ui";
import { warmApiConnection } from "../src/lib/warmApi";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

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
      staleTime: 5_000,
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

export default function RootLayout() {
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const hydrateBranch = useBranchStore((s) => s.hydrate);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const branchHydrated = useBranchStore((s) => s.hydrated);

  useEffect(() => {
    void warmApiConnection();
  }, []);

  useEffect(() => {
    void hydrateSession();
    void hydrateBranch();
  }, [hydrateSession, hydrateBranch]);

  useEffect(() => {
    if (!sessionHydrated) return;
    void bootstrapSession();
  }, [sessionHydrated]);

  if (!sessionHydrated || !branchHydrated) {
    return null;
  }

  return (
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <SessionGuard />
        <MobileUpdateBanner />
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: colors.bg },
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
      </QueryClientProvider>
    </RootErrorBoundary>
  );
}
