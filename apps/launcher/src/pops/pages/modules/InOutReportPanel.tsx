import type { RestaurantReport } from "@platform/contracts";
import { formatPkr } from "../../hooks/useInventory";
import { SimpleTable } from "../../ui/SimpleTable";

type Props = {
  report: RestaurantReport;
};

const OUT_SECTIONS = new Set([
  "expenses",
  "salaries",
  "advances",
  "supplierPayments",
  "purchasing",
]);

export function InOutReportPanel({ report }: Props): JSX.Element {
  const totals = report.totals ?? {};
  const cashIn = Number(totals.cashIn ?? totals.sale ?? 0);
  const cashOut = Number(totals.cashOut ?? 0);
  const net = Number(totals.net ?? cashIn - cashOut);

  const inRows = report.rows.filter((r) => r.section === "cashIn");
  const outRows = report.rows.filter((r) => r.section && OUT_SECTIONS.has(r.section));
  const summaryRows = report.rows.filter(
    (r) => r.section === "cashOut" || r.section === "net",
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Cash In
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {formatPkr(cashIn)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Total sale in range</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Cash Out
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {formatPkr(cashOut)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Expense + salary + advance + supplier + purchase
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            net >= 0
              ? "border-teal-500/30 bg-teal-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <div
            className={`text-[10px] font-semibold uppercase tracking-wider ${
              net >= 0
                ? "text-teal-700 dark:text-teal-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            Net Cash
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {formatPkr(net)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Cash In − Cash Out</p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Cash In
        </h3>
        <SimpleTable
          rowKey={(r) => String(r.section ?? r.label)}
          columns={[
            { key: "label", header: "Particular" },
            {
              key: "qty",
              header: "Count",
              render: (r) => (r.qty != null ? Number(r.qty).toLocaleString() : "—"),
            },
            {
              key: "amount",
              header: "Amount",
              render: (r) => formatPkr(Number(r.amount ?? 0)),
            },
            {
              key: "meta",
              header: "Note",
              render: (r) => (r.meta ? String(r.meta) : "—"),
            },
          ]}
          rows={inRows as unknown as Record<string, unknown>[]}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Cash Out
        </h3>
        <SimpleTable
          rowKey={(r) => String(r.section ?? r.label)}
          columns={[
            { key: "label", header: "Particular" },
            {
              key: "qty",
              header: "Count",
              render: (r) => (r.qty != null ? Number(r.qty).toLocaleString() : "—"),
            },
            {
              key: "amount",
              header: "Amount",
              render: (r) => formatPkr(Number(r.amount ?? 0)),
            },
            {
              key: "meta",
              header: "Note",
              render: (r) => (r.meta ? String(r.meta) : "—"),
            },
          ]}
          rows={outRows as unknown as Record<string, unknown>[]}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Summary
        </h3>
        <SimpleTable
          rowKey={(r) => String(r.section ?? r.label)}
          columns={[
            { key: "label", header: "Particular" },
            {
              key: "amount",
              header: "Amount",
              render: (r) => formatPkr(Number(r.amount ?? r.balance ?? 0)),
            },
            {
              key: "meta",
              header: "Note",
              render: (r) => (r.meta ? String(r.meta) : "—"),
            },
          ]}
          rows={summaryRows as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
