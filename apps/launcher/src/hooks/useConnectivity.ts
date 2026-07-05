import { useEffect, useState } from "react";
import { isOnline, subscribeConnectivity } from "@platform/connectivity";

export function useConnectivity(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => subscribeConnectivity(setOnline), []);
  return online;
}
