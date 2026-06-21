import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fieldInputClass } from "../lib/themeClasses";

export function useMultiBranchAccess() {
  const branch = usePopsStore((s) => s.branch);
  const setBranch = usePopsStore((s) => s.setBranch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("*") ||
    claims?.permissions.includes("pops.multi_branch.manage");

  return { branch, setBranch, canManage };
}

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export const mbInputClass = fieldInputClass;
