import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  buildWhatsAppPurchaseText,
  buildWhatsAppSaleText,
  formatPkr,
  openWhatsApp,
  returnSale,
} from "../lib/mobizoneStore";
import { MzPage, MzSecondaryButton } from "../ui/MobizoneUi";

export function MobizoneSalesHistoryPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();

  function onReturn(saleId: string): void {
    if (!branchCode) return;
    if (!window.confirm("Return this phone to stock? Received amount will be logged as paid back.")) return;
    try {
      returnSale(branchCode, saleId, "Customer return");
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Return failed");
    }
  }

  return (
    <MzPage>
      <PageHeader title="Sales history" subtitle="Cash/bank split, dues, warranty — return to stock if needed." />
      <div className="space-y-3 md:hidden">
        {db.sales.length === 0 ? <p className={`text-sm ${mutedClass}`}>No sales yet.</p> : null}
        {db.sales.map((s) => (
          <article key={s.id} className={`${cardClass} space-y-2 p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {s.brand} {s.model}
                  {s.returnedAt ? " · RETURNED" : ""}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {s.customerName} · {s.imei}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatPkr(s.pricePkr)}</p>
            </div>
            <p className={`text-xs ${mutedClass}`}>
              Cash {formatPkr(s.payment.cashPkr || 0)} · Bank {formatPkr(s.payment.bankPkr || 0)} · Due{" "}
              {formatPkr(s.remainingPkr)}
              {s.warrantyDays ? ` · Warranty ${s.warrantyDays}d` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <MzSecondaryButton onClick={() => openWhatsApp(s.customerPhone, buildWhatsAppSaleText(s))}>
                WhatsApp
              </MzSecondaryButton>
              {!s.returnedAt ? (
                <MzSecondaryButton onClick={() => onReturn(s.id)}>Return to stock</MzSecondaryButton>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <div className={`hidden md:block ${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
            <tr>
              <th className="px-4 py-3">Sale</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {db.sales.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {s.brand} {s.model}
                    {s.returnedAt ? " (returned)" : ""}
                  </div>
                  <div className={`text-xs ${mutedClass}`}>
                    {s.customerName} · {s.imei}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold">{formatPkr(s.pricePkr)}</td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>
                  Cash {formatPkr(s.payment.cashPkr || 0)} · Bank {formatPkr(s.payment.bankPkr || 0)} · Due{" "}
                  {formatPkr(s.remainingPkr)}
                  {s.warrantyDays ? ` · W ${s.warrantyDays}d` : ""}
                </td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>{new Date(s.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <MzSecondaryButton onClick={() => openWhatsApp(s.customerPhone, buildWhatsAppSaleText(s))}>
                      WhatsApp
                    </MzSecondaryButton>
                    {!s.returnedAt ? (
                      <MzSecondaryButton onClick={() => onReturn(s.id)}>Return</MzSecondaryButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {db.sales.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${mutedClass}`}>
                  No sales yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </MzPage>
  );
}

export function MobizonePurchasesHistoryPage(): JSX.Element {
  const { db } = useMobizoneDb();
  return (
    <MzPage>
      <PageHeader title="Purchase history" subtitle="Bought phones with identity and payment split." />
      <div className="space-y-3 md:hidden">
        {db.purchases.length === 0 ? <p className={`text-sm ${mutedClass}`}>No purchases yet.</p> : null}
        {db.purchases.map((p) => (
          <article key={p.id} className={`${cardClass} space-y-2 p-3`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {p.brand} {p.model}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {p.sellerName} · {p.imei}
                </p>
              </div>
              <p className="font-semibold">{formatPkr(p.purchasePricePkr)}</p>
            </div>
            <p className={`text-xs ${mutedClass}`}>
              Paid {formatPkr(p.paidPkr || 0)} · Udhaar {formatPkr(p.remainingPkr || 0)}
            </p>
            <MzSecondaryButton onClick={() => openWhatsApp(p.sellerPhone, buildWhatsAppPurchaseText(p))}>
              WhatsApp
            </MzSecondaryButton>
          </article>
        ))}
      </div>
      <div className={`hidden md:block ${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
            <tr>
              <th className="px-4 py-3">Purchase</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {db.purchases.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {p.brand} {p.model}
                  </div>
                  <div className={`text-xs ${mutedClass}`}>
                    {p.sellerName} · {p.imei}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">{formatPkr(p.purchasePricePkr)}</td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>
                  Cash {formatPkr(p.payment.cashPkr || 0)} · Bank {formatPkr(p.payment.bankPkr || 0)} · Udhaar{" "}
                  {formatPkr(p.remainingPkr || 0)}
                </td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>{new Date(p.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <MzSecondaryButton onClick={() => openWhatsApp(p.sellerPhone, buildWhatsAppPurchaseText(p))}>
                    WhatsApp
                  </MzSecondaryButton>
                </td>
              </tr>
            ))}
            {db.purchases.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${mutedClass}`}>
                  No purchases yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </MzPage>
  );
}
