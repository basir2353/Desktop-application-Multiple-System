const STEPS = [
  "Supplier",
  "Purchase Order",
  "Goods Receiving",
  "Inventory Stock",
  "Kitchen Consumption",
  "Recipe Deduction",
  "Sales (POS)",
  "Inventory Update",
] as const;

type Props = {
  /** Highlight the current step in the flow (defaults to Purchase Order on PO page). */
  activeStep?: (typeof STEPS)[number];
};

export function InventoryFlowBanner({ activeStep = "Purchase Order" }: Props): JSX.Element {
  const activeIndex = STEPS.indexOf(activeStep);

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900/30">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Restaurant inventory flow
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <span key={step} className="flex items-center gap-1.5">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : isPast
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                ].join(" ")}
              >
                {step}
              </span>
              {i < STEPS.length - 1 ? (
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  →
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
