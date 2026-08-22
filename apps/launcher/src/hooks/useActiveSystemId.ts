import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  isBusinessSystemId,
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
  const stored = systemId && isBusinessSystemId(systemId) ? systemId : null;

  useEffect(() => {
    if (fromPath && fromPath !== stored) {
      setSystem(fromPath);
    }
  }, [fromPath, stored, setSystem]);

  return fromPath ?? stored ?? "restaurant";
}
