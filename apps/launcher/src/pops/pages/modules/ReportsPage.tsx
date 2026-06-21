import { Button } from "@platform/ui";
import { PageHeader } from "../../ui/PageHeader";

const reportTypes = [
  "Daily sales",
  "Inventory valuation",
  "Tax (PRA/FBR)",
  "Cashier X-report",
  "Payroll summary",
  "Rider settlements",
  "Peak hours",
  "Top sellers",
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
              <li key={r}>
                <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-800">
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 lg:col-span-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="text-slate-400">
              From
              <input type="date" className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white" />
            </label>
            <label className="text-slate-400">
              To
              <input type="date" className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white" />
            </label>
            <label className="text-slate-400">
              Branch
              <select className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white">
                <option>Current</option>
                <option>All branches</option>
              </select>
            </label>
          </div>
          <div className="mt-6 h-48 rounded border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-500">
            Chart / pivot preview area — wire to reporting engine.
          </div>
          <div className="mt-4 overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Hour</th>
                  <th className="px-3 py-2">Orders</th>
                  <th className="px-3 py-2">Net sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {["12–13", "13–14", "14–15"].map((h, i) => (
                  <tr key={h}>
                    <td className="px-3 py-2">{h}</td>
                    <td className="px-3 py-2">{18 + i * 4}</td>
                    <td className="px-3 py-2">Rs {(42000 + i * 8000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
