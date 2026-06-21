import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fieldInputClass } from "../lib/themeClasses";

export function useAccountingAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("*") ||
    claims?.permissions.includes("pops.accounting.manage");

  return { branch, canManage };
}

export function useInvalidateAccounting() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["accounting"] });
    void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
  };
}

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export const accountingInputClass = fieldInputClass;
