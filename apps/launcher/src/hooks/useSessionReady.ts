import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";

/** True once persisted session state has been read from storage (with a short timeout fallback). */
export function useSessionReady(): boolean {
  const [ready, setReady] = useState(() => useSessionStore.persist.hasHydrated());

  useEffect(() => {
    if (useSessionStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }

    const unsub = useSessionStore.persist.onFinishHydration(() => setReady(true));
    const timeout = window.setTimeout(() => setReady(true), 1500);
    return () => {
      unsub();
      window.clearTimeout(timeout);
    };
  }, []);

  return ready;
}
