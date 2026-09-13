import type { InventoryReport } from "@platform/contracts";
import { printHtmlDocumentDetailed } from "./printTicket";
import {
  inventoryReportKey,
  resolveReportPrintTarget,
} from "./printerRouting";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-PK");
  return String(value);
}

function money(value: unknown): string {
  if (typeof value !== "number") return cell(value);
  return `Rs ${value.toLocaleString("en-PK")}`;
}

type PrintColumn = { key: string; header: string; render?: (row: Record<string, unknown>) => string };

function columnsForReport(reportId: string): PrintColumn[] {
  switch (reportId) {
    case "cooking-unit-stock":
      return [
        { key: "kitchenSection", header: "Kitchen section" },
        { key: "productCategory", header: "Category" },
        { key: "sku", header: "SKU" },
        { key: "productName", header: "Product" },
        {
          key: "quantity",
          header: "Qty",
          render: (r) => `${cell(r.quantity)} ${cell(r.unit)}`,
        },
        { key: "stockValue", header: "Value (Rs)", render: (r) => money(r.stockValue) },
      ];
    case "stock-transfers":
      return [
        { key: "kitchenSection", header: "Cooking unit" },
        { key: "date", header: "Date" },
        { key: "reference", header: "Voucher" },
        { key: "fromWarehouse", header: "From" },
        { key: "toWarehouse", header: "To" },
        { key: "productName", header: "Product" },
        { key: "qty", header: "Qty", render: (r) => `${cell(r.qty)} ${cell(r.unit)}` },
        { key: "value", header: "Value (Rs)", render: (r) => money(r.value) },
      ];
    case "stock-transfers-by-section":
      return [
        { key: "kitchenSection", header: "Cooking unit" },
        { key: "transferCount", header: "Vouchers" },
        { key: "lineCount", header: "Lines" },
        { key: "qtyIn", header: "Qty in" },
        { key: "qtyOut", header: "Qty out" },
        { key: "totalQty", header: "Net qty" },
        { key: "valueIn", header: "Value in (Rs)", render: (r) => money(r.valueIn) },
        { key: "valueOut", header: "Value out (Rs)", render: (r) => money(r.valueOut) },
        { key: "totalValue", header: "Net value (Rs)", render: (r) => money(r.totalValue) },
        { key: "products", header: "Products" },
      ];
    case "current-stock":
      return [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Ingredient" },
        { key: "stock", header: "On hand" },
        { key: "kitchen", header: "Kitchen" },
        { key: "store", header: "Store" },
        { key: "value", header: "Value (Rs)", render: (r) => money(r.value) },
      ];
    case "expiry":
      return [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Ingredient" },
        { key: "qty", header: "Qty", render: (r) => `${cell(r.qty)} ${cell(r.unit)}` },
        { key: "batch", header: "Batch" },
        { key: "expiry", header: "Expiry" },
        { key: "location", header: "Location" },
      ];
    case "waste":
      return [
        { key: "date", header: "Date" },
        { key: "ingredient", header: "Ingredient" },
        { key: "qty", header: "Qty" },
        { key: "wasteType", header: "Type" },
        { key: "costImpact", header: "Cost", render: (r) => money(r.costImpact) },
        { key: "status", header: "Status" },
      ];
    default:
      return [];
  }
}

function footerTotal(report: InventoryReport, rows: Record<string, unknown>[]): string | null {
  if (report.id === "cooking-unit-stock") {
    const total = rows.reduce((s, r) => s + (Number(r.stockValue) || 0), 0);
    return `Total stock value: ${money(total)}`;
  }
  if (report.id === "stock-transfers") {
    const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    return `Total transfer value: ${money(total)}`;
  }
  if (report.id === "stock-transfers-by-section") {
    const total = rows.reduce((s, r) => s + (Number(r.valueIn ?? r.totalValue) || 0), 0);
    return `Total transfer value (in): ${money(total)}`;
  }
  if (report.id === "current-stock" || report.id === "valuation") {
    const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    return `Total stock value: ${money(total)}`;
  }
  return null;
}

export function buildInventoryReportHtml(options: {
  report: InventoryReport;
  branchName?: string | null;
  cookingUnitLabel?: string | null;
}): string | null {
  const { report, branchName, cookingUnitLabel } = options;
  const rows = (Array.isArray(report.data) ? report.data : []).filter(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r),
  );
  if (rows.length === 0) return null;

  let columns = columnsForReport(report.id);
  if (columns.length === 0) {
    const keys = Object.keys(rows[0] ?? {}).slice(0, 8);
    columns = keys.map((key) => ({
      key,
      header: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    }));
  }

  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((c) => `<td>${escapeHtml(c.render ? c.render(row) : cell(row[c.key]))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const metaParts = [
    branchName,
    report.filterDate ? `Filter ${report.dateMode ?? ""} ${report.filterDate}` : null,
    cookingUnitLabel ? `Cooking unit: ${cookingUnitLabel}` : null,
    `Generated ${report.lastGenerated}`,
  ].filter(Boolean);

  const totalLine = footerTotal(report, rows);

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(report.name)}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body{font-family:Segoe UI,Arial,sans-serif;padding:16px;color:#111;background:#fff}
      h1{font-size:18px;margin:0 0 6px}
      p{font-size:12px;color:#555;margin:0 0 12px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#f3f4f6}
      .total{margin-top:12px;font-size:13px;font-weight:700}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${escapeHtml(report.name)}</h1>
    <p>${escapeHtml(metaParts.join(" · "))}</p>
    <p>${escapeHtml(report.description)}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${totalLine ? `<p class="total">${escapeHtml(totalLine)}</p>` : ""}
    </body></html>`;
}

/**
 * Print / PDF inventory report via Tauri-safe iframe dialog (or routed printer / PDF).
 * Uses Printer → Routing → By report when `branchCode` is provided.
 */
export async function printInventoryReport(options: {
  report: InventoryReport;
  branchCode?: string | null;
  branchName?: string | null;
  cookingUnitLabel?: string | null;
  /** Force OS dialog even if a printer is assigned. */
  forceDialog?: boolean;
  /** Prefer Save as PDF path. */
  preferPdf?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const html = buildInventoryReportHtml(options);
  if (!html) return { ok: false, error: "No report rows to print." };

  const reportKey = inventoryReportKey(options.report.id);
  const target = options.forceDialog
    ? { mode: "dialog" as const, profile: null, systemPrinterName: undefined }
    : options.preferPdf
      ? { mode: "pdf" as const, profile: null, systemPrinterName: "Microsoft Print to PDF" }
      : resolveReportPrintTarget(options.branchCode ?? undefined, reportKey);

  const systemPrinterName =
    target.mode === "pdf"
      ? "Microsoft Print to PDF"
      : target.mode === "printer"
        ? target.systemPrinterName
        : undefined;

  const result = await printHtmlDocumentDetailed(html, {
    jobTitle: options.report.name,
    systemPrinterName,
    copies: target.profile?.copies ?? 1,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Print failed." };
  }
  return { ok: true };
}
