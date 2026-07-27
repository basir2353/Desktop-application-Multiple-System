import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore, type PopsBranch } from "../../stores/popsStore";
import { fetchPopsBranches } from "../api/operations";
import { isMonitoringBranch } from "../lib/branchScope";
import { filterBranchesByScope } from "../lib/roleAccess";

function toPopsBranch(row: { id: string; code: string; name: string; city: string }): PopsBranch {
  return { id: row.id, code: row.code, name: row.name, city: row.city };
}

/**
 * When the ERP shell has no selected branch, auto-select the first available one.
 * Does not hijack navigation — pages like FBR/PRA can open on the main system
 * when the business has no store branches yet.
 */
export function BranchAutoConnect(): null {
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = usePopsStore((s) => s.branch);
  const setBranch = usePopsStore((s) => s.setBranch);

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches", accessToken],
    enabled: Boolean(accessToken) && !branch,
    queryFn: fetchPopsBranches,
  });

  useEffect(() => {
    if (branch) return;
    if (!branchesQuery.isSuccess) return;

    const scoped = filterBranchesByScope(
      (branchesQuery.data ?? []).map(toPopsBranch),
      claims?.branchScope,
    );
    const first = scoped.find((b) => !isMonitoringBranch(b.code)) ?? scoped[0] ?? null;
    if (first) setBranch(first);
  }, [branch, branchesQuery.isSuccess, branchesQuery.data, claims?.branchScope, setBranch]);

  return null;
}
