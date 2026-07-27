import { Navigate, Outlet } from "react-router-dom";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { hasAnyPermission } from "../lib/roleAccess";

/** Admins may enter the ERP shell with no branch so they can create the first one. */
export function canEnterErpWithoutBranch(permissions: readonly string[] | undefined): boolean {
  return hasAnyPermission(permissions, ["pops.multi_branch.manage", "pops.users.manage", "*"]);
}

export function BranchGate(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);

  if (!branch && !canEnterErpWithoutBranch(claims?.permissions)) {
    return <Navigate to="/pops/branches" replace />;
  }
  return <Outlet />;
}
