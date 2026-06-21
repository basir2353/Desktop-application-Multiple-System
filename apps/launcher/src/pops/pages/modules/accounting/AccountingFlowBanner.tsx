import { Link } from "react-router-dom";

const FLOW = [
  { label: "POS Sale", path: "/pops/pos" },
  { label: "Inventory", path: "/pops/inventory" },
  { label: "Accounting", path: "/pops/accounting" },
  { label: "Reports", path: "/pops/accounting/reports" },
];

export function AccountingFlowBanner(): JSX.Element {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">
        Integrated flow
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-sm text-slate-300">
        {FLOW.map((step, i) => (
          <span key={step.path} className="flex items-center gap-1">
            {i > 0 ? <span className="text-slate-600">→</span> : null}
            <Link to={step.path} className="rounded px-2 py-0.5 transition hover:bg-emerald-500/10 hover:text-emerald-200">
              {step.label}
            </Link>
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        POS sales, inventory purchases, and payroll automatically post journal entries.
      </p>
    </div>
  );
}
