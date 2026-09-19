import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { instructionsRows, isoDateStamp, writeWorkbookDownload } from "../../../lib/excelTransfer";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchVendorBills } from "../../api/accounting";
import { fetchInventoryCookingUnits } from "../../api/inventory";
import { fetchRestaurantReport, RESTAURANT_REPORTS } from "../../api/reports";
import { TimeAmPmInput } from "../../components/TimeAmPmInput";
import { formatPkr } from "../../hooks/useInventory";
import { fieldInputClass } from "../../lib/themeClasses";
import { printHtmlDocumentDetailed } from "../../lib/printTicket";
import {
  resolveReportPrintTarget,
  restaurantReportKey,
} from "../../lib/printerRouting";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { ModuleFilterBar } from "../../ui/ModuleToolbar";
import { CashReportPanel } from "./CashReportPanel";
import { InOutReportPanel } from "./InOutReportPanel";
import { UniversalLedgerPanel } from "./UniversalLedgerPanel";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

const COOKING_UNIT_FILTER_REPORTS = new Set(["cooking-unit-sales", "cooking-unit-profit"]);

export function ReportsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const params = useParams<{ reportId?: string }>();
  const [searchParams] = useSearchParams();
  const activeId = params.reportId ?? RESTAURANT_REPORTS[0]?.id ?? "sales-by-item";
  const [from, setFrom] = useState(() =>
    isIsoDate(searchParams.get("from")) ? searchParams.get("from")! : monthStartIso(),
  );
  const [to, setTo] = useState(() =>
    isIsoDate(searchParams.get("to"))
      ? searchParams.get("to")!
      : isIsoDate(searchParams.get("from"))
        ? searchParams.get("from")!
        : todayIso(),
  );
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [cookingUnitId, setCookingUnitId] = useState(() => searchParams.get("cookingUnitId") ?? "");
  const [vendorDrill, setVendorDrill] = useState<{ supplierId: string; name: string } | null>(null);

  useEffect(() => {
    setVendorDrill(null);
  }, [activeId, from, to, fromTime, toTime, branch?.code]);

  useEffect(() => {
    if (!COOKING_UNIT_FILTER_REPORTS.has(activeId)) setCookingUnitId("");
  }, [activeId]);

  useEffect(() => {
    const nextFrom = searchParams.get("from");
    const nextTo = searchParams.get("to");
    const nextUnit = searchParams.get("cookingUnitId");
    if (isIsoDate(nextFrom)) setFrom(nextFrom);
    if (isIsoDate(nextTo)) setTo(nextTo);
    else if (isIsoDate(nextFrom)) setTo(nextFrom);
    if (nextUnit && COOKING_UNIT_FILTER_REPORTS.has(activeId)) setCookingUnitId(nextUnit);
  }, [searchParams, activeId]);

  const categories = useMemo(
    () => ["All", ...new Set(RESTAURANT_REPORTS.map((r) => r.category))],
    [],
  );

  const visibleReports = useMemo(
    () =>
      categoryFilter === "All"
        ? RESTAURANT_REPORTS
        : RESTAURANT_REPORTS.filter((r) => r.category === categoryFilter),
    [categoryFilter],
  );

  const activeMeta = RESTAURANT_REPORTS.find((r) => r.id === activeId) ?? RESTAURANT_REPORTS[0];
  const showCookingUnitFilter = COOKING_UNIT_FILTER_REPORTS.has(activeId);

  const cookingUnitsQuery = useQuery({
    queryKey: ["inventory", "cooking-units", branch?.code],
    enabled: Boolean(branch?.code && showCookingUnitFilter),
    queryFn: () => fetchInventoryCookingUnits(branch!.code),
  });

  const cookingUnits = cookingUnitsQuery.data?.units.filter((u) => u.isActive) ?? [];
  const selectedUnitName =
    cookingUnits.find((u) => u.id === cookingUnitId)?.name ?? null;

  const reportQuery = useQuery({
    queryKey: [
      "reports",
      branch?.code,
      activeId,
      from,
      to,
      fromTime,
      toTime,
      showCookingUnitFilter ? cookingUnitId : "",
    ],
    enabled: Boolean(branch?.code && activeId && activeId !== "universal-ledger"),
    queryFn: () =>
      fetchRestaurantReport(branch!.code, activeId, {
        from,
        to,
        fromTime,
        toTime,
        ...(showCookingUnitFilter && cookingUnitId ? { cookingUnitId } : {}),
      }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  function exportActive(): void {
    const data = reportQuery.data;
    if (!data) return;
    writeWorkbookDownload(
      [
        {
          name: "Instructions",
          rows: instructionsRows([
            `${data.title} exported from POPS restaurant reports.`,
            `Range: ${data.from ?? ""} ${fromTime} → ${data.to ?? ""} ${toTime}`,
          ]),
        },
        {
          name: "Report",
          rows: data.rows.map((r) => ({
            Label: r.label,
            Qty: r.qty ?? "",
            Amount: r.amount ?? "",
            Bills: r.billCount ?? "",
            Received: r.receivedQty ?? "",
            Usage: r.usageQty ?? "",
            Sales: r.salesQty ?? "",
            Revenue: r.revenue ?? "",
            PurchaseCost: r.purchaseCost ?? "",
            COGS: r.cogs ?? "",
            Profit: r.profit ?? "",
            Stock: r.stockQty ?? "",
            Products: r.products ?? "",
            Debit: r.debit ?? "",
            Credit: r.credit ?? "",
            Balance: r.balance ?? "",
            Meta: r.meta ?? "",
          })),
        },
      ],
      `${data.reportId}-${isoDateStamp()}.xlsx`,
    );
  }

  function exportIndex(): void {
    writeWorkbookDownload(
      [
        {
          name: "Reports",
          rows: RESTAURANT_REPORTS.map((r) => ({
            Report: r.name,
            Category: r.category,
            Path: `/pops/reports/${r.id}`,
          })),
        },
      ],
      `restaurant-reports-index-${isoDateStamp()}.xlsx`,
    );
  }

  const rows = reportQuery.data?.rows ?? [];
  const isCashReport = activeId === "cash-report";
  const isInOutReport = activeId === "in-out";
  const isUniversalLedger = activeId === "universal-ledger";
  const isCookingUnitReport = activeId === "cooking-unit-profit";
  const isCookingUnitSales = activeId === "cooking-unit-sales";
  const isVendorsBalance = activeId === "vendors-balance";

  const vendorBillsQuery = useQuery({
    queryKey: ["accounting", "vendors", "ledger-drill", branch?.code, vendorDrill?.supplierId],
    enabled: Boolean(isVendorsBalance && vendorDrill?.supplierId && branch?.code),
    queryFn: () => fetchVendorBills(branch!.code),
  });

  const vendorDetailBills = useMemo(() => {
    if (!vendorDrill?.supplierId) return [];
    return (vendorBillsQuery.data ?? [])
      .filter((b) => b.supplierId === vendorDrill.supplierId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [vendorBillsQuery.data, vendorDrill?.supplierId]);

  const vendorDetailBalance = vendorDetailBills.reduce((sum, b) => sum + b.balance, 0);
  const vendorDetailBilled = vendorDetailBills.reduce((sum, b) => sum + b.amount, 0);
  const vendorDetailPaid = vendorDetailBills.reduce((sum, b) => sum + b.paid, 0);

  const moneyTotalKeys = new Set([
    "amount",
    "value",
    "discount",
    "variance",
    "counted",
    "outstanding",
    "payments",
    "delivery",
    "serviceCharges",
    "deliveryCharges",
    "tax16",
    "tax8",
    "taxOther",
    "canceledOrders",
    "cashReceived",
    "remainingCash",
    "cardReceived",
    "walletReceived",
    "bankReceived",
    "salary",
    "advances",
    "remaining",
    "sales",
    "debit",
    "credit",
    "balance",
    "moneyIn",
    "moneyOut",
    "net",
    "saleTotal",
    "purchaseTotal",
    "receivable",
    "payable",
  ]);

  async function exportActivePdf(preferPdf = false): Promise<void> {
    const data = reportQuery.data;
    if (!data || rows.length === 0) return;
    const escape = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const head =
      "<th>Label</th><th>Qty</th><th>Amount</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Meta</th>";
    const body = rows
      .map(
        (r) =>
          `<tr><td>${escape(r.label)}</td><td>${escape(r.qty ?? "")}</td><td>${escape(r.amount ?? "")}</td><td>${escape(r.debit ?? "")}</td><td>${escape(r.credit ?? "")}</td><td>${escape(r.balance ?? "")}</td><td>${escape(r.meta ?? "")}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escape(data.title)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body{font-family:Segoe UI,Arial,sans-serif;padding:16px;color:#111;background:#fff}
        h1{font-size:18px;margin:0 0 8px}
        p{font-size:12px;color:#555;margin:0 0 12px}
        table{border-collapse:collapse;width:100%;font-size:11px}
        th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
        th{background:#f3f4f6}
      </style></head><body>
      <h1>${escape(data.title)}</h1>
      <p>${escape(branch?.name ?? "")} · ${escape(from)} ${escape(fromTime)} → ${escape(to)} ${escape(toTime)}</p>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </body></html>`;
    const target = preferPdf
      ? { mode: "pdf" as const, systemPrinterName: "Microsoft Print to PDF" }
      : resolveReportPrintTarget(branch?.code, restaurantReportKey(activeId));
    const systemPrinterName =
      preferPdf || target.mode === "pdf"
        ? "Microsoft Print to PDF"
        : target.mode === "printer"
          ? target.systemPrinterName
          : undefined;
    await printHtmlDocumentDetailed(html, {
      jobTitle: data.title,
      systemPrinterName,
      copies: target.mode === "printer" ? (target.profile?.copies ?? 1) : 1,
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & analytics"
        subtitle="Sales, cash, kitchen, vendors, and inventory — filter by date/time and export."
        actions={
          <>
            <Button variant="ghost" className="text-xs" onClick={exportIndex}>
              Export index
            </Button>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={!reportQuery.data || rows.length === 0}
              onClick={() => void exportActivePdf(false)}
            >
              Print
            </Button>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={!reportQuery.data || rows.length === 0}
              onClick={() => void exportActivePdf(true)}
            >
              PDF
            </Button>
            <Button
              className="text-xs"
              disabled={!reportQuery.data || rows.length === 0}
              onClick={exportActive}
            >
              Export Excel
            </Button>
          </>
        }
      />

      <ModuleFilterBar>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From</span>
          <input className={fieldInputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <div className="flex min-w-[8rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From time</span>
          <TimeAmPmInput
            value={fromTime}
            onChange={setFromTime}
            aria-label="From time"
          />
        </div>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To</span>
          <input className={fieldInputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex min-w-[8rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To time</span>
          <TimeAmPmInput
            value={toTime}
            onChange={setToTime}
            aria-label="To time"
          />
        </div>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Category</span>
          <select
            className={fieldInputClass}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {showCookingUnitFilter ? (
          <label className="flex min-w-[12rem] flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Cooking unit
            </span>
            <select
              className={fieldInputClass}
              value={cookingUnitId}
              onChange={(e) => setCookingUnitId(e.target.value)}
            >
              <option value="">All units</option>
              {cookingUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </ModuleFilterBar>

      {showCookingUnitFilter ? (
        <p className="text-xs text-slate-500">
          Date/time range select karein
          {selectedUnitName ? (
            <>
              {" "}
              · Cooking unit: <span className="font-medium text-amber-600 dark:text-amber-300">{selectedUnitName}</span>
            </>
          ) : (
            " · All cooking units"
          )}
          {isCookingUnitSales
            ? " — no-recipe food cost ke liye sale (step 3). Transfer + stock in hand Inventory reports mein hain."
            : " — stock, usage aur profit dikhega."}
          {isCookingUnitSales ? (
            <>
              {" "}
              <Link
                to="/pops/inventory/reports"
                className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Food cost kit →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40 lg:col-span-1">
          <div className="text-xs font-semibold uppercase text-slate-500">Report</div>
          <ul className="mt-2 max-h-[28rem] space-y-0.5 overflow-y-auto">
            {visibleReports.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/pops/reports/${r.id}`}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm transition ${
                    r.id === activeId
                      ? "bg-emerald-600/20 font-medium text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
            <Link
              to="/pops/reports/kitchen-cancellations"
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Kitchen cancellations (detail) →
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {reportQuery.data?.title ?? activeMeta?.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {branch ? `${branch.name} (${branch.code})` : "No branch"}
                {activeMeta?.category ? ` · ${activeMeta.category}` : null}
                {selectedUnitName && showCookingUnitFilter ? ` · Unit ${selectedUnitName}` : null}
                {isUniversalLedger
                  ? ` · ${from} → ${to}`
                  : reportQuery.data?.from && reportQuery.data?.to
                    ? ` · ${reportQuery.data.from} ${fromTime} → ${reportQuery.data.to} ${toTime}`
                    : null}
              </p>
            </div>
            {reportQuery.data?.totals && !isCashReport && !isInOutReport ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(reportQuery.data.totals).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-700"
                  >
                    <span className="uppercase text-slate-500">{k}</span>{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {moneyTotalKeys.has(k) || k.includes("amount") || k.includes("value")
                        ? formatPkr(v)
                        : v.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {isUniversalLedger && branch?.code ? (
            <div className="mt-4">
              <UniversalLedgerPanel branchCode={branch.code} from={from} to={to} />
            </div>
          ) : reportQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Generating report…</p>
          ) : reportQuery.isError ? (
            <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {(reportQuery.error as Error).message}
            </p>
          ) : isCashReport && reportQuery.data && branch?.code ? (
            <div className="mt-4">
              <CashReportPanel
                report={reportQuery.data}
                branchCode={branch.code}
                from={from}
                to={to}
                fromTime={fromTime}
                toTime={toTime}
              />
            </div>
          ) : isInOutReport && reportQuery.data ? (
            <div className="mt-4">
              <InOutReportPanel report={reportQuery.data} />
            </div>
          ) : rows.length === 0 || reportQuery.data?.empty ? (
            <div className="mt-6 space-y-2 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
              <p>
                No rows for <span className="font-medium text-slate-700 dark:text-slate-300">this branch</span>
                {branch ? ` (${branch.name} · ${branch.code})` : ""} in the selected date/time range.
                Live API data was loaded — empty means nothing was recorded here yet.
              </p>
              {activeId === "customer-ledger" ? (
                <p className="text-xs text-slate-400">
                  Customer ledger uses credit invoices from{" "}
                  <Link to="/pops/accounting/receivable" className="text-emerald-600 hover:underline dark:text-emerald-400">
                    Accounting → Receivable
                  </Link>
                  . Add a customer invoice there, then reopen this report.
                </p>
              ) : null}
              {activeId === "employee-ledger" ? (
                <p className="text-xs text-slate-400">
                  Employees ledger needs staff on this branch — add them under{" "}
                  <Link to="/pops/hr/employees" className="text-emerald-600 hover:underline dark:text-emerald-400">
                    HR → Employees
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : isCookingUnitSales ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200/80">
                    {selectedUnitName
                      ? `${selectedUnitName} — sale in selected dates`
                      : "Total sale (all cooking units)"}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {selectedUnitName
                      ? `${selectedUnitName} ne is date range mein ye sale ki hai.`
                      : "Har cooking unit ki date-wise sale — neeche grand total."}
                  </p>
                </div>
                <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
                  {formatPkr(Number(reportQuery.data?.totals?.revenue ?? 0))}
                </div>
              </div>
              <SimpleTable
                rowKey={(r) => `${String(r.label)}-${String(r.cookingUnitId ?? "unassigned")}`}
                columns={[
                  { key: "label", header: "Cooking unit" },
                  {
                    key: "billCount",
                    header: "Bills",
                    render: (r) => Number(r.billCount ?? 0).toLocaleString(),
                  },
                  {
                    key: "salesQty",
                    header: "Items sold",
                    render: (r) => Number(r.salesQty ?? r.qty ?? 0).toLocaleString(),
                  },
                  {
                    key: "revenue",
                    header: "Sale (Rs)",
                    render: (r) => formatPkr(Number(r.revenue ?? r.amount ?? 0)),
                  },
                  {
                    key: "products",
                    header: "Top items",
                    render: (r) => String(r.products ?? r.meta ?? "—"),
                  },
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
              />
            </div>
          ) : isCookingUnitReport ? (
            <div className="mt-4 overflow-x-auto">
              <SimpleTable
                rowKey={(r) => `${String(r.label)}-${String(r.cookingUnitId ?? "unassigned")}`}
                columns={[
                  { key: "label", header: "Cooking Unit" },
                  { key: "receivedQty", header: "Received", render: (r) => Number(r.receivedQty ?? 0).toLocaleString() },
                  { key: "usageQty", header: "Usage", render: (r) => Number(r.usageQty ?? 0).toLocaleString() },
                  { key: "salesQty", header: "Sales qty", render: (r) => Number(r.salesQty ?? 0).toLocaleString() },
                  { key: "revenue", header: "Revenue", render: (r) => formatPkr(Number(r.revenue ?? 0)) },
                  { key: "cogs", header: "COGS", render: (r) => formatPkr(Number(r.cogs ?? 0)) },
                  { key: "profit", header: "Profit", render: (r) => formatPkr(Number(r.profit ?? 0)) },
                  { key: "stockQty", header: "Current stock", render: (r) => Number(r.stockQty ?? 0).toLocaleString() },
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
              />
            </div>
          ) : isVendorsBalance && vendorDrill ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <button
                    type="button"
                    className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    onClick={() => setVendorDrill(null)}
                  >
                    ← All vendors
                  </button>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {vendorDrill.name} — purchase bills
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Har purchase / GRN bill alag · neeche total payable balance
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-md border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-700">
                    <span className="uppercase text-slate-500">Billed</span>{" "}
                    <span className="font-semibold">{formatPkr(vendorDetailBilled)}</span>
                  </div>
                  <div className="rounded-md border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-700">
                    <span className="uppercase text-slate-500">Paid</span>{" "}
                    <span className="font-semibold">{formatPkr(vendorDetailPaid)}</span>
                  </div>
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px]">
                    <span className="uppercase text-amber-700/80 dark:text-amber-200/80">Payable</span>{" "}
                    <span className="font-semibold text-amber-800 dark:text-amber-200">
                      {formatPkr(vendorDetailBalance)}
                    </span>
                  </div>
                </div>
              </div>
              {vendorBillsQuery.isLoading ? (
                <p className="text-sm text-slate-500">Loading bills…</p>
              ) : vendorDetailBills.length === 0 ? (
                <p className="text-sm text-slate-500">No purchase bills for this vendor.</p>
              ) : (
                <>
                  <SimpleTable
                    rowKey={(r) => r.id}
                    columns={[
                      { key: "billRef", header: "Bill #" },
                      {
                        key: "createdAt",
                        header: "Date",
                        render: (r) => String(r.createdAt).slice(0, 10),
                      },
                      {
                        key: "invoiceNumber",
                        header: "Invoice",
                        render: (r) => r.invoiceNumber ?? "—",
                      },
                      { key: "amount", header: "Amount", render: (r) => formatPkr(r.amount) },
                      { key: "paid", header: "Paid", render: (r) => formatPkr(r.paid) },
                      { key: "balance", header: "Balance", render: (r) => formatPkr(r.balance) },
                      { key: "status", header: "Status" },
                    ]}
                    rows={vendorDetailBills}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200/80">
                        {vendorDrill.name} — total payable
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {vendorDetailBills.length} purchase bill
                        {vendorDetailBills.length === 1 ? "" : "s"} · is vendor ka remaining balance
                      </p>
                    </div>
                    <div className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">
                      {formatPkr(vendorDetailBalance)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-4">
              {isVendorsBalance ? (
                <p className="mb-2 text-[11px] text-slate-500">
                  Vendor pe click karein — us vendor ki saari purchase bills aur total payable balance dikhega.
                </p>
              ) : null}
              <SimpleTable
                rowKey={(r) =>
                  `${String(r.supplierId ?? r.label)}-${String(r.meta ?? "")}-${String(r.amount ?? "")}-${String(r.qty ?? "")}`
                }
                onRowClick={
                  isVendorsBalance
                    ? (r) => {
                        const supplierId = typeof r.supplierId === "string" ? r.supplierId : "";
                        const name = String(r.label ?? "Vendor");
                        if (!supplierId) return;
                        setVendorDrill({ supplierId, name });
                      }
                    : undefined
                }
                columns={[
                  {
                    key: "label",
                    header: "Item",
                    render: (r) =>
                      isVendorsBalance ? (
                        <span className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300">
                          {String(r.label)}
                        </span>
                      ) : (
                        String(r.label)
                      ),
                  },
                  {
                    key: "qty",
                    header: isVendorsBalance ? "Bills" : "Qty",
                    render: (r) => (r.qty != null ? Number(r.qty).toLocaleString() : "—"),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (r) => (r.amount != null ? formatPkr(Number(r.amount)) : "—"),
                  },
                  {
                    key: "debit",
                    header: "Debit",
                    render: (r) => (r.debit != null ? formatPkr(Number(r.debit)) : "—"),
                  },
                  {
                    key: "credit",
                    header: "Credit",
                    render: (r) => (r.credit != null ? formatPkr(Number(r.credit)) : "—"),
                  },
                  {
                    key: "balance",
                    header: "Balance",
                    render: (r) => (r.balance != null ? formatPkr(Number(r.balance)) : "—"),
                  },
                  {
                    key: "meta",
                    header: "Details",
                    render: (r) => (r.meta ? String(r.meta) : "—"),
                  },
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
