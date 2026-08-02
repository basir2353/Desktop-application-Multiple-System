import type { Bill, BankTransaction, RestaurantReport } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBankTransactions } from "../../api/accounting";
import { fetchCompletedOrders } from "../../api/billing";
import { formatPkr } from "../../hooks/useInventory";
import { karachiDateKey, karachiTime, timeToMinutes } from "../../lib/orderSales";
import { SimpleTable } from "../../ui/SimpleTable";

type CashSection =
  | "deliveryCharges"
  | "serviceCharges"
  | "tax16"
  | "tax8"
  | "taxOther"
  | "discount"
  | "canceledOrders"
  | "cashReceived"
  | "remainingCash"
  | "cardReceived"
  | "walletReceived"
  | "bankPos"
  | `bank:${string}`;

type DetailRow = {
  id: string;
  label: string;
  amount: number;
  qty?: number;
  meta?: string;
  href?: string;
};

const CARD_ACCENT: Record<string, string> = {
  deliveryCharges: "border-orange-500/40 bg-orange-500/10",
  serviceCharges: "border-emerald-500/40 bg-emerald-500/10",
  tax16: "border-amber-500/40 bg-amber-500/10",
  tax8: "border-sky-500/40 bg-sky-500/10",
  taxOther: "border-violet-500/40 bg-violet-500/10",
  discount: "border-rose-500/40 bg-rose-500/10",
  canceledOrders: "border-red-500/40 bg-red-500/10",
  cashReceived: "border-lime-500/40 bg-lime-500/10",
  remainingCash: "border-teal-500/40 bg-teal-500/10",
  cardReceived: "border-indigo-500/40 bg-indigo-500/10",
  walletReceived: "border-fuchsia-500/40 bg-fuchsia-500/10",
  bankPos: "border-cyan-500/40 bg-cyan-500/10",
};

/** Core Cash Report metrics — shown first in the card grid. */
const CASH_REPORT_CORE_ORDER = [
  "serviceCharges",
  "tax16",
  "tax8",
  "remainingCash",
  "cashReceived",
  "deliveryCharges",
  "discount",
  "canceledOrders",
  "cardReceived",
  "walletReceived",
  "taxOther",
] as const;

function normalizeTime(value?: string, fallback = "00:00"): string {
  if (value && /^\d{2}:\d{2}$/.test(value)) return value;
  return fallback;
}

function inRange(
  iso: string,
  from?: string,
  to?: string,
  fromTime?: string,
  toTime?: string,
): boolean {
  const day = karachiDateKey(iso);
  if (from && day < from) return false;
  if (to && day > to) return false;
  const startT = normalizeTime(fromTime, "00:00");
  const endT = normalizeTime(toTime, "23:59");
  const mins = timeToMinutes(karachiTime(iso));
  if (from && day === from && mins < timeToMinutes(startT)) return false;
  if (to && day === to && mins > timeToMinutes(endT)) return false;
  return true;
}

function paymentTotal(bill: Bill, method: Bill["payments"][number]["method"]): number {
  return (bill.payments ?? [])
    .filter((p) => p.method === method)
    .reduce((s, p) => s + Math.max(0, Math.round(Number(p.amount ?? 0))), 0);
}

function sectionFromRow(row: RestaurantReport["rows"][number]): CashSection {
  const section = typeof row.section === "string" ? row.section : "";
  if (section) return section as CashSection;
  const label = row.label.toLowerCase();
  if (label.includes("delivery")) return "deliveryCharges";
  if (label.includes("service")) return "serviceCharges";
  if (label.includes("16%")) return "tax16";
  if (label.includes("8%")) return "tax8";
  if (label.includes("other tax")) return "taxOther";
  if (label.includes("discount")) return "discount";
  if (label.includes("cancel")) return "canceledOrders";
  if (label.includes("remaining cash")) return "remainingCash";
  if (label.includes("cash received")) return "cashReceived";
  if (label.includes("card")) return "cardReceived";
  if (label.includes("wallet")) return "walletReceived";
  if (label.startsWith("bank ·") || label.startsWith("bank:")) return "bankPos";
  if (label.includes("bank transfer")) return "bankPos";
  return "serviceCharges";
}

