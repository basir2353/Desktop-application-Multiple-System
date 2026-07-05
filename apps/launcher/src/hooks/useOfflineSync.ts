import { useEffect } from "react";
import { subscribeConnectivity, isOnline } from "@platform/connectivity";
import { useSessionStore } from "../stores/sessionStore";
import { flushAllOfflineData } from "../lib/offlineSync";

/** Re-sync local queues and outbox when connectivity returns (web + desktop). */
export function useOfflineSync(): void {
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const token = accessToken;

    function sync(): void {
      if (isOnline()) void flushAllOfflineData(token);
    }

    sync();
    return subscribeConnectivity((online) => {
      if (online) sync();
    });
  }, [accessToken]);
}
