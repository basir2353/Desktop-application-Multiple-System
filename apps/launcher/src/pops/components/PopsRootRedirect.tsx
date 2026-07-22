import { Navigate } from "react-router-dom";
import { getErpEntryPath } from "../../lib/businessSystems";
import { erpEntryPathForRole } from "../lib/roleAccess";
import { usePopsStore } from "../../stores/popsStore";
import { useSystemStore } from "../../stores/systemStore";

export function PopsRootRedirect(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const systemId = useSystemStore((s) => s.systemId) ?? "restaurant";
  if (!branch) {
    return <Navigate to={getErpEntryPath(systemId, false)} replace />;
  }
  return <Navigate to={erpEntryPathForRole(systemId, displayRole)} replace />;
}
