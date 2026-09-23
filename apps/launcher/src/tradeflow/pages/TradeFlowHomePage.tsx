import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { fetchTradeFlowDashboard } from "../api/tradeflow";
import { formatPkr, useTradeFlowAccess } from "../hooks/useTradeFlow";
import "../tradeflow.css";

const SHORTCUTS = [
  { to: "/pops/tradeflow/pos", title: "POS", note: "Cash or credit billing" },
  { to: "/pops/tradeflow/bookings", title: "Bookings", note: "Advances and reserved qty" },
  { to: "/pops/tradeflow/ledger", title: "Ledger", note: "Party khata and filters" },
  { to: "/pops/tradeflow/stock", title: "Stock", note: "On hand, booked, free" },
] as const;

export function TradeFlowHomePage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const dashboardQuery = useQuery({
    queryKey: ["tradeflow", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowDashboard(branch!.code),
  });
  const m = dashboardQuery.data;

  return (
    <div className="tf-app space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Daily wholesale position for ${branch?.name ?? "this branch"}.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today sales" value={m ? formatPkr(m.todaySalesPkr) : "—"} />
        <Stat label="Today expenses" value={m ? formatPkr(m.todayExpensesPkr) : "—"} />
        <Stat label="Today profit" value={m ? formatPkr(m.todayProfitPkr) : "—"} />
        <Stat label="Receipts" value={m ? formatPkr(m.todayReceiptsPkr) : "—"} />
        <Stat label="Payments" value={m ? formatPkr(m.todayPaymentsPkr) : "—"} />
        <Stat label="Purchases" value={m ? formatPkr(m.todayPurchasesPkr) : "—"} />
        <Stat label="Returns" value={m ? formatPkr(m.todayReturnsPkr) : "—"} />
        <Stat label="Open bookings" value={m?.openBookings ?? "—"} />
      </div>
      <section className="space-y-3">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${mutedClass}`}>Workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SHORTCUTS.map((link) => (
            <Link key={link.to} to={link.to} className="tf-shortcut rounded-lg border border-slate-200 bg-white p-4 transition hover:border-amber-600/40 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{link.title}</h3>
              <p className={`mt-1 text-sm ${mutedClass}`}>{link.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className={`${cardClass} p-4`}>
      <p className={`text-xs uppercase tracking-wide ${mutedClass}`}>{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
