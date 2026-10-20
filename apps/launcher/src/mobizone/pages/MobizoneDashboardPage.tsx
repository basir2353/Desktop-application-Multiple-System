import { Link } from "react-router-dom";
import { useEffect } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { useMobizoneBranchCode, useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, getMobizoneDashboard, seedFriendlyDefaults } from "../lib/mobizoneStore";
import { MzPage, MzStat } from "../ui/MobizoneUi";

/** Order strip — biggest CTAs on home */
const ORDERS = [
  {
    to: "/pops/mobizone/sell",
    title: "New Sale",
    note: "Customer ko phone becho · cash / bank / udhaar",
    kind: "sale" as const,
  },
  {
    to: "/pops/mobizone/purchase",
    title: "Purchase",
    note: "Phone khareedo · IMEI stock add",
    kind: "buy" as const,
  },
] as const;

/** Everything else — still fully visible */
const ALL = [
  { to: "/pops/mobizone/customers", title: "Customers", note: "CNIC / phone book" },
  { to: "/pops/mobizone/stock", title: "Stock", note: "IMEI inventory" },
  { to: "/pops/mobizone/sales", title: "Total Sales", note: "Aaj + history" },
  { to: "/pops/mobizone/purchases", title: "Total Purchase", note: "Buy ledger" },
  { to: "/pops/mobizone/business-report", title: "Today Profit", note: "Profit print" },
  { to: "/pops/mobizone/ledger", title: "Due Receive", note: "Udhaar / partial" },
  { to: "/pops/mobizone/search", title: "Search", note: "CNIC / IMEI" },
  { to: "/pops/mobizone/imei", title: "Scan", note: "Barcode / sticker" },
  { to: "/pops/mobizone/banks", title: "Banks", note: "Accounts" },
  { to: "/pops/mobizone/expenses", title: "Expenses", note: "Shop costs" },
  { to: "/pops/mobizone/shopkeepers", title: "Shops", note: "Shop 100, 64…" },
  { to: "/pops/mobizone/whatsapp", title: "WhatsApp", note: "Receipt send" },
  { to: "/pops/mobizone/receipt-settings", title: "Bill print", note: "Restaurant-style bill" },
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
        subtitle="Order counter — sale & purchase pehle, baaki modules neeche."
      />

      <p className="mz-section-title" style={{ marginBottom: "-0.35rem" }}>
        Order now
      </p>
      <div className="mz-order-strip">
        {ORDERS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`mz-order-cta mz-order-cta--${link.kind}`}
          >
            <span className="mz-order-eyebrow">
              {link.kind === "sale" ? "Primary order" : "Stock order"}
            </span>
            <span className="mz-order-title">{link.title}</span>
            <span className="mz-order-note">{link.note}</span>
            <span className="mz-order-arrow" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>

      <div className="mz-balance-hero">
        <p className="mz-balance-label">Total balance</p>
        <p className="mz-balance-value">
          {m ? formatPkr(totalBalance + m.stockValuePkr) : "—"}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span style={{ color: "var(--mz-teal)" }}>
            Cash {m ? formatPkr(m.cashBalancePkr) : "—"}
          </span>
          <span style={{ color: "var(--mz-blue)" }}>
            Bank {m ? formatPkr(m.bankBalancePkr) : "—"}
          </span>
          <span style={{ color: "var(--mz-accent)" }}>
            Maal {m ? formatPkr(m.stockValuePkr) : "—"}
          </span>
          <span style={{ color: "var(--mz-muted)" }}>Phones {m?.inStock ?? "—"}</span>
        </div>
      </div>

      <p className="mz-section-title" style={{ marginBottom: "-0.35rem" }}>
        All modules
      </p>
      <div className="mz-quick-grid">
        {ALL.map((link) => (
          <Link key={link.to} to={link.to} className="mz-quick-card">
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
        <MzStat label="Stock (pcs)" value={m?.inStock ?? "—"} />
      </div>
    </MzPage>
  );
}
