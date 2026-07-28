import { useEffect, useState } from "react";
import type { CartLine } from "../lib/storePosSync";
import { cartLineUnitPrice } from "../lib/storePosSync";
import { formatPkr } from "../hooks/useStore";

type Props = {
  line: CartLine;
  onClose: () => void;
  onSave: (patch: { displayName: string; displayDescription: string; unitPrice: number }) => void;
};

/** Sale-only item edit — does not update product master in the database. */
export function StoreItemPropertiesModal({ line, onClose, onSave }: Props): JSX.Element {
  const [name, setName] = useState(line.displayName ?? line.product.name);
  const [description, setDescription] = useState(
    line.displayDescription ?? line.product.description ?? "",
  );
  const [unitPrice, setUnitPrice] = useState(cartLineUnitPrice(line));

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Item Properties"
      >
        <div className="flex items-center justify-between bg-sky-600 px-4 py-3 text-white">
          <h3 className="text-base font-semibold">Item Properties</h3>
          <button type="button" onClick={onClose} className="rounded px-2 text-lg leading-none hover:bg-white/15" aria-label="Close">
            ×
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Changes apply to this sale only. Product master name and price are not updated.
          </p>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Item Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Item Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Selling Rate
            <input
              type="number"
              min={0}
              value={unitPrice}
              onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Master: {line.product.name} · {formatPkr(line.product.sellingPrice)}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold text-sky-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                displayName: name.trim() || line.product.name,
                displayDescription: description,
                unitPrice: Math.max(0, Math.round(unitPrice)),
              })
            }
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
