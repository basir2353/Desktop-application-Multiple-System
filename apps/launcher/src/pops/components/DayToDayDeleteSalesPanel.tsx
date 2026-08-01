import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { deleteBill, fetchCompletedOrders } from "../api/billing";
import { loadBusinessDaySettings } from "../lib/businessDay";
import { businessDateKey } from "../lib/orderSales";
import { fieldInputClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

/**
 * Day-to-day (date-range) sale delete — Main Admin Panel only.
 * Not shown on Orders / Bills user screens.
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

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code, "admin-day-delete"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCompletedOrders(branch!.code),
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
      if (!from || !to) throw new Error("Select both from and to dates.");
      const bills = (ordersQuery.data ?? []).filter((bill) => {
        const key = businessDateKey(bill.createdAt, businessDay);
        return key >= from && key <= to;
      });
      if (bills.length === 0) throw new Error("No bills found in the selected date range.");
      const confirmed = window.confirm(
        `Permanently delete ${bills.length} sale(s) from ${from} to ${to}? This cannot be undone.`,
      );
      if (!confirmed) throw new Error("Cancelled.");
      let deleted = 0;
      for (const bill of bills) {
        await deleteBill(bill.id);
        deleted += 1;
      }
      return deleted;
    },
    onSuccess: (deleted) => {
      setNotice(`Day-to-day delete complete — ${deleted} sale(s) removed.`);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void ordersQuery.refetch();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      if (msg !== "Cancelled.") setNotice(msg);
    },
  });

  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4">
      <div className="text-sm font-semibold text-red-200">Day-to-day delete sale</div>
      <p className="mt-1 text-xs text-slate-400">
        Main Admin only. Removes all bills in a business-day date range. Single-sale delete is not
        available.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 block ${fieldInputClass}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 block ${fieldInputClass}`}
          />
        </label>
        <div className="text-xs text-slate-500">
          {from && to ? `${previewCount} bill(s) in range` : "Select a range"}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 text-xs text-red-300"
          disabled={deleteMutation.isPending || !from || !to}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete sales in range"}
        </Button>
      </div>
      {notice ? <p className="mt-2 text-xs text-amber-200">{notice}</p> : null}
    </div>
  );
}
