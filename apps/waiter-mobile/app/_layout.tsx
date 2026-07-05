import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { bootstrapSession } from "../src/lib/authFetch";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
});

export default function RootLayout() {
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const hydrateBranch = useBranchStore((s) => s.hydrate);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const branchHydrated = useBranchStore((s) => s.hydrated);

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
      </Stack>
    </QueryClientProvider>
  );
}
