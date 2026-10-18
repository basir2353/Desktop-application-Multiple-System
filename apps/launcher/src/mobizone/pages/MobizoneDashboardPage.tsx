import { Link } from "react-router-dom";
import { useEffect } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { useMobizoneBranchCode, useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, getMobizoneDashboard, seedFriendlyDefaults } from "../lib/mobizoneStore";
import { MzPage, MzStat } from "../ui/MobizoneUi";

const QUICK = [
  { to: "/pops/mobizone/sell", title: "New Sale", note: "Customer ko phone becho", primary: true },
  { to: "/pops/mobizone/purchase", title: "New Purchase", note: "Phone khareedo", primary: true },
  { to: "/pops/mobizone/customers", title: "Customers", note: "CNIC / phone book" },
  { to: "/pops/mobizone/stock", title: "Stock", note: "IMEI inventory" },
  { to: "/pops/mobizone/search", title: "Search", note: "CNIC / IMEI" },
  { to: "/pops/mobizone/imei", title: "Scan", note: "Barcode / sticker" },
  { to: "/pops/mobizone/ledger", title: "Udhaar", note: "Partial payment" },
  { to: "/pops/mobizone/banks", title: "Banks", note: "Accounts" },
  { to: "/pops/mobizone/business-report", title: "Report", note: "Profit print" },
  { to: "/pops/mobizone/expenses", title: "Expenses", note: "Shop costs" },
  { to: "/pops/mobizone/shopkeepers", title: "Shops", note: "Shop 100, 64…" },
  { to: "/pops/mobizone/whatsapp", title: "WhatsApp", note: "Receipt send" },
] as const;

export function MobizoneDashboardPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const { refresh } = useMobizoneDb();
  const m = branchCode ? getMobizoneDashboard(branchCode) : null;
  const totalBalance = (m?.cashBalancePkr ?? 0) + (m?.bankBalancePkr ?? 0);

  useEffect(() => {
    if (!branchCode) return;
    seedFriendlyDefaults(branchCode);
    refresh();
  }, [branchCode, refresh]);

  return (
    <MzPage>
      <PageHeader
        title="MobiZone"
        subtitle="Mobile Business Management — buy, sell, stock, udhaar, banks, WhatsApp."
      />

      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Balance</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-amber-400">
          {m ? formatPkr(totalBalance) : "—"}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="text-teal-400">Cash {m ? formatPkr(m.cashBalancePkr) : "—"}</span>
          <span className="text-sky-400">Bank {m ? formatPkr(m.bankBalancePkr) : "—"}</span>
          <span className="text-slate-300">Stock {m?.inStock ?? "—"}</span>
        </div>
      </div>

      <div className="mz-quick-grid">
        {QUICK.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`mz-quick-card${"primary" in link && link.primary ? " mz-quick-card--primary" : ""}`}
          >
            <span className="mz-quick-title">{link.title}</span>
            <span className="mz-quick-note">{link.note}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <MzStat label="Aaj sales" value={m ? formatPkr(m.todaySalesPkr) : "—"} />
        <MzStat label="Aaj buy" value={m ? formatPkr(m.todayPurchasesPkr) : "—"} />
        <MzStat label="Aaj profit" value={m ? formatPkr(m.todayProfitPkr) : "—"} />
        <MzStat label="Lena baqi" value={m ? formatPkr(m.pendingReceivablesPkr) : "—"} />
        <MzStat label="Dena baqi" value={m ? formatPkr(m.pendingPayablesPkr) : "—"} />
        <MzStat label="Cash" value={m ? formatPkr(m.cashBalancePkr) : "—"} />
        <MzStat label="Bank" value={m ? formatPkr(m.bankBalancePkr) : "—"} />
        <MzStat label="Stock" value={m?.inStock ?? "—"} />
      </div>
    </MzPage>
  );
}
