import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { filterByPeriod, formatPkr, recordLedgerPayment } from "../lib/mobizoneStore";
import { MzField, MzSecondaryButton, MzSelect, MzStat } from "../ui/MobizoneUi";

type Period = "daily" | "weekly" | "monthly" | "all";

export function MobizoneReportsPage(): JSX.Element {
  const { db } = useMobizoneDb();
  const [period, setPeriod] = useState<Period>("daily");
  const sales = useMemo(
    () => filterByPeriod(db.sales.filter((s) => !s.returnedAt), period),
    [db.sales, period],
  );
  const purchases = useMemo(() => filterByPeriod(db.purchases, period), [db.purchases, period]);
  const salesTotal = sales.reduce((a, s) => a + s.pricePkr, 0);
  const purchaseTotal = purchases.reduce((a, p) => a + p.purchasePricePkr, 0);
  const cashIn = sales.reduce((a, s) => a + (s.payment.cashPkr || 0), 0);
  const bankIn = sales.reduce((a, s) => a + (s.payment.bankPkr || 0), 0);
  const cashOut = purchases.reduce((a, p) => a + (p.payment.cashPkr || 0), 0);
  const bankOut = purchases.reduce((a, p) => a + (p.payment.bankPkr || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Sale & purchase reports" subtitle="Daily, weekly, and monthly trade summaries with cash vs bank." />
      <MzField label="Period">
        <MzSelect value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="max-w-xs">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="all">All time</option>
        </MzSelect>
      </MzField>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MzStat label="Sales count" value={sales.length} />
        <MzStat label="Sales total" value={formatPkr(salesTotal)} />
        <MzStat label="Purchases total" value={formatPkr(purchaseTotal)} />
        <MzStat label="Cash in (sales)" value={formatPkr(cashIn)} />
        <MzStat label="Bank in (sales)" value={formatPkr(bankIn)} />
        <MzStat label="Cash out (buys)" value={formatPkr(cashOut)} />
        <MzStat label="Bank out (buys)" value={formatPkr(bankOut)} />
        <MzStat label="Net cash" value={formatPkr(cashIn - cashOut)} />
        <MzStat label="Net bank" value={formatPkr(bankIn - bankOut)} />
      </div>
      <p className={`text-sm ${mutedClass}`}>
        Tip: open Sync & backup from the sidebar to protect this branch&apos;s MobiZone records.
      </p>
    </div>
  );
}

export function MobizoneProfitPage(): JSX.Element {
  const { db } = useMobizoneDb();
  const [period, setPeriod] = useState<Period>("monthly");
  const sales = useMemo(
    () => filterByPeriod(db.sales.filter((s) => !s.returnedAt), period),
    [db.sales, period],
  );
  const expenses = useMemo(
    () => filterByPeriod(db.expenses ?? [], period),
    [db.expenses, period],
  );
  const revenue = sales.reduce((a, s) => a + s.pricePkr, 0);
  const cost = sales.reduce((a, s) => a + s.costPkr, 0);
  const grossProfit = sales.reduce((a, s) => a + s.profitPkr, 0);
  const expenseTotal = expenses.reduce((a, x) => a + x.amountPkr, 0);
  const netProfit = grossProfit - expenseTotal;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit / loss"
        subtitle="Gross phone profit (sale − purchase cost), minus shop expenses (salary, food, rent, etc.)."
      />
      <MzField label="Period">
        <MzSelect value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="max-w-xs">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="all">All time</option>
        </MzSelect>
      </MzField>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MzStat label="Revenue" value={formatPkr(revenue)} />
        <MzStat label="Cost of goods" value={formatPkr(cost)} />
        <MzStat label="Gross profit" value={formatPkr(grossProfit)} />
        <MzStat label="Expenses" value={formatPkr(expenseTotal)} />
        <MzStat label="Net profit" value={formatPkr(netProfit)} />
      </div>
      <p className={`text-sm ${mutedClass}`}>
        Expenses add karne ke baad net profit automatically update hota hai — Expenses page se khana, salary, rent,
        courier wagaira record karein.
      </p>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Phone profits
      </h3>
      <ul className="space-y-2">
        {sales.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {s.brand} {s.model}
              </p>
              <p className={`font-mono text-xs ${mutedClass}`}>{s.imei}</p>
            </div>
            <p className={`text-sm font-semibold tabular-nums ${s.profitPkr >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatPkr(s.profitPkr)}
            </p>
          </li>
        ))}
        {sales.length === 0 ? <p className={`text-sm ${mutedClass}`}>No sold phones in this period.</p> : null}
      </ul>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Expenses deducted
      </h3>
      <ul className="space-y-2">
        {expenses.map((x) => (
          <li
            key={x.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{x.title}</p>
              <p className={`text-xs ${mutedClass}`}>
                {x.method} · {new Date(x.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              −{formatPkr(x.amountPkr)}
            </p>
          </li>
        ))}
        {expenses.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>Is period mein koi expense nahi — net = gross profit.</p>
        ) : null}
      </ul>
    </div>
  );
}

export function MobizonePaymentsPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const receivables = db.sales.filter((s) => !s.returnedAt && s.remainingPkr > 0);
  const payables = db.purchases.filter((p) => (p.remainingPkr || 0) > 0);

  function quickReceive(sale: (typeof receivables)[number]): void {
    if (!branchCode || !(sale.remainingPkr > 0)) return;
    const partyKind = sale.shopkeeperId ? "shopkeeper" : "customer";
    const partyId = sale.shopkeeperId ?? sale.customerId;
    if (!partyId) return;
    const cash = window.confirm(
      `${formatPkr(sale.remainingPkr)} receive karna hai?\nOK = Cash · Cancel = Bank`,
    );
    try {
      recordLedgerPayment(branchCode, {
        partyKind,
        partyId,
        direction: "receive",
        amountPkr: sale.remainingPkr,
        method: cash ? "cash" : "bank",
        bankAccountId: cash ? null : db.bankAccounts[0]?.id ?? null,
        applyToSaleId: sale.id,
        note: "Quick receive from pending list",
      });
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending payments"
        subtitle="Receivables (lena) from sales and payables (dena) on udhaar purchases — clear them from Udhaar & ledger."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MzStat label="Open receivables" value={receivables.length} />
        <MzStat label="Total to receive" value={formatPkr(receivables.reduce((a, s) => a + s.remainingPkr, 0))} />
        <MzStat label="Open payables" value={payables.length} />
        <MzStat
          label="Total to pay"
          value={formatPkr(payables.reduce((a, p) => a + (p.remainingPkr || 0), 0))}
        />
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Receivables (customers / shops)
      </h3>
      <ul className="space-y-2">
        {receivables.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{s.customerName}</p>
              <p className={`text-xs ${mutedClass}`}>
                {s.brand} {s.model} · due {s.dueDate || "—"} · {s.customerPhone || "no phone"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatPkr(s.remainingPkr)}</p>
              {s.shopkeeperId || s.customerId ? (
                <MzSecondaryButton onClick={() => quickReceive(s)}>Receive</MzSecondaryButton>
              ) : null}
            </div>
          </li>
        ))}
        {receivables.length === 0 ? <p className={`text-sm ${mutedClass}`}>No receivables.</p> : null}
      </ul>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Payables (udhaar purchases)
      </h3>
      <ul className="space-y-2">
        {payables.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{p.sellerName}</p>
              <p className={`text-xs ${mutedClass}`}>
                {p.brand} {p.model} · due {p.dueDate || "—"}
              </p>
            </div>
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              {formatPkr(p.remainingPkr || 0)}
            </p>
          </li>
        ))}
        {payables.length === 0 ? <p className={`text-sm ${mutedClass}`}>No payables.</p> : null}
      </ul>
    </div>
  );
}
