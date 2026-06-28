import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  resolveBusinessSystemFromPath,
  type BusinessSystemId,
} from "../lib/businessSystems";
import { useSystemStore } from "../stores/systemStore";

/** Active ERP system — prefers the route prefix, then persisted selection. */
export function useActiveSystemId(): BusinessSystemId {
  const { pathname } = useLocation();
  const systemId = useSystemStore((s) => s.systemId);
  const setSystem = useSystemStore((s) => s.setSystem);
  const fromPath = resolveBusinessSystemFromPath(pathname);

  useEffect(() => {
    if (fromPath && fromPath !== systemId) {
      setSystem(fromPath);
    }
  }, [fromPath, systemId, setSystem]);

  return fromPath ?? systemId ?? "restaurant";
}
