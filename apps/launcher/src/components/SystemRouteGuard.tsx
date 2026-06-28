import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getErpEntryPath, isRestaurantExclusivePath } from "../lib/businessSystems";
import { useActiveSystemId } from "../hooks/useActiveSystemId";
import { usePopsStore } from "../stores/popsStore";

/** Blocks restaurant routes when pharmacy or general store is active. */
export function SystemRouteGuard(): JSX.Element {
  const { pathname } = useLocation();
  const systemId = useActiveSystemId();
  const hasBranch = Boolean(usePopsStore((s) => s.branch));

  if (systemId !== "restaurant" && isRestaurantExclusivePath(pathname)) {
    return <Navigate to={getErpEntryPath(systemId, hasBranch)} replace />;
  }

  return <Outlet />;
}
