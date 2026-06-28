import { useEffect, useState } from "react";
import { computeWeighedLinePrice, formatPricePerKg, parseScaleWeightKg } from "@platform/contracts";
import type { StoreProduct } from "@platform/contracts";
import { formatPkr } from "../hooks/useStore";
import { publishScaleWeight, subscribeScaleWeight } from "../lib/storePosSync";

type Props = {
  product: StoreProduct;
  initialKg?: number;
  onClose: () => void;
  onConfirm: (qtyKg: number) => void;
};

export function StoreWeightModal({ product, initialKg, onClose, onConfirm }: Props): JSX.Element {
  const [weightInput, setWeightInput] = useState(initialKg ? String(initialKg) : "");
  const [scaleKg, setScaleKg] = useState<number | null>(initialKg ?? null);

  useEffect(() => {
    return subscribeScaleWeight((kg) => {
      setScaleKg(kg);
      setWeightInput(String(kg));
    });
  }, []);

  const kg = parseScaleWeightKg(weightInput) ?? scaleKg ?? 0;
  const grams = Math.round(kg * 1000);
  const lineTotal = computeWeighedLinePrice(product.sellingPrice, grams);
  const maxKg = product.availableStock / 1000;

  function applyScale(): void {
    if (scaleKg) {
      setWeightInput(String(scaleKg));
    }
  }

  function simulateScale(): void {
    const demo = Math.min(maxKg, Math.round((0.5 + Math.random() * 2.5) * 100) / 100);
    setScaleKg(demo);
    setWeightInput(String(demo));
    publishScaleWeight(demo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose} role="presentation">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Weigh — {product.name}</h2>
        <p className="mt-1 text-xs text-slate-500">{formatPricePerKg(product.sellingPrice)} · {maxKg.toFixed(2)} kg available</p>

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">Scale reading</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
            {scaleKg != null ? `${scaleKg.toFixed(3)} kg` : "—"}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={applyScale} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">Use scale weight</button>
            <button type="button" onClick={simulateScale} className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-sky-700 dark:text-sky-300">Simulate scale</button>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-500">Weight (kg)</span>
          <input
            type="text"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="e.g. 2.5"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-lg font-semibold tabular-nums outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
            autoFocus
          />
        </label>

        <div className="mt-3 flex justify-between text-sm">
          <span className="text-slate-500">Line total</span>
          <span className="font-bold text-slate-900 dark:text-white">{formatPkr(lineTotal)}</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm dark:border-slate-700">Cancel</button>
          <button
            type="button"
            disabled={kg <= 0 || kg > maxKg}
            onClick={() => onConfirm(kg)}
            className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add {kg > 0 ? `${kg.toFixed(3)} kg` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
