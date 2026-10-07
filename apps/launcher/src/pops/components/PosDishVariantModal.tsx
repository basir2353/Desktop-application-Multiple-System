import { useEffect, useMemo, useState } from "react";
import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { menuItemDisplayPrice } from "@platform/contracts";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";
import { POS_SHORTCUTS } from "../lib/posShortcuts";

export type PosVariantSelection = {
  variant: MenuItemVariant;
  qty: number;
};

type Props = {
  item: MenuItem;
  variants: MenuItemVariant[];
  onConfirm: (selections: PosVariantSelection[]) => void;
  onClose: () => void;
};

export function PosDishVariantModal({ item, variants, onConfirm, onClose }: Props): JSX.Element {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});

  useEffect(() => {
    setFocusedIndex(0);
    setQtyById({});
  }, [item.id, variants.length]);

  const selections = useMemo(
    () =>
      variants
        .map((variant) => ({ variant, qty: qtyById[variant.id] ?? 0 }))
        .filter((row) => row.qty > 0),
    [variants, qtyById],
  );

  function setQty(variantId: string, next: number): void {
    setQtyById((prev) => {
      const qty = Math.max(0, Math.round(next));
      if (qty <= 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: qty };
    });
  }

  function toggleChecked(variantId: string): void {
    setQtyById((prev) => {
      const current = prev[variantId] ?? 0;
      if (current > 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: 1 };
    });
  }

  function confirmSelections(): void {
    if (selections.length > 0) {
      onConfirm(selections);
      return;
    }
    const focused = variants[focusedIndex] ?? variants[0];
    if (focused) onConfirm([{ variant: focused, qty: 1 }]);
  }

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
        setFocusedIndex((i) => (i + 1) % variants.length);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((i) => (i - 1 + variants.length) % variants.length);
        return;
      }

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        e.stopPropagation();
        const variant = variants[focusedIndex];
        if (variant) toggleChecked(variant.id);
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        e.stopPropagation();
        const variant = variants[focusedIndex];
        if (variant) setQty(variant.id, (qtyById[variant.id] ?? 0) + 1);
        return;
      }

      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        e.stopPropagation();
        const variant = variants[focusedIndex];
        if (variant) setQty(variant.id, (qtyById[variant.id] ?? 0) - 1);
        return;
      }

      // Enter or Print (F8) applies checked rows (or focused row if none checked)
      if (e.key === "Enter" || e.key === POS_SHORTCUTS.printBill.key) {
        e.preventDefault();
        e.stopPropagation();
        confirmSelections();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, focusedIndex, variants, qtyById, selections]);

  const img = resolveMenuImageUrl(item.imageUrl);
  const fromPrice = menuItemDisplayPrice(item);
  const totalSelectedQty = selections.reduce((sum, row) => sum + row.qty, 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
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

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3" role="listbox" aria-multiselectable>
          {variants.map((variant, index) => {
            const focused = index === focusedIndex;
            const qty = qtyById[variant.id] ?? 0;
            const checked = qty > 0;
            return (
              <li key={variant.id} role="option" aria-selected={checked}>
                <div
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 transition ${
                    focused || checked
                      ? "border-amber-500/60 bg-amber-500/15 ring-1 ring-amber-500/40"
                      : "border-slate-200 bg-slate-50 hover:border-amber-500/40 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:bg-slate-900"
                  }`}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedIndex(index);
                      toggleChecked(variant.id);
                    }}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold transition ${
                      checked
                        ? "border-amber-600 bg-amber-500 text-slate-950"
                        : "border-slate-400 bg-white text-transparent dark:border-slate-600 dark:bg-slate-900"
                    }`}
                    aria-label={checked ? `Unselect ${variant.label}` : `Select ${variant.label}`}
                    aria-pressed={checked}
                  >
                    ✓
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFocusedIndex(index);
                      if (!checked) setQty(variant.id, 1);
                      else toggleChecked(variant.id);
                    }}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span
                      className={`truncate text-sm font-medium ${
                        focused || checked
                          ? "text-amber-900 dark:text-amber-100"
                          : "text-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {variant.label}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-200/90">
                      Rs {variant.price.toLocaleString()}
                    </span>
                  </button>

                  <div
                    className="flex shrink-0 items-center gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setFocusedIndex(index);
                        setQty(variant.id, qty - 1);
                      }}
                      aria-label={`Decrease ${variant.label}`}
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                      {qty}
                    </span>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setFocusedIndex(index);
                        setQty(variant.id, qty + 1);
                      }}
                      aria-label={`Increase ${variant.label}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
          <span className="text-[11px] text-slate-500">
            {totalSelectedQty > 0
              ? `${selections.length} size · Qty ${totalSelectedQty}`
              : "Tick sizes and set qty, then Add"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSelections}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              Add to order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
