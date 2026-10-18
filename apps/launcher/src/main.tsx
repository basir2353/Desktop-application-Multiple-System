import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { clearDeviceInstall } from "./lib/deviceInstall";
import { persistResolvedLiveUrl, resolveLiveApiBaseUrl, RAILWAY_API_URL } from "./lib/apiBase";
import { maybeAutoBackupOnAppUpdate } from "./pops/lib/branchSettingsBackup";
import { useDataModeStore } from "./stores/dataModeStore";
import launcherPkg from "../package.json";
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
  // API host: honor ?api=local|live|railway. In Vite DEV with a local VITE_API_BASE_URL,
  // default to Local API so newly seeded systems (e.g. MobiZone) work without Railway deploy.
  // Must update both localStorage AND the zustand store — persist may have already
  // hydrated before this block runs (import order).
  const apiParam = params.get("api");
  const bakedApi = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  const preferLocalDev =
    import.meta.env.DEV &&
    (bakedApi.includes("127.0.0.1") || bakedApi.includes("localhost"));
  if (apiParam === "local" || (preferLocalDev && apiParam !== "live" && apiParam !== "railway")) {
    localStorage.setItem(
      "platform-data-mode-v2",
      JSON.stringify({
        state: { dataMode: "local", apiPreset: "local", cloudApiUrl: "", lastSyncedAt: null },
        version: 0,
      }),
    );
    useDataModeStore.setState({
      dataMode: "local",
      apiPreset: "local",
      cloudApiUrl: "",
    });
  } else if (apiParam === "live" || apiParam === "railway") {
    localStorage.setItem(
      "platform-data-mode-v2",
      JSON.stringify({
        state: { dataMode: "cloud", apiPreset: "live", cloudApiUrl: "", lastSyncedAt: null },
        version: 0,
      }),
    );
    useDataModeStore.setState({
      dataMode: "cloud",
      apiPreset: "live",
      cloudApiUrl: "",
    });
    persistResolvedLiveUrl(RAILWAY_API_URL);
  }
} catch {
  // ignore storage errors
}

try {
  maybeAutoBackupOnAppUpdate(launcherPkg.version);
} catch {
  // ignore backup errors
}

void resolveLiveApiBaseUrl().catch(() => {
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
