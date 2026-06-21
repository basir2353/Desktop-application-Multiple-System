export function InventoryFlowBanner(): JSX.Element {
  const steps = [
    "Supplier",
    "Purchase Order",
    "Goods Receiving",
    "Inventory Stock",
    "Kitchen Consumption",
    "Recipe Deduction",
    "Sales (POS)",
    "Inventory Update",
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Restaurant inventory flow</div>
      <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-slate-400">
        {steps.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span className="rounded-md bg-slate-800/80 px-2 py-1 text-slate-300">{step}</span>
            {i < steps.length - 1 ? <span className="text-slate-600">→</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
