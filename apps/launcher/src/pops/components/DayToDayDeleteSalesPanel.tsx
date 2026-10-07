import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { deleteBill, fetchCompletedOrders } from "../api/billing";
import { loadBusinessDaySettings } from "../lib/businessDay";
import { businessDateKey } from "../lib/orderSales";
import { fieldInputClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

/**
 * Day-to-day (date-range) sale delete — Main Admin Panel + Settings.
 * Deletes bills and related journals / kitchen tickets / tax rows via API.
 */
export function DayToDayDeleteSalesPanel(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const queryClient = useQueryClient();
  const businessDay = useMemo(
    () => loadBusinessDaySettings(branch?.code),
    [branch?.code],
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code, "admin-day-delete", "all"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCompletedOrders(branch!.code, { scope: "all" }),
  });

  const previewCount = useMemo(() => {
    if (!from || !to) return 0;
    return (ordersQuery.data ?? []).filter((bill) => {
      const key = businessDateKey(bill.createdAt, businessDay);
      return key >= from && key <= to;
    }).length;
  }, [ordersQuery.data, from, to, businessDay]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!branch?.code) throw new Error("Select a branch first.");
      if (!from || !to) throw new Error("Select both from and to dates.");
      if (from > to) throw new Error("From date must be on or before To date.");
      const bills = (ordersQuery.data ?? []).filter((bill) => {
        const key = businessDateKey(bill.createdAt, businessDay);
        return key >= from && key <= to;
      });
      if (bills.length === 0) throw new Error("No bills found in the selected date range.");
      const confirmed = window.confirm(
        `Permanently delete ${bills.length} sale(s) from ${from} to ${to}? Journals and kitchen tickets for these bills are also removed. This cannot be undone.`,
      );
      if (!confirmed) throw new Error("Cancelled.");
      let deleted = 0;
      const failures: string[] = [];
      for (const bill of bills) {
        try {
          await deleteBill(bill.id);
          deleted += 1;
        } catch (err) {
          failures.push(
            `${bill.billRef}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      if (deleted === 0 && failures.length > 0) {
        throw new Error(failures.slice(0, 3).join(" · "));
      }
      return { deleted, failures };
    },
    onSuccess: ({ deleted, failures }) => {
      setError(null);
      setNotice(
        failures.length > 0
          ? `Deleted ${deleted} sale(s); ${failures.length} failed (e.g. ${failures[0]}).`
          : `Date-range delete complete — ${deleted} sale(s) removed (bills + journals).`,
      );
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      void queryClient.invalidateQueries({ queryKey: ["operations"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void ordersQuery.refetch();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      if (msg === "Cancelled.") return;
      setNotice(null);
      setError(msg);
    },
  });

  if (!branch?.code) {
    return (
      <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4">
        <div className="text-sm font-semibold text-red-800 dark:text-red-200">
          Date-range delete sales
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Select a branch first to delete sales by date.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4">
      <div className="text-sm font-semibold text-red-800 dark:text-red-200">
        Date-range delete sales
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Removes all bills in a business-day date range, plus linked journals, kitchen tickets, and
        tax invoice rows. Does not delete menu or users.
      </p>
      {ordersQuery.isError ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Could not load bills for this branch. Check connection and try again.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600 dark:text-slate-400">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 block ${fieldInputClass}`}
          />
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-400">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 block ${fieldInputClass}`}
          />
        </label>
        <div className="text-xs text-slate-500">
          {ordersQuery.isLoading
            ? "Loading bills…"
            : from && to
              ? `${previewCount} bill(s) in range`
              : "Select a range"}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 text-xs text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
          disabled={deleteMutation.isPending || !from || !to || ordersQuery.isLoading}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete sales in range"}
        </Button>
      </div>
      {notice ? <p className="mt-2 text-xs text-emerald-700 dark:text-amber-200">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
