import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../pops/ui/PageHeader";
import { fetchTradeFlowDashboard } from "../api/tradeflow";
import { formatPkr, useTradeFlowAccess } from "../hooks/useTradeFlow";

const GROUPS = [
  {
    title: "Sales",
    items: [
      { to: "/pops/tradeflow/pos", title: "POS", note: "Cash or credit billing with party rates" },
      { to: "/pops/tradeflow/invoices", title: "Invoices", note: "Print A4, A5, thermal and send WhatsApp" },
      { to: "/pops/tradeflow/bookings", title: "Bookings", note: "Advance, issued qty, and remaining value" },
    ],
  },
  {
    title: "Parties",
    items: [
      { to: "/pops/tradeflow/customers", title: "Parties", note: "Customers, suppliers, phone, and closing balance" },
      { to: "/pops/tradeflow/ledger", title: "Ledger", note: "Booking, payments, sales, items, and returns" },
      { to: "/pops/tradeflow/payments", title: "Payments", note: "Receive from customers or pay suppliers" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { to: "/pops/tradeflow/items", title: "Items", note: "Qty unit and amount unit on one item" },
      { to: "/pops/tradeflow/stock", title: "Stock", note: "On hand, booked, and free in both units" },
    ],
  },
  {
    title: "Purchases & accounts",
    items: [
      { to: "/pops/tradeflow/purchases", title: "Purchases", note: "Supplier invoice with current balance" },
      { to: "/pops/tradeflow/returns", title: "Returns", note: "Sales return and purchase return" },
      { to: "/pops/tradeflow/notes", title: "Credit / Debit", note: "Adjust customer or supplier balance" },
      { to: "/pops/tradeflow/journal", title: "Journal", note: "Debit one account, credit another" },
      { to: "/pops/tradeflow/contra", title: "Contra", note: "Cash to bank and bank to bank" },
    ],
  },
  {
    title: "Communications & operations",
    items: [
      { to: "/pops/tradeflow/settings", title: "WhatsApp", note: "Invoices, reminders, and supplier messages" },
      { to: "/pops/tradeflow/mobile", title: "Mobile", note: "Phone-sized sales, purchase, and payments" },
      { to: "/pops/printer", title: "Printer", note: "Assign A4, A5, and thermal printers" },
    ],
  },
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today sales" value={m ? formatPkr(m.todaySalesPkr) : "—"} />
        <Stat label="Today expenses" value={m ? formatPkr(m.todayExpensesPkr) : "—"} />
        <Stat label="Today profit" value={m ? formatPkr(m.todayProfitPkr) : "—"} />
        <Stat label="Receipts" value={m ? formatPkr(m.todayReceiptsPkr) : "—"} />
        <Stat label="Payments" value={m ? formatPkr(m.todayPaymentsPkr) : "—"} />
        <Stat label="Purchases" value={m ? formatPkr(m.todayPurchasesPkr) : "—"} />
        <Stat label="Returns" value={m ? formatPkr(m.todayReturnsPkr) : "—"} />
        <Stat label="Open bookings" value={m?.openBookings ?? "—"} />
      </div>
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((link) => (
              <Link key={link.to} to={link.to} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900/40">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{link.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{link.note}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
