import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { useMobizoneBranchCode } from "../hooks/useMobizone";
import {
  formatPkr,
  getBusinessReport,
  monthStartDateInput,
  printHtmlPage,
  todayDateInput,
} from "../lib/mobizoneStore";
import { MzDateRangeFilter, MzPrimaryButton, MzSection, MzStat } from "../ui/MobizoneUi";

export function MobizoneBusinessReportPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const [from, setFrom] = useState(monthStartDateInput);
  const [to, setTo] = useState(todayDateInput);

  const report = useMemo(() => {
    if (!branchCode) return null;
    return getBusinessReport(branchCode, from || "1970-01-01", to || todayDateInput());
  }, [branchCode, from, to]);

  function onPrint(): void {
    if (!report) return;
    printHtmlPage(
      "MobiZone Business Report",
      `<h1>MobiZone — Business Report</h1>
      <p class="muted">${report.from} → ${report.to}</p>
      <div class="grid">
        <div class="card"><div class="label">Phones purchased</div><div class="val">${report.purchaseCount}</div></div>
        <div class="card"><div class="label">Phones sold</div><div class="val">${report.saleCount}</div></div>
        <div class="card"><div class="label">Purchase amount</div><div class="val">${formatPkr(report.purchaseAmountPkr)}</div></div>
        <div class="card"><div class="label">Sale amount</div><div class="val">${formatPkr(report.saleAmountPkr)}</div></div>
        <div class="card"><div class="label">Gross profit</div><div class="val">${formatPkr(report.grossProfitPkr)}</div></div>
        <div class="card"><div class="label">Expenses</div><div class="val">${formatPkr(report.expenseTotalPkr)}</div></div>
        <div class="card"><div class="label">Net profit / loss</div><div class="val">${formatPkr(report.profitPkr)}</div></div>
        <div class="card"><div class="label">Stock value</div><div class="val">${formatPkr(report.stockValuePkr)}</div></div>
        <div class="card"><div class="label">Receivables (lena)</div><div class="val">${formatPkr(report.receivablesPkr)}</div></div>
        <div class="card"><div class="label">Payables (dena)</div><div class="val">${formatPkr(report.payablesPkr)}</div></div>
        <div class="card"><div class="label">Cash</div><div class="val">${formatPkr(report.cashBalancePkr)}</div></div>
        <div class="card"><div class="label">Bank total</div><div class="val">${formatPkr(report.bankBalancePkr)}</div></div>
      </div>`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business report"
        subtitle="Any date range — purchases, sales, profit, receivables, payables, cash & bank on one printable page."
      />
      <MzSection title="Date filter">
        <MzDateRangeFilter
          fromDate={from}
          toDate={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <div className="mt-3">
          <MzPrimaryButton onClick={onPrint} disabled={!report}>
            Print report
          </MzPrimaryButton>
        </div>
      </MzSection>

      {report ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MzStat label="Phones purchased" value={report.purchaseCount} />
          <MzStat label="Phones sold" value={report.saleCount} />
          <MzStat label="Purchase amount" value={formatPkr(report.purchaseAmountPkr)} />
          <MzStat label="Sale amount" value={formatPkr(report.saleAmountPkr)} />
          <MzStat label="Gross profit" value={formatPkr(report.grossProfitPkr)} />
          <MzStat label="Expenses (auto-deducted)" value={formatPkr(report.expenseTotalPkr)} />
          <MzStat label="Net profit / loss" value={formatPkr(report.profitPkr)} />
          <MzStat label="Stock value" value={formatPkr(report.stockValuePkr)} />
          <MzStat label="Receivables" value={formatPkr(report.receivablesPkr)} />
          <MzStat label="Payables" value={formatPkr(report.payablesPkr)} />
          <MzStat label="Cash balance" value={formatPkr(report.cashBalancePkr)} />
          <MzStat label="Bank balance" value={formatPkr(report.bankBalancePkr)} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Select a branch to view the report.</p>
      )}
    </div>
  );
}
