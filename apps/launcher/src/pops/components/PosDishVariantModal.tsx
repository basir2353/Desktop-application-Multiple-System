import { useEffect, useState } from "react";
import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { menuItemDisplayPrice } from "@platform/contracts";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";
import { POS_SHORTCUTS } from "../lib/posShortcuts";

type Props = {
  item: MenuItem;
  variants: MenuItemVariant[];
  onSelect: (variant: MenuItemVariant) => void;
  onClose: () => void;
};

export function PosDishVariantModal({ item, variants, onSelect, onClose }: Props): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [item.id, variants.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (variants.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i + 1) % variants.length);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i - 1 + variants.length) % variants.length);
        return;
      }

      // Enter or Print (F8) applies the highlighted option
      if (e.key === "Enter" || e.key === POS_SHORTCUTS.printBill.key) {
        e.preventDefault();
        e.stopPropagation();
        const variant = variants[selectedIndex] ?? variants[0];
        if (variant) onSelect(variant);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, onSelect, selectedIndex, variants]);

  const img = resolveMenuImageUrl(item.imageUrl);
  const fromPrice = menuItemDisplayPrice(item);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-variant-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-start gap-3">
            {img ? (
              <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400 dark:bg-slate-950 dark:text-slate-600">
                —
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="pos-variant-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {item.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose a size / sub-category · ↑↓ then Enter / {POS_SHORTCUTS.printBill.key}
              </p>
              {variants.length > 1 ? (
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-600">
                  From Rs {fromPrice.toLocaleString()}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3" role="listbox">
          {variants.map((variant, index) => {
            const selected = index === selectedIndex;
            return (
              <li key={variant.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => onSelect(variant)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-amber-500/60 bg-amber-500/15 ring-1 ring-amber-500/40"
                      : "border-slate-200 bg-slate-50 hover:border-amber-500/40 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:bg-slate-900"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      selected ? "text-amber-900 dark:text-amber-100" : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {variant.label}
                  </span>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-200/90">
                    Rs {variant.price.toLocaleString()}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
