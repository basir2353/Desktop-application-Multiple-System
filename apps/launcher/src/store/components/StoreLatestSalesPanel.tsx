import type { StoreSale } from "@platform/contracts";
import { useMemo, useState } from "react";
import { formatPkr } from "../hooks/useStore";

type Props = {
  held: StoreSale[];
  recent: StoreSale[];
  isLoading?: boolean;
  onResume: (sale: StoreSale) => void;
  onReprint?: (sale: StoreSale) => void;
};

export function StoreLatestSalesPanel({
  held,
  recent,
  isLoading,
  onResume,
  onReprint,
}: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "held" | "paid">("all");

  const cards = useMemo(() => {
    const heldCards = held.map((s) => ({ sale: s, kind: "held" as const }));
    const paidCards = recent.map((s) => ({ sale: s, kind: "paid" as const }));
    let list =
      filter === "held" ? heldCards : filter === "paid" ? paidCards : [...heldCards, ...paidCards];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.sale.invoiceNumber.toLowerCase().includes(q) ||
          (c.sale.heldLabel ?? "").toLowerCase().includes(q) ||
          (c.sale.customerName ?? "").toLowerCase().includes(q),
      );
    }
    return list.slice(0, 30);
  }, [held, recent, filter, search]);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Latest sales</h3>
          <span className="text-[10px] text-slate-500">{cards.length} shown</span>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice…"
            className="w-full flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
          <div className="flex shrink-0 gap-1">
            {(
              [
                ["all", "All"],
                ["held", "Held"],
                ["paid", "Paid"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  filter === id
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {isLoading ? (
          <p className="p-4 text-center text-xs text-slate-500">Loading…</p>
        ) : cards.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">No recent sales</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {cards.map(({ sale, kind }) => (
              <div
                key={sale.id}
                className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                      {sale.heldLabel ?? sale.invoiceNumber}
                    </p>
                    <p className="truncate text-[9px] text-slate-500">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                      kind === "held"
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {kind === "held" ? "Held" : "Paid"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {formatPkr(sale.total)}
                </p>
                {sale.customerName ? (
                  <p className="truncate text-[9px] text-slate-500">{sale.customerName}</p>
                ) : null}
                <div className="mt-auto flex gap-1 pt-2">
                  {kind === "held" ? (
                    <button
                      type="button"
                      onClick={() => onResume(sale)}
                      className="flex-1 rounded-md bg-gradient-to-b from-amber-400 to-amber-500 py-1.5 text-[10px] font-bold text-slate-950 hover:from-amber-300 hover:to-amber-400"
                    >
                      Resume
                    </button>
                  ) : null}
                  {onReprint ? (
                    <button
                      type="button"
                      onClick={() => onReprint(sale)}
                      className={`rounded-md border border-slate-300 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 ${
                        kind === "held" ? "flex-1" : "w-full"
                      }`}
                    >
                      Print
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
