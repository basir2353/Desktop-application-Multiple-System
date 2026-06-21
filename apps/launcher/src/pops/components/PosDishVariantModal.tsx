import { useEffect } from "react";
import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { menuItemDisplayPrice } from "@platform/contracts";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";

type Props = {
  item: MenuItem;
  variants: MenuItemVariant[];
  onSelect: (variant: MenuItemVariant) => void;
  onClose: () => void;
};

export function PosDishVariantModal({ item, variants, onSelect, onClose }: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-start gap-3">
            {img ? (
              <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs text-slate-600">
                —
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id="pos-variant-title" className="text-base font-semibold text-white">
                {item.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Choose a size / sub-category</p>
              {variants.length > 1 ? (
                <p className="mt-1 text-[10px] text-slate-600">From Rs {fromPrice.toLocaleString()}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {variants.map((variant) => (
            <li key={variant.id}>
              <button
                type="button"
                onClick={() => onSelect(variant)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-left transition hover:border-amber-500/40 hover:bg-slate-900"
              >
                <span className="text-sm font-medium text-slate-100">{variant.label}</span>
                <span className="text-sm font-semibold text-amber-200/90">
                  Rs {variant.price.toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
