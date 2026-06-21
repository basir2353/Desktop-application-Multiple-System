import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fieldInputClass } from "../lib/themeClasses";

export function useHrAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("*") || claims?.permissions.includes("pops.hr.manage");
  const canApprovePayroll =
    canManage || claims?.permissions.includes("pops.accounting.manage") === true;

  return { branch, canManage, canApprovePayroll };
}

export function useInvalidateHr() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["hr"] });
    void queryClient.invalidateQueries({ queryKey: ["accounting"] });
  };
}

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export const hrInputClass = fieldInputClass;
