import type { SalarySlip } from "@platform/contracts";
import { formatPkr } from "../hooks/useHr";
import { printHtmlDocumentAndWait } from "./printTicket";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSalarySlipHtml(slip: SalarySlip, branchName?: string): string {
  const title = branchName?.trim() || "Salary slip";
  const statusLabel =
    slip.payrollStatus === "paid"
      ? "Paid"
      : slip.payrollStatus === "approved"
        ? "Approved"
        : "Draft preview";
  const paidLine =
    slip.paidAt && slip.payrollStatus === "paid"
      ? `<div class="row"><span class="label">Paid on</span><span class="value">${escapeHtml(
          new Date(slip.paidAt).toLocaleString("en-PK", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        )}</span></div>`
      : "";
  const netClass = slip.netPkr < 0 ? ' style="color:#b91c1c"' : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Salary slip ${escapeHtml(slip.payrollRef)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 13px;
      color: #222;
      max-width: 480px;
    }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #555; margin: 0 0 12px; }
    .line { border-top: 1px solid #ddd; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .total td { font-weight: 700; font-size: 16px; border-bottom: none; padding-top: 12px; }
    .row { display: flex; justify-content: space-between; gap: 12px; margin: 4px 0; }
    .label { color: #666; }
    .value { font-weight: 600; text-align: right; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 11px;
      font-weight: 600;
    }
    .footer { margin-top: 16px; font-size: 11px; color: #777; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">Salary slip · <span class="badge">${escapeHtml(statusLabel)}</span></p>
  <p><strong>${escapeHtml(slip.employeeName)}</strong> (${escapeHtml(slip.employeeCode)})<br>
  ${escapeHtml(slip.jobTitle)}</p>
  <p>Period: ${escapeHtml(slip.periodStart)} — ${escapeHtml(slip.periodEnd)}<br>
  Ref: ${escapeHtml(slip.payrollRef)}</p>
  <div class="line"></div>
  <table>
    <tr><td>Gross pay</td><td>${escapeHtml(formatPkr(slip.grossPkr))}</td></tr>
    <tr><td>Deductions (EOBI/tax)</td><td>− ${escapeHtml(formatPkr(slip.deductionsPkr))}</td></tr>
    <tr><td>Overtime</td><td>${escapeHtml(formatPkr(slip.overtimePkr))}</td></tr>
    <tr class="total"><td>Baqaya / Net</td><td${netClass}>${escapeHtml(formatPkr(slip.netPkr))}</td></tr>
  </table>
  ${paidLine}
  <div class="footer">Generated ${escapeHtml(
    new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }),
  )}</div>
</body>
</html>`;
}

export async function printSalarySlip(
  slip: SalarySlip,
  branchName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const html = buildSalarySlipHtml(slip, branchName);
  const opened = await printHtmlDocumentAndWait(html, `Salary slip ${slip.payrollRef}`);
  if (!opened) {
    return { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
  }
  return { ok: true };
}
