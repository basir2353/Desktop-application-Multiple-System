import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Poll only when this screen is focused and the app is in the foreground.
 * Prevents Home+Order+Orders from all hammering the API at once (major lag source).
 */
export function useLiveRefetchInterval(ms: number): number | false {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const onChange = (next: AppStateStatus) => setActive(next === "active");
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  if (!focused || !active) return false;
  return ms;
}
