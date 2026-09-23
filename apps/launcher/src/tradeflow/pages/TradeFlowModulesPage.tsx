import { PageHeader } from "../../pops/ui/PageHeader";

export function TradeFlowModulesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="TradeFlow module workspace"
        subtitle="Empty on purpose. Features you send next will be registered here as TradeFlow pages and APIs."
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">How new modules get added</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>Send the screen list, fields, and workflow for TradeFlow.</li>
          <li>They are added under <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/pops/tradeflow/…</code>.</li>
          <li>API routes go under <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/v1/tradeflow</code> and stay isolated from other systems.</li>
        </ol>
      </div>
    </div>
  );
}
