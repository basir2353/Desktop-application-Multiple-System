import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { clearDeviceInstall } from "./lib/deviceInstall";
import { getLiveApiUrl } from "./lib/apiBase";
import "./index.css";
import "./theme-overrides.css";
import "./floor-modal.css";
import "./segmented-control.css";
import "./date-filters-bar.css";
import "./dashboard-charts.css";

// Clear device lock before stores hydrate so the suite system picker can open.
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset-install") === "1") {
    clearDeviceInstall();
    localStorage.removeItem("platform-system-v1");
    localStorage.removeItem("platform-session-v1");
  }
  // Force Live Railway API (local Vite UI → hosted backend).
  // Also honor ?api=live|railway. Default this session to Live when ?api=local is absent.
  const apiParam = params.get("api");
  if (apiParam === "live" || apiParam === "railway" || apiParam !== "local") {
    localStorage.setItem(
      "platform-data-mode-v2",
      JSON.stringify({
        state: { dataMode: "cloud", apiPreset: "live", cloudApiUrl: "", lastSyncedAt: null },
        version: 0,
      }),
    );
  }
} catch {
  // ignore storage errors
}

// Warm Railway API on startup (cold starts can take 10–15 s).
void fetch(`${getLiveApiUrl()}/health`, { method: "GET" }).catch(() => {
  /* ignore — login/sync will retry */
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
