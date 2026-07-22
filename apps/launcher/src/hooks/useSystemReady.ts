import { useEffect, useState } from "react";
import { useSystemStore } from "../stores/systemStore";

/** True once the persisted business-system selection has finished hydrating. */
export function useSystemReady(): boolean {
  const [ready, setReady] = useState(() => useSystemStore.persist.hasHydrated());

  useEffect(() => {
    if (useSystemStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useSystemStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  return ready;
}
