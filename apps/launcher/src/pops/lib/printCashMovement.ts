import { printHtmlDocumentAndWait } from "./printTicket";
import {
  DEFAULT_CASH_SLIP_PRINT_SETTINGS,
  loadCashSlipPrintSettings,
  type CashSlipPrintSettings,
} from "./cashSlipPrintSettings";

export type CashMovementPrintInput = {
  branchName: string;
  branchCode?: string;
  sessionRef?: string;
  type: "paid_in" | "paid_out";
  amountPkr: number;
  /** Who received (pay out) or who gave (pay in). */
  partyLabel?: string | null;
  reason: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Parse "Supplier: Ali — rent" → { party: "Supplier · Ali", note: "rent" }. */
export function parseCashMovementReason(reason: string): {
  party: string | null;
  note: string;
} {
  const trimmed = reason.trim();
  const match = trimmed.match(/^(Supplier|Customer|Employee):\s*([^—\n]+?)(?:\s*[—-]\s*(.*))?$/i);
  if (!match) return { party: null, note: trimmed };
  const kind = match[1];
  const name = match[2].trim();
  const note = (match[3] ?? "").trim() || trimmed;
  return { party: `${kind} · ${name}`, note };
}

export function buildCashMovementSlipHtml(
  input: CashMovementPrintInput,
  settingsOverride?: CashSlipPrintSettings,
): string {
  const settings =
    settingsOverride ??
    (input.branchCode
      ? loadCashSlipPrintSettings(input.branchCode)
      : DEFAULT_CASH_SLIP_PRINT_SETTINGS);
  const isOut = input.type === "paid_out";
  const title = isOut ? settings.titlePayOut : settings.titlePayIn;
  const direction = isOut ? settings.directionPayOut : settings.directionPayIn;
  const parsed = parseCashMovementReason(input.reason);
  const party = input.partyLabel?.trim() || parsed.party;
  const note = parsed.note;
  const amount = Math.round(input.amountPkr).toLocaleString("en-PK");
  const stamped = new Date().toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const soft = settings.softBold;
  const titleWeight = soft ? 600 : 700;
  const amountWeight = soft ? 600 : 700;
  const valueWeight = soft ? 500 : 600;
  const customHtml = settings.customLines
    .filter((line) => line.enabled && line.text.trim())
    .map((line) => {
      const weight = line.bold ? (soft ? 600 : 700) : 400;
      return `<div class="extra" style="font-weight:${weight}">${escapeHtml(line.text.trim())}</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      font-weight: 400;
      color: #222;
      width: 72mm;
    }
    .title { text-align: center; font-size: 14px; font-weight: ${titleWeight}; letter-spacing: 0.02em; }
    .sub { text-align: center; font-size: 11px; font-weight: ${soft ? 500 : 600}; color: #555; margin-top: 2px; }
    .line { border-top: 1px dashed #bbb; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
    .label { color: #666; font-weight: 400; }
    .value { font-weight: ${valueWeight}; text-align: right; color: #222; }
    .amount { font-size: 15px; font-weight: ${amountWeight}; }
    .dir { text-align: center; font-size: 11px; font-weight: ${soft ? 500 : 600}; margin: 6px 0; color: #444; }
    .extra { text-align: center; margin: 6px 0 2px; font-size: 11px; color: #333; white-space: pre-wrap; }
    .footer { text-align: center; font-size: 10px; font-weight: 400; color: #777; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="title">${escapeHtml(input.branchName)}</div>
  <div class="sub">${escapeHtml(title)}</div>
  <div class="line"></div>
  <div class="dir">${escapeHtml(direction)}</div>
  ${
    party
      ? `<div class="row"><span class="label">${isOut ? "Paid to" : "Received from"}</span><span class="value">${escapeHtml(party)}</span></div>`
      : ""
  }
  <div class="row"><span class="label">Amount</span><span class="value amount">${escapeHtml(amount)}</span></div>
  <div class="row"><span class="label">Reason</span><span class="value">${escapeHtml(note)}</span></div>
  ${
    settings.showSession && input.sessionRef
      ? `<div class="row"><span class="label">Session</span><span class="value">${escapeHtml(input.sessionRef)}</span></div>`
      : ""
  }
  ${
    settings.showTime
      ? `<div class="row"><span class="label">Time</span><span class="value">${escapeHtml(stamped)}</span></div>`
      : ""
  }
  ${customHtml}
  <div class="line"></div>
  <div class="footer">${escapeHtml(settings.footerText)}</div>
</body>
</html>`;
}

export async function printCashMovementSlip(input: CashMovementPrintInput): Promise<boolean> {
  const html = buildCashMovementSlipHtml(input);
  return printHtmlDocumentAndWait(html, input.type === "paid_out" ? "Pay out" : "Pay in");
}
