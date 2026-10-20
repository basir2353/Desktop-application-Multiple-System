import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, returnPurchase, returnSale } from "../lib/mobizoneStore";
import { MzField, MzInput, MzPage, MzPrimaryButton, MzSection } from "../ui/MobizoneUi";

export function MobizoneSaleReturnPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.sales
      .filter((s) => !s.returnedAt)
      .filter((s) => {
        if (!needle) return true;
        return (
          s.imei.toLowerCase().includes(needle) ||
          s.customerName.toLowerCase().includes(needle) ||
          s.brand.toLowerCase().includes(needle) ||
          s.model.toLowerCase().includes(needle) ||
          (s.customerPhone ?? "").toLowerCase().includes(needle)
        );
      });
  }, [db.sales, q]);

  function onReturn(saleId: string, label: string): void {
    if (!branchCode) return;
    if (!window.confirm(`Sale return: ${label}? The amount will be logged back to the customer and the phone will return to stock.`)) {
      return;
    }
    try {
      returnSale(branchCode, saleId, "Sale return counter");
      setErr(null);
      setMsg("Sale return done — phone added back to stock.");
      refresh();
    } catch (e) {
      setMsg(null);
      setErr(e instanceof Error ? e.message : "Sale return failed");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Sale return"
        subtitle="Return a sold phone — find by IMEI or customer, then restock and refund."
      />
      <MzSection title="Find sale">
        <MzField label="IMEI / customer / model">
          <MzInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scan IMEI or type name…"
            autoFocus
          />
        </MzField>
        {msg ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
        {err ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{err}</p> : null}
      </MzSection>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>No open sales found (or already returned).</p>
        ) : null}
        {rows.map((s) => (
          <article key={s.id} className={`${cardClass} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {s.brand} {s.model}
              </p>
              <p className={`text-xs ${mutedClass}`}>
                {s.customerName} · {s.imei} · {formatPkr(s.pricePkr)}
              </p>
              <p className={`text-xs ${mutedClass}`}>{new Date(s.createdAt).toLocaleString()}</p>
            </div>
            <MzPrimaryButton onClick={() => onReturn(s.id, `${s.brand} ${s.model} (${s.imei})`)}>
              Return sale
            </MzPrimaryButton>
          </article>
        ))}
      </div>
    </MzPage>
  );
}

export function MobizonePurchaseReturnPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const inStockIds = new Set(db.devices.filter((d) => d.status === "in_stock").map((d) => d.id));
    return db.purchases
      .filter((p) => !p.returnedAt && inStockIds.has(p.deviceId))
      .filter((p) => {
        if (!needle) return true;
        return (
          p.imei.toLowerCase().includes(needle) ||
          p.sellerName.toLowerCase().includes(needle) ||
          p.brand.toLowerCase().includes(needle) ||
          p.model.toLowerCase().includes(needle) ||
          (p.sellerPhone ?? "").toLowerCase().includes(needle)
        );
      });
  }, [db.purchases, db.devices, q]);

  function onReturn(purchaseId: string, label: string): void {
    if (!branchCode) return;
    if (
      !window.confirm(
        `Purchase return: ${label}? The phone will leave stock and the paid amount will be logged as received back.`,
      )
    ) {
      return;
    }
    try {
      returnPurchase(branchCode, purchaseId, "Purchase return counter");
      setErr(null);
      setMsg("Purchase return done — phone removed from stock.");
      refresh();
    } catch (e) {
      setMsg(null);
      setErr(e instanceof Error ? e.message : "Purchase return failed");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Purchase return"
        subtitle="Return a bought phone to the seller — only phones still in stock."
      />
      <MzSection title="Find purchase">
        <MzField label="IMEI / seller / model">
          <MzInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scan IMEI or type seller…"
            autoFocus
          />
        </MzField>
        {msg ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
        {err ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{err}</p> : null}
      </MzSection>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>
            No returnable purchases (sold phones need a sale return first).
          </p>
        ) : null}
        {rows.map((p) => (
          <article key={p.id} className={`${cardClass} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {p.brand} {p.model}
              </p>
              <p className={`text-xs ${mutedClass}`}>
                {p.sellerName} · {p.imei} · {formatPkr(p.purchasePricePkr)}
              </p>
              <p className={`text-xs ${mutedClass}`}>{new Date(p.createdAt).toLocaleString()}</p>
            </div>
            <MzPrimaryButton onClick={() => onReturn(p.id, `${p.brand} ${p.model} (${p.imei})`)}>
              Return purchase
            </MzPrimaryButton>
          </article>
        ))}
      </div>
    </MzPage>
  );
}
