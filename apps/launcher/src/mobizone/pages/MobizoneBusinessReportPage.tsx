import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { useMobizoneBranchCode } from "../hooks/useMobizone";
import { formatPkr, getBusinessReport, printHtmlPage } from "../lib/mobizoneStore";
import { MzField, MzInput, MzPrimaryButton, MzSecondaryButton, MzStat } from "../ui/MobizoneUi";

export function MobizoneBusinessReportPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const report = useMemo(() => {
    if (!branchCode) return null;
    return getBusinessReport(branchCode, from, to);
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
        <div class="card"><div class="label">Profit / loss</div><div class="val">${formatPkr(report.profitPkr)}</div></div>
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
      <div className="flex flex-wrap items-end gap-3">
        <MzField label="From">
          <MzInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </MzField>
        <MzField label="To">
          <MzInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </MzField>
        <MzSecondaryButton
          onClick={() => {
            setFrom(today);
            setTo(today);
          }}
        >
          Today
        </MzSecondaryButton>
        <MzSecondaryButton
          onClick={() => {
            setFrom(monthStart);
            setTo(today);
          }}
        >
          This month
        </MzSecondaryButton>
        <MzPrimaryButton onClick={onPrint} disabled={!report}>
          Print report
        </MzPrimaryButton>
      </div>

      {report ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MzStat label="Phones purchased" value={report.purchaseCount} />
          <MzStat label="Phones sold" value={report.saleCount} />
          <MzStat label="Purchase amount" value={formatPkr(report.purchaseAmountPkr)} />
          <MzStat label="Sale amount" value={formatPkr(report.saleAmountPkr)} />
          <MzStat label="Profit / loss" value={formatPkr(report.profitPkr)} />
          <MzStat label="Receivables (lena baqi)" value={formatPkr(report.receivablesPkr)} />
          <MzStat label="Payables (dena baqi)" value={formatPkr(report.payablesPkr)} />
          <MzStat label="Cash balance" value={formatPkr(report.cashBalancePkr)} />
          <MzStat label="Bank balance" value={formatPkr(report.bankBalancePkr)} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Select a branch to view the report.</p>
      )}
    </div>
  );
}
