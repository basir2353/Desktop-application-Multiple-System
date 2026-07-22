import type { KitchenLineCancellation } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchKitchenCancellations } from "../../api/kitchen";
import { formatPkr } from "../../hooks/useInventory";
import { fieldInputClass } from "../../lib/themeClasses";
import { usePopsStore } from "../../../stores/popsStore";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { ModuleFilterBar } from "../../ui/ModuleToolbar";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string): string {
  if (source === "waiter_edit") return "Waiter edit";
  if (source === "pos_edit") return "POS edit";
  if (source === "order_close") return "Order closed";
  return source;
}

export function KitchenCancellationsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);

  const query = useQuery({
    queryKey: ["kitchen", "cancellations", branch?.code, from, to],
    enabled: Boolean(branch?.code),
    queryFn: () =>
      fetchKitchenCancellations(branch!.code, {
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const rows = query.data?.cancellations ?? [];
  const totals = useMemo(
    () => ({
      qty: query.data?.totalQtyCanceled ?? 0,
      amount: query.data?.totalAmountPkr ?? 0,
    }),
    [query.data],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kitchen cancellations"
        subtitle="Items canceled after kitchen saw them — qty cut on update, or whole open order closed without pay."
      />

      <ModuleFilterBar>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From</span>
          <input className={fieldInputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To</span>
          <input className={fieldInputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </ModuleFilterBar>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500">Canceled lines</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">{rows.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500">Total qty canceled</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">{totals.qty}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500">Value canceled</div>
          <div className="text-xl font-semibold text-rose-600 dark:text-rose-400">{formatPkr(totals.amount)}</div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
          Loading cancellations…
        </div>
      ) : query.isError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          Could not load cancellations:{" "}
          {query.error instanceof Error ? query.error.message : "Unknown error"}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
          No kitchen cancellations in this date range. They appear when an already-sent item is removed/qty-cut, or when
          an open (unpaid) order is Closed from Latest orders.
        </div>
      ) : (
        <SimpleTable<KitchenLineCancellation>
          rowKey={(r) => r.id}
          columns={[
            {
              key: "canceledAt",
              header: "When",
              render: (r) => formatWhen(r.canceledAt),
            },
            {
              key: "orderRef",
              header: "Order",
              render: (r) => r.orderRef ?? "—",
            },
            { key: "ticketRef", header: "KOT" },
            { key: "stationLabel", header: "Station" },
            { key: "label", header: "Item" },
            { key: "qtyCanceled", header: "Qty" },
            {
              key: "amountPkr",
              header: "Amount",
              render: (r) => formatPkr(r.amountPkr),
            },
            {
              key: "ticketStatusAtCancel",
              header: "Kitchen status",
              render: (r) => r.ticketStatusAtCancel,
            },
            {
              key: "canceledByName",
              header: "Canceled by",
              render: (r) => r.canceledByName ?? "—",
            },
            {
              key: "source",
              header: "Source",
              render: (r) => sourceLabel(r.source),
            },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
