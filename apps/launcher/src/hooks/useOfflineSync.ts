import { useEffect } from "react";
import { subscribeConnectivity, isOnline } from "@platform/connectivity";
import { useSessionStore } from "../stores/sessionStore";
import { autoSyncIfNeeded } from "../lib/offlineSync";
import { useDataModeStore } from "../stores/dataModeStore";

/** Re-sync local queues and outbox when connectivity returns (cloud mode only). */
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
    return subscribeConnectivity((online) => {
      if (online) sync();
    });
  }, [accessToken, dataMode]);
}
