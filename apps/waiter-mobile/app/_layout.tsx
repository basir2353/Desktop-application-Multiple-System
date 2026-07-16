import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { bootstrapSession, SessionExpiredError } from "../src/lib/authFetch";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { warmApiConnection } from "../src/lib/warmApi";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

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
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <SessionGuard />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f8fafc",
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: "#0f172a" },
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
        <Stack.Screen name="history" options={{ title: "Order history" }} />
        <Stack.Screen name="manage-pin" options={{ title: "Manage PIN" }} />
      </Stack>
    </QueryClientProvider>
  );
}
