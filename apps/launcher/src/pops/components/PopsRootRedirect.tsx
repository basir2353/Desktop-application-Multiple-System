import { Navigate } from "react-router-dom";
import { usePopsStore } from "../../stores/popsStore";

export function PopsRootRedirect(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  return <Navigate to={branch ? "/pops/dashboard" : "/pops/branches"} replace />;
}
