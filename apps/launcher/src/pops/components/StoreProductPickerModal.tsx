import type { StoreProduct } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import { inputClass } from "../hooks/useInventory";
import { modalBackdropRaisedClass } from "../lib/themeClasses";

type Props = {
  products: StoreProduct[];
  /** Already on the transfer list — hidden from picker. */
  excludedIds?: Set<string>;
  onConfirm: (productIds: string[]) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  emptyAllMessage?: string;
};

/**
 * Searchable store-product picker: search, checkboxes, Add selected.
 */
export function StoreProductPickerModal({
  products,
  excludedIds,
  onConfirm,
  onClose,
  title = "Select items",
  subtitle = "Choose one or more products to add to this transfer.",
  emptyAllMessage = "All products are already on this transfer.",
}: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const available = useMemo(
    () => products.filter((product) => !excludedIds?.has(product.id)),
    [excludedIds, products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((product) => {
      const haystack = [product.name, product.sku, product.categoryName ?? "", product.unitName ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [available, search]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggle(productId: string): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function selectAllVisible(): void {
    setSelectedIds(new Set(filtered.map((product) => product.id)));
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  return (
    <div className={modalBackdropRaisedClass} onClick={onClose} role="presentation">
      <div
        className="flex max-h-[75vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-product-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 id="store-product-picker-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <input
            className={inputClass}
            placeholder="Search products…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <div className="mt-2 flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-indigo-600 hover:underline dark:text-indigo-300"
            >
              Select visible
            </button>
            <button type="button" onClick={clearSelection} className="text-slate-500 hover:underline">
              Clear
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-slate-500">
              {available.length === 0 ? emptyAllMessage : "No products match your search."}
            </li>
          ) : (
            filtered.map((product) => {
              const checked = selectedIds.has(product.id);
              return (
                <li key={product.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(product.id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">{product.name}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {product.sku}
                        {product.categoryName ? ` · ${product.categoryName}` : ""}
                        {product.unitName ? ` · ${product.unitName}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => onConfirm([...selectedIds])}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              Add selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
