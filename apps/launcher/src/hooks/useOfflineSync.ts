import { useEffect } from "react";
import { subscribeConnectivity, isOnline } from "@platform/connectivity";
import { useSessionStore } from "../stores/sessionStore";
import { autoSyncIfNeeded } from "../lib/offlineSync";
import { useDataModeStore } from "../stores/dataModeStore";

const AUTO_SYNC_INTERVAL_MS = 30_000;

/** Re-sync local queues and outbox when online (cloud mode only). */
export function useOfflineSync(): void {
  const accessToken = useSessionStore((s) => s.accessToken);
  const dataMode = useDataModeStore((s) => s.dataMode);

  useEffect(() => {
    if (!accessToken || dataMode !== "cloud") return;
    const token = accessToken;

    function sync(): void {
      if (isOnline()) void autoSyncIfNeeded(token);
    }

    sync();
    const intervalId = setInterval(sync, AUTO_SYNC_INTERVAL_MS);
    const unsub = subscribeConnectivity((online) => {
      if (online) sync();
    });

    return () => {
      clearInterval(intervalId);
      unsub();
    };
  }, [accessToken, dataMode]);
}
