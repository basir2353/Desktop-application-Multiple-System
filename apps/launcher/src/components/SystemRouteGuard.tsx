import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  getErpEntryPath,
  isRestaurantExclusivePath,
  resolveBusinessSystemFromPath,
} from "../lib/businessSystems";
import { getLockedSystemId } from "../lib/edition";
import { useActiveSystemId } from "../hooks/useActiveSystemId";
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
  const hasBranch = Boolean(usePopsStore((s) => s.branch));

  if (lockedSystemId) {
    const routeSystem = resolveBusinessSystemFromPath(pathname);
    // A pharmacy/store route in a non-matching locked build, or a restaurant-only
    // route in a locked non-restaurant build, is redirected home.
    const crossSystem = routeSystem && routeSystem !== lockedSystemId;
    const restaurantLeak =
      lockedSystemId !== "restaurant" && isRestaurantExclusivePath(pathname);
    if (crossSystem || restaurantLeak) {
      return <Navigate to={getErpEntryPath(lockedSystemId, hasBranch)} replace />;
    }
    return <Outlet />;
  }

  if (systemId !== "restaurant" && isRestaurantExclusivePath(pathname)) {
    return <Navigate to={getErpEntryPath(systemId, hasBranch)} replace />;
  }

  return <Outlet />;
}
