import { Navigate } from "react-router-dom";
import { getErpEntryPath } from "../../lib/businessSystems";
import { usePopsStore } from "../../stores/popsStore";
import { useSystemStore } from "../../stores/systemStore";

export function PopsRootRedirect(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const systemId = useSystemStore((s) => s.systemId) ?? "restaurant";
  return <Navigate to={getErpEntryPath(systemId, Boolean(branch))} replace />;
}
