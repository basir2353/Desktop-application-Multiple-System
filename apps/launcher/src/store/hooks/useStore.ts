import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

export const storeInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:shadow-none dark:focus:ring-sky-500/30";

export const storeSelectClass = storeInputClass;

export function useStoreAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("pops.inventory.manage") || claims?.permissions.includes("*");
  return { branch, canManage };
}

export function useInvalidateStore() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["store"] });
  };
}
