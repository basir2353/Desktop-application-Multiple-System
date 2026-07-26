import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  businessSystemIdFromSystemType,
  getErpEntryPath,
  isRestaurantExclusivePath,
  resolveBusinessSystemFromPath,
} from "../lib/businessSystems";
import { getEffectiveSystemLock, recordDeviceInstall } from "../lib/deviceInstall";
import { useActiveSystemId } from "../hooks/useActiveSystemId";
import { erpEntryPathForRole } from "../pops/lib/roleAccess";
import { usePopsStore } from "../stores/popsStore";
import { useSessionStore } from "../stores/sessionStore";
import { useSystemStore } from "../stores/systemStore";
import { useEffect } from "react";

/**
 * Blocks routes that don't belong to the active / assigned system.
 * JWT `systemType` permanently locks tenant users; installers add a build-time lock.
 */
export function SystemRouteGuard(): JSX.Element {
  const { pathname } = useLocation();
  const systemId = useActiveSystemId();
  const lockedSystemId = getEffectiveSystemLock();
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const claims = useSessionStore((s) => s.claims);
  const setSystem = useSystemStore((s) => s.setSystem);
  const assignedSystemId = businessSystemIdFromSystemType(claims?.systemType);
  const effectiveLock = lockedSystemId ?? assignedSystemId;
  const hasBranch = Boolean(branch);

  useEffect(() => {
    if (!assignedSystemId) return;
    setSystem(assignedSystemId);
    // Covers sessions restored from storage that predate the device install.
    recordDeviceInstall(claims?.systemType ?? assignedSystemId);
  }, [assignedSystemId, claims?.systemType, setSystem]);

  function homePath(targetSystemId: typeof systemId): string {
    if (!hasBranch) return getErpEntryPath(targetSystemId, false);
    return erpEntryPathForRole(targetSystemId, displayRole);
  }

  if (effectiveLock) {
    const routeSystem = resolveBusinessSystemFromPath(pathname);
    const crossSystem = routeSystem && routeSystem !== effectiveLock;
    const restaurantLeak =
      effectiveLock !== "restaurant" && isRestaurantExclusivePath(pathname);
    if (crossSystem || restaurantLeak) {
      return <Navigate to={homePath(effectiveLock)} replace />;
    }
    return <Outlet />;
  }

  if (systemId !== "restaurant" && isRestaurantExclusivePath(pathname)) {
    return <Navigate to={homePath(systemId)} replace />;
  }

  return <Outlet />;
}
