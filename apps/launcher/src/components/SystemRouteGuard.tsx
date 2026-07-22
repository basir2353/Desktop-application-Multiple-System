import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  getErpEntryPath,
  isRestaurantExclusivePath,
  resolveBusinessSystemFromPath,
} from "../lib/businessSystems";
import { getLockedSystemId } from "../lib/edition";
import { useActiveSystemId } from "../hooks/useActiveSystemId";
import { erpEntryPathForRole } from "../pops/lib/roleAccess";
import { usePopsStore } from "../stores/popsStore";

/**
 * Blocks routes that don't belong to the active system. In a single-system
 * (locked) edition this also blocks every other system's routes, so an installed
 * build can never navigate into a module it wasn't shipped with.
 */
export function SystemRouteGuard(): JSX.Element {
  const { pathname } = useLocation();
  const systemId = useActiveSystemId();
  const lockedSystemId = getLockedSystemId();
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const hasBranch = Boolean(branch);

  function homePath(targetSystemId: typeof systemId): string {
    if (!hasBranch) return getErpEntryPath(targetSystemId, false);
    return erpEntryPathForRole(targetSystemId, displayRole);
  }

  if (lockedSystemId) {
    const routeSystem = resolveBusinessSystemFromPath(pathname);
    // A pharmacy/store route in a non-matching locked build, or a restaurant-only
    // route in a locked non-restaurant build, is redirected home.
    const crossSystem = routeSystem && routeSystem !== lockedSystemId;
    const restaurantLeak =
      lockedSystemId !== "restaurant" && isRestaurantExclusivePath(pathname);
    if (crossSystem || restaurantLeak) {
      return <Navigate to={homePath(lockedSystemId)} replace />;
    }
    return <Outlet />;
  }

  if (systemId !== "restaurant" && isRestaurantExclusivePath(pathname)) {
    return <Navigate to={homePath(systemId)} replace />;
  }

  return <Outlet />;
}
