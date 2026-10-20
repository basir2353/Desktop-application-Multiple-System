import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { useMobizoneBranchCode, useMobizoneDb } from "../hooks/useMobizone";
import {
  bankLedgerName,
  formatPkr,
  getCashBankBalances,
  getMobizoneDashboard,
  seedFriendlyDefaults,
} from "../lib/mobizoneStore";
import { MzPage, MzStat } from "../ui/MobizoneUi";

/** Order strip — biggest CTAs on home */
const ORDERS = [
  {
    to: "/pops/mobizone/sell",
    title: "New Sale",
    note: "Sell phone to customer · cash / bank / credit",
    kind: "sale" as const,
    eyebrow: "Primary order",
  },
  {
    to: "/pops/mobizone/purchase",
    title: "Purchase",
    note: "Buy phone · add IMEI to stock",
    kind: "buy" as const,
    eyebrow: "Stock order",
  },
  {
    to: "/pops/mobizone/sale-return",
    title: "Sale Return",
    note: "Return sold phone · restock + refund",
    kind: "sale" as const,
    eyebrow: "Return order",
  },
  {
    to: "/pops/mobizone/purchase-return",
    title: "Purchase Return",
    note: "Return bought phone to seller · remove from stock",
    kind: "buy" as const,
    eyebrow: "Return order",
  },
] as const;

/** Everything else — still fully visible */
const ALL = [
  { to: "/pops/mobizone/customers", title: "Customers", note: "CNIC / phone book" },
  { to: "/pops/mobizone/stock", title: "Stock", note: "IMEI inventory" },
  { to: "/pops/mobizone/sales", title: "Total Sales", note: "Today + history" },
  { to: "/pops/mobizone/purchases", title: "Total Purchase", note: "Buy ledger" },
  { to: "/pops/mobizone/business-report", title: "Today Profit", note: "Profit print" },
  { to: "/pops/mobizone/ledger", title: "Due Receive", note: "Credit / partial" },
  { to: "/pops/mobizone/search", title: "Universal Search", note: "Product / customer history" },
  { to: "/pops/mobizone/legal-record", title: "Legal record", note: "Seller KYC + invoice" },
  { to: "/pops/mobizone/imei", title: "Scan", note: "Barcode / sticker" },
  { to: "/pops/mobizone/banks", title: "Banks", note: "Accounts" },
  { to: "/pops/mobizone/expenses", title: "Create Expense", note: "Record by account" },
  { to: "/pops/mobizone/expense-accounts", title: "Account Expense", note: "Rent, Electricity…" },
  { to: "/pops/mobizone/contra-voucher", title: "Contra Voucher", note: "Cash ↔ Bank" },
  { to: "/pops/mobizone/general-voucher", title: "General Voucher", note: "Double entry" },
  { to: "/pops/mobizone/shopkeepers", title: "Shops", note: "Shop 100, 64…" },
  { to: "/pops/mobizone/whatsapp", title: "WhatsApp", note: "Receipt send" },
  { to: "/pops/mobizone/receipt-settings", title: "Bill print", note: "Restaurant-style bill" },
] as const;

export function MobizoneDashboardPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const { db, refresh } = useMobizoneDb();
  const m = branchCode ? getMobizoneDashboard(branchCode) : null;
  const money = useMemo(() => getCashBankBalances(db), [db]);
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
        subtitle="Order counter — sale & purchase first, other modules below."
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
            <span className="mz-order-eyebrow">{link.eyebrow}</span>
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
            Stock {m ? formatPkr(m.stockValuePkr) : "—"}
          </span>
          <span style={{ color: "var(--mz-muted)" }}>Phones {m?.inStock ?? "—"}</span>
        </div>

        <div className="mz-balance-ledgers">
          <p className="mz-balance-ledgers-label">Ledgers / reports</p>
          <div className="mz-balance-ledger-row">
            <Link to="/pops/mobizone/money-ledger?kind=cash" className="mz-balance-ledger-chip">
              <span className="mz-balance-ledger-name">Cash Ledger</span>
              <span className="mz-balance-ledger-amt">{formatPkr(money.cash)}</span>
            </Link>
            {db.bankAccounts.map((a) => (
              <Link
                key={a.id}
                to={`/pops/mobizone/money-ledger?kind=bank&accountId=${a.id}`}
                className="mz-balance-ledger-chip mz-balance-ledger-chip--bank"
              >
                <span className="mz-balance-ledger-name">{bankLedgerName(a)} Ledger</span>
                <span className="mz-balance-ledger-amt">
                  {formatPkr(money.byAccount[a.id] ?? a.openingBalancePkr ?? 0)}
                </span>
              </Link>
            ))}
          </div>
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
        <MzStat label="Today sales" value={m ? formatPkr(m.todaySalesPkr) : "—"} />
        <MzStat label="Today buy" value={m ? formatPkr(m.todayPurchasesPkr) : "—"} />
        <MzStat label="Today profit" value={m ? formatPkr(m.todayProfitPkr) : "—"} />
        <MzStat label="Receivable" value={m ? formatPkr(m.pendingReceivablesPkr) : "—"} />
        <MzStat label="Payable" value={m ? formatPkr(m.pendingPayablesPkr) : "—"} />
        <MzStat label="Cash" value={m ? formatPkr(m.cashBalancePkr) : "—"} />
        <MzStat label="Bank" value={m ? formatPkr(m.bankBalancePkr) : "—"} />
        <MzStat label="Stock (pcs)" value={m?.inStock ?? "—"} />
      </div>
    </MzPage>
  );
}
