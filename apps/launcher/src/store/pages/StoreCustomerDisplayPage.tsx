import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatPkr } from "../hooks/useStore";
import { subscribeCustomerDisplay, type CustomerDisplayState } from "../lib/storePosSync";

export function StoreCustomerDisplayPage(): JSX.Element {
  const [params] = useSearchParams();
  const branchCode = params.get("branch") ?? "default";
  const [display, setDisplay] = useState<CustomerDisplayState | null>(null);

  useEffect(() => {
    return subscribeCustomerDisplay(branchCode, setDisplay);
  }, [branchCode]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <header className="border-b border-white/10 px-8 py-6">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Customer display</p>
        <h1 className="mt-1 text-3xl font-bold">{display?.branchName ?? "General Store"}</h1>
      </header>

      <main className="flex flex-1 gap-8 p-8">
        <section className="flex flex-1 flex-col">
          <h2 className="text-lg font-semibold text-slate-300">Your items</h2>
          <div className="mt-4 flex-1 space-y-3">
            {(display?.lines ?? []).length === 0 ? (
              <p className="text-slate-500">Waiting for cashier to scan items…</p>
            ) : (
              display!.lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-sm text-slate-400">{line.qtyLabel}</p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{formatPkr(line.lineTotal)}</p>
                </div>
              ))
            )}
          </div>

          {display ? (
            <div className="mt-6 space-y-2 border-t border-white/10 pt-6 text-lg">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{formatPkr(display.subtotal)}</span></div>
              {display.tax > 0 ? <div className="flex justify-between text-slate-400"><span>Tax</span><span>{formatPkr(display.tax)}</span></div> : null}
              {display.discount > 0 ? <div className="flex justify-between text-amber-300"><span>Discount</span><span>-{formatPkr(display.discount)}</span></div> : null}
              {display.promotionDiscount > 0 ? <div className="flex justify-between text-emerald-300"><span>Promotions</span><span>-{formatPkr(display.promotionDiscount)}</span></div> : null}
              <div className="flex justify-between text-2xl font-bold"><span>Total</span><span className="text-sky-300">{formatPkr(display.total)}</span></div>
            </div>
          ) : null}
        </section>

        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-600/20 to-indigo-600/20 p-6">
            <p className="text-xs uppercase tracking-wider text-sky-200">Today's offers</p>
            <p className="mt-3 text-xl font-bold leading-snug">{display?.promoMessage ?? "Fresh produce · Loyalty rewards · Bundle deals"}</p>
            <p className="mt-4 text-sm text-slate-300">Earn 1 point per Rs 100 spent. Redeem points on your next visit!</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
