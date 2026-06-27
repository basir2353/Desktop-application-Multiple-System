import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

export const pharmacyInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:shadow-none dark:focus:ring-emerald-500/30";

export const pharmacySelectClass = pharmacyInputClass;

export function usePharmacyAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("pops.inventory.manage") || claims?.permissions.includes("*");
  return { branch, canManage };
}

export function useInvalidatePharmacy() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["pharmacy"] });
  };
}
