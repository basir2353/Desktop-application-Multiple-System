import { Button } from "@platform/ui";
import { Link } from "react-router-dom";
import { PageHeader } from "../../ui/PageHeader";

const reportTypes = [
  { label: "Kitchen cancellations", to: "/pops/reports/kitchen-cancellations" },
  { label: "Daily sales", to: null },
  { label: "Inventory valuation", to: null },
  { label: "Tax (PRA/FBR)", to: null },
  { label: "Cashier X-report", to: null },
  { label: "Payroll summary", to: null },
  { label: "Rider settlements", to: null },
  { label: "Peak hours", to: null },
  { label: "Top sellers", to: null },
];

export function ReportsPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & analytics"
        subtitle="Saved layouts, comparisons, and scheduled exports."
        actions={
          <>
            <Button variant="ghost" className="text-xs">
              Schedule email
            </Button>
            <Button className="text-xs">Export Excel</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 lg:col-span-1">
          <div className="text-xs font-semibold uppercase text-slate-500">Report</div>
          <ul className="mt-2 space-y-1">
            {reportTypes.map((r) => (
              <li key={r.label}>
                {r.to ? (
                  <Link
                    to={r.to}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm text-emerald-300 hover:bg-slate-800"
                  >
                    {r.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-800"
                  >
                    {r.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 lg:col-span-3">
          <div className="text-sm text-slate-300">
            Open <Link className="text-emerald-400 underline" to="/pops/reports/kitchen-cancellations">Kitchen cancellations</Link>{" "}
            for items sent to kitchen and later canceled.
          </div>
          <div className="mt-6 h-48 rounded border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-500">
            Chart / pivot preview area — wire to reporting engine.
          </div>
        </div>
      </div>
    </div>
  );
}