function buildBillDetails(section: CashSection, bills: Bill[]): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const bill of bills) {
    let amount = 0;
    if (section === "deliveryCharges") amount = bill.deliveryChargePkr ?? 0;
    else if (section === "serviceCharges") amount = bill.service ?? 0;
    else if (section === "tax16") amount = (bill.taxPct ?? 0) >= 12 ? bill.tax ?? 0 : 0;
    else if (section === "tax8") {
      const pct = bill.taxPct ?? 0;
      amount = pct > 0 && pct < 12 ? bill.tax ?? 0 : 0;
    } else if (section === "taxOther") {
      amount = (bill.tax ?? 0) > 0 && (bill.taxPct ?? 0) <= 0 ? bill.tax ?? 0 : 0;
    } else if (section === "discount") amount = bill.discount ?? 0;
    else if (section === "canceledOrders") amount = bill.total ?? 0;
    else if (section === "cashReceived" || section === "remainingCash") {
      amount = paymentTotal(bill, "cash");
    } else if (section === "cardReceived") amount = paymentTotal(bill, "card");
    else if (section === "walletReceived") amount = paymentTotal(bill, "wallet");
    else if (section === "bankPos") amount = paymentTotal(bill, "bank");
    else continue;

    if (amount <= 0) continue;
    rows.push({
      id: bill.id,
      label: bill.billRef,
      amount,
      qty: 1,
      meta: [bill.tableLabel, bill.waiterName, `${bill.taxPct ?? 0}% tax`, karachiDateKey(bill.createdAt)]
        .filter(Boolean)
        .join(" · "),
      href: "/pops/orders",
    });
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

function buildBankDetails(
  section: CashSection,
  txns: BankTransaction[],
  from?: string,
  to?: string,
): DetailRow[] {
  if (!section.startsWith("bank:")) return [];
  const accountId = section.slice("bank:".length);
  return txns
    .filter((t) => {
      if (t.bankAccountId !== accountId || t.type !== "deposit") return false;
      const day = t.txnDate.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    })
    .map((t) => ({
      id: t.id,
      label: t.txnRef,
      amount: t.amount,
      qty: 1,
      meta: [t.txnDate, t.memo, t.createdBy].filter(Boolean).join(" · "),
      href: "/pops/accounting/bank",
    }));
}

export function CashReportPanel({
  report,
  branchCode,
  from,
  to,
  fromTime,
  toTime,
}: {
  report: RestaurantReport;
  branchCode: string;
  from: string;
  to: string;
  fromTime: string;
  toTime: string;
}): JSX.Element {
  const [activeSection, setActiveSection] = useState<CashSection | null>(null);

  const cards = useMemo(() => {
    return report.rows.map((row) => {
      const section = sectionFromRow(row);
      return {
        section,
        label: row.label,
        amount: Number(row.amount ?? 0),
        qty: Number(row.qty ?? 0),
        meta: row.meta ? String(row.meta) : "",
      };
    });
  }, [report.rows]);

  /** Highlight the core Cash Report metrics the shops ask for first. */
  const primaryCards = useMemo(() => {
    const nonBank = cards.filter((c) => !c.section.startsWith("bank:") && c.section !== "bankPos");
    return [...nonBank].sort((a, b) => {
      const ai = CASH_REPORT_CORE_ORDER.indexOf(a.section as (typeof CASH_REPORT_CORE_ORDER)[number]);
      const bi = CASH_REPORT_CORE_ORDER.indexOf(b.section as (typeof CASH_REPORT_CORE_ORDER)[number]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [cards]);

  const bankCards = cards.filter((c) => c.section.startsWith("bank:") || c.section === "bankPos");

  const billsQuery = useQuery({
    queryKey: ["cash-report-bills", branchCode, from, to, fromTime, toTime, activeSection],
    enabled: Boolean(branchCode && activeSection && !activeSection.startsWith("bank:")),
    queryFn: async () => {
      const all = await fetchCompletedOrders(branchCode);
      const status = activeSection === "canceledOrders" ? "void" : "completed";
      return all.filter(
        (b) => b.status === status && inRange(b.createdAt, from, to, fromTime, toTime),
      );
    },
  });

  const bankTxnQuery = useQuery({
    queryKey: ["cash-report-bank-txns", branchCode],
    enabled: Boolean(branchCode && activeSection?.startsWith("bank:")),
    queryFn: () => fetchBankTransactions(branchCode),
  });

  const activeCard = cards.find((c) => c.section === activeSection) ?? null;

  const detailRows = useMemo(() => {
    if (!activeSection) return [];
    if (activeSection.startsWith("bank:")) {
      return buildBankDetails(activeSection, bankTxnQuery.data ?? [], from, to);
    }
    return buildBillDetails(activeSection, billsQuery.data ?? []);
  }, [activeSection, bankTxnQuery.data, billsQuery.data, from, to]);

  const detailLoading =
    Boolean(activeSection) &&
    (activeSection!.startsWith("bank:") ? bankTxnQuery.isLoading : billsQuery.isLoading);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
              Cash Report
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              Service · 16% / 8% tax · remaining cash · bank accounts
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Click a card to open its bills or bank deposits for this date range
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-right dark:border-slate-700 dark:bg-slate-900/60">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Bills in range</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {Number(report.totals?.bills ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Collections & cash
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primaryCards.map((card) => {
            const selected = activeSection === card.section;
            const accent = CARD_ACCENT[card.section] ?? "border-slate-600/40 bg-slate-800/40";
            return (
              <button
                key={card.section}
                type="button"
                onClick={() =>
                  setActiveSection((prev) => (prev === card.section ? null : card.section))
                }
                className={[
                  "rounded-xl border p-4 text-left transition",
                  accent,
                  selected
                    ? "ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-900/20"
                    : "hover:brightness-110",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {card.label}
                  </span>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                    Qty {card.qty.toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {formatPkr(card.amount)}
                </div>
                {card.meta ? (
                  <p className="mt-2 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {card.meta}
                  </p>
                ) : null}
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
                  {selected ? "Hide details ▲" : "View details →"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Bank accounts received
        </h4>
        {bankCards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bankCards.map((card) => {
              const selected = activeSection === card.section;
              return (
                <button
                  key={card.section}
                  type="button"
                  onClick={() =>
                    setActiveSection((prev) => (prev === card.section ? null : card.section))
                  }
                  className={[
                    "rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-left transition",
                    selected
                      ? "ring-2 ring-cyan-400/70 shadow-lg shadow-cyan-900/20"
                      : "hover:brightness-110",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {card.label}
                    </span>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                      Qty {card.qty.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                    {formatPkr(card.amount)}
                  </div>
                  {card.meta ? (
                    <p className="mt-2 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {card.meta}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                    {selected ? "Hide deposits ▲" : "View deposits →"}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
            No bank accounts on this branch yet. Add them under{" "}
            <Link
              to="/pops/accounting/bank"
              className="text-cyan-600 hover:underline dark:text-cyan-400"
            >
              Accounting → Bank
            </Link>
            , then deposits in this range will show here.
          </div>
        )}
      </div>

      {activeSection && activeCard ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                {activeCard.label}
              </h4>
              <p className="text-xs text-slate-500">
                {activeCard.qty.toLocaleString()} item(s) · {formatPkr(activeCard.amount)}
                {activeCard.meta ? ` · ${activeCard.meta}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={activeSection.startsWith("bank:") ? "/pops/accounting/bank" : "/pops/orders"}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open {activeSection.startsWith("bank:") ? "Bank accounts" : "Orders"}
              </Link>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setActiveSection(null)}
              >
                Close
              </button>
            </div>
          </div>

          {detailLoading ? (
            <p className="py-6 text-sm text-slate-500">Loading details…</p>
          ) : detailRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
              No matching bills or deposits in this range.
            </p>
          ) : (
            <SimpleTable
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "label",
                  header: activeSection.startsWith("bank:") ? "Deposit / txn" : "Bill",
                  render: (r) =>
                    r.href ? (
                      <Link to={r.href} className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    ),
                },
                {
                  key: "qty",
                  header: "Qty",
                  render: (r) => (r.qty != null ? r.qty.toLocaleString() : "1"),
                },
                {
                  key: "amount",
                  header: "Amount",
                  render: (r) => formatPkr(r.amount),
                },
                {
                  key: "meta",
                  header: "Details",
                  render: (r) => r.meta ?? "—",
                },
              ]}
              rows={detailRows}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
