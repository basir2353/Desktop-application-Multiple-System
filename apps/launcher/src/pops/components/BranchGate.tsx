import { Navigate, Outlet } from "react-router-dom";
import { usePopsStore } from "../../stores/popsStore";

export function BranchGate(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  if (!branch) return <Navigate to="/pops/branches" replace />;
  return <Outlet />;
}
