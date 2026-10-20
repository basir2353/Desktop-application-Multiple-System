import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  bankLedgerName,
  formatPkr,
  getBankLedgerReport,
  getCashBankBalances,
  getCashLedgerReport,
  monthStartDateInput,
  printMoneyLedgerReport,
  todayDateInput,
  type MoneyLedgerReport,
} from "../lib/mobizoneStore";
import { MzDateRangeFilter, MzPage, MzPrimaryButton, MzSecondaryButton, MzSection } from "../ui/MobizoneUi";

function resolveReport(
  branchCode: string | null,
  kind: string | null,
  accountId: string | null,
  fromDate: string,
  toDate: string,
): MoneyLedgerReport | null {
  if (!branchCode) return null;
  const opts = { fromDate, toDate };
  if (kind === "bank" && accountId) return getBankLedgerReport(branchCode, accountId, opts);
  return getCashLedgerReport(branchCode, opts);
}

export function MobizoneMoneyLedgerPage(): JSX.Element {
  const { branchCode, db } = useMobizoneDb();
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "cash";
  const accountId = params.get("accountId");
  const [fromDate, setFromDate] = useState(() => params.get("from") || monthStartDateInput());
  const [toDate, setToDate] = useState(() => params.get("to") || todayDateInput());

  const report = useMemo(
    () => resolveReport(branchCode, kind, accountId, fromDate, toDate),
    [branchCode, kind, accountId, fromDate, toDate],
  );
  const balances = getCashBankBalances(db);

  function syncDates(nextFrom: string, nextTo: string): void {
    setFromDate(nextFrom);
    setToDate(nextTo);
    const next = new URLSearchParams(params);
    next.set("from", nextFrom);
    next.set("to", nextTo);
    setParams(next, { replace: true });
  }

  return (
    <MzPage>
      <PageHeader
        title={report?.title ?? "Money ledger"}
        subtitle="Separate cash and bank ledgers — in/out with running balance. Filter by from/to date."
      />

      <MzSection title="Date filter">
        <MzDateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={(from, to) =>
            syncDates(from || monthStartDateInput(), to || todayDateInput())
          }
        />
      </MzSection>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/pops/mobizone/money-ledger?kind=cash&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`}
          className={`mz-btn-secondary mz-touch px-3 py-2 text-sm no-underline ${kind !== "bank" ? "ring-2 ring-[var(--mz-accent)]" : ""}`}
        >
          Cash Ledger · {formatPkr(balances.cash)}
        </Link>
        {db.bankAccounts.map((a) => (
          <Link
            key={a.id}
            to={`/pops/mobizone/money-ledger?kind=bank&accountId=${a.id}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`}
            className={`mz-btn-secondary mz-touch px-3 py-2 text-sm no-underline ${
              kind === "bank" && accountId === a.id ? "ring-2 ring-[var(--mz-accent)]" : ""
            }`}
          >
            {bankLedgerName(a)} · {formatPkr(balances.byAccount[a.id] ?? a.openingBalancePkr ?? 0)}
          </Link>
        ))}
        <Link to="/pops/mobizone/banks" className="mz-btn-secondary mz-touch px-3 py-2 text-sm no-underline">
          ← Banks
        </Link>
      </div>

      {report ? (
        <div className={`${cardClass} space-y-3 p-4`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-wide ${mutedClass}`}>{report.title}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {formatPkr(report.balancePkr)}
              </p>
              <p className={`mt-1 text-xs ${mutedClass}`}>
                Period {fromDate || "—"} → {toDate || "—"} · In {formatPkr(report.periodInPkr || 0)} · Out{" "}
                {formatPkr(report.periodOutPkr || 0)}
              </p>
            </div>
            <MzPrimaryButton onClick={() => printMoneyLedgerReport(report)}>Print report</MzPrimaryButton>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Detail</th>
                  <th className="px-3 py-2 text-right">In</th>
                  <th className="px-3 py-2 text-right">Out</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/80">
                    <td className={`px-3 py-2 text-xs ${mutedClass}`}>
                      {r.at ? new Date(r.at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                      {r.inPkr ? formatPkr(r.inPkr) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-300">
                      {r.outPkr ? formatPkr(r.outPkr) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatPkr(r.balanceAfter)}
                    </td>
                  </tr>
                ))}
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-3 py-8 text-center ${mutedClass}`}>
                      No entries in this date range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${mutedClass}`}>Select a branch first.</p>
      )}
    </MzPage>
  );
}
