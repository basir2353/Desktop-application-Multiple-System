import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fieldInputClass, fieldSelectClass } from "../lib/themeClasses";

export function useInventoryAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage = Boolean(
    claims?.permissions.includes("*") ||
      claims?.permissions.includes("pops.inventory.manage") ||
      claims?.permissions.includes("pops.menu.manage"),
  );

  return { branch, canManage };
}

export function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
  };
}

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export const inputClass = fieldInputClass;
export const selectClass = fieldSelectClass;
