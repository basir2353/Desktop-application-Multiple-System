import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../pops/ui/PageHeader";
import { fetchTradeFlowItems } from "../api/tradeflow";
import { useTradeFlowAccess } from "../hooks/useTradeFlow";

export function TradeFlowStockPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const query = useQuery({
    queryKey: ["tradeflow", "items", branch?.code, "stock"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowItems(branch!.code),
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Stock" subtitle="On-hand, booked, and free quantity in both units." />
      {(query.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
          No stock yet. Add items first.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(query.data ?? []).map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <h2 className="font-semibold text-slate-900 dark:text-white">{item.name}</h2>
            <p className="text-xs text-slate-500">{item.sku} · {item.unit} / {item.altUnit}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">On hand</dt>
                <dd className="text-lg font-semibold">{item.onHandQty} {item.unit}</dd>
                <dd className="text-xs text-slate-500">{item.onHandAlt.toLocaleString()} {item.altUnit}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Booked</dt>
                <dd className="text-lg font-semibold text-amber-600">{item.bookedQty} {item.unit}</dd>
                <dd className="text-xs text-slate-500">{item.bookedAlt.toLocaleString()} {item.altUnit}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Free</dt>
                <dd className="text-lg font-semibold text-emerald-600">{item.freeQty}</dd>
                <dd className="text-xs text-slate-500">{item.freeAlt.toLocaleString()} {item.altUnit}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
