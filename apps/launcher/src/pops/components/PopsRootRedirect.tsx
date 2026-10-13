import { Navigate } from "react-router-dom";
import { getErpEntryPath } from "../../lib/businessSystems";
import { erpEntryPathForAccess } from "../lib/roleAccess";
import { usePopsStore } from "../../stores/popsStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useSystemStore } from "../../stores/systemStore";

export function PopsRootRedirect(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const claims = useSessionStore((s) => s.claims);
  const systemId = useSystemStore((s) => s.systemId) ?? "restaurant";
  if (!branch) {
    return <Navigate to={getErpEntryPath(systemId, false)} replace />;
  }
  return (
    <Navigate
      to={erpEntryPathForAccess(systemId, displayRole, claims?.permissions, claims?.navAllowlist)}
      replace
    />
  );
}
