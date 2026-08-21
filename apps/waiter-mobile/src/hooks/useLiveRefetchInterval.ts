import { subscribeRequestQueueSlow } from "@platform/auth-client";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

const SLOW_INTERVAL_MULTIPLIER = 3;

/**
 * Poll only when this screen is focused and the app is in the foreground.
 * When the shared HTTP queue detects slow RTT, stretch the interval so fewer
 * requests pile onto the API.
 */
export function useLiveRefetchInterval(ms: number): number | false {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => setActive(next === "active");
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => subscribeRequestQueueSlow(setSlow), []);

  if (!focused || !active) return false;
  return slow ? ms * SLOW_INTERVAL_MULTIPLIER : ms;
}
