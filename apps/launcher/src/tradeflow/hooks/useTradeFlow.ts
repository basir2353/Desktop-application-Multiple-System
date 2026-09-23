import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import "../tradeflow.css";

export { TfField } from "./TfField";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

export const tfInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500";

export const tfPrimaryBtn =
  "h-[42px] w-full rounded-lg bg-violet-600 px-3 text-sm font-medium text-white disabled:opacity-50";
export const tfSecondaryBtn =
  "h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 disabled:opacity-50";

export function useTradeFlowAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const role = usePopsStore((s) => s.displayRole);
  const perms = claims?.permissions ?? [];
  const isAdmin = perms.includes("*") || perms.includes("pops.users.manage") || role === "admin";
  return { branch, isAdmin, claims };
}

export function useInvalidateTradeFlow() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["tradeflow"] });
  };
}
