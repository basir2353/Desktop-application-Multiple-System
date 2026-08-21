import { isRequestQueueSlow, subscribeRequestQueueSlow } from "@platform/auth-client";
import { useEffect, useState } from "react";

const SLOW_INTERVAL_MULTIPLIER = 3;

/**
 * Stretch React Query refetch intervals when the shared HTTP queue is in slow mode.
 */
export function useAdaptiveRefetchInterval(ms: number): number {
  const [slow, setSlow] = useState(isRequestQueueSlow);
  useEffect(() => subscribeRequestQueueSlow(setSlow), []);
  return slow ? ms * SLOW_INTERVAL_MULTIPLIER : ms;
}
