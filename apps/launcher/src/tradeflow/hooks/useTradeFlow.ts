import { useQueryClient } from "@tanstack/react-query";
import { fieldInputClass, panelClass } from "../../pops/lib/themeClasses";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import "../tradeflow.css";

export { TfField } from "./TfField";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

/** MaterialFlow inputs — POPS field chrome + full width. */
export const tfInputClass = `w-full ${fieldInputClass}`;

/** Copper/amber primary for MaterialFlow actions. */
export const tfPrimaryBtn =
  "tf-primary-btn h-[42px] w-full rounded-lg px-3 text-sm font-medium disabled:opacity-50";

export const tfSecondaryBtn =
  "h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50";

export const tfPanelClass = panelClass;

export const tfTableWrapClass =
  "tf-table-wrap overflow-x-auto";

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
