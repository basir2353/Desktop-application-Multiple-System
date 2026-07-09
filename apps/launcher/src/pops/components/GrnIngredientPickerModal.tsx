import type { Ingredient } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import { inputClass } from "../hooks/useInventory";
import { modalBackdropRaisedClass } from "../lib/themeClasses";

type Props = {
  ingredients: Ingredient[];
  excludedIds: Set<string>;
  onConfirm: (ingredientIds: string[]) => void;
  onClose: () => void;
};

export function GrnIngredientPickerModal({
  ingredients,
  excludedIds,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const available = useMemo(
    () => ingredients.filter((ing) => !excludedIds.has(ing.id)),
    [ingredients, excludedIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (ing) =>
        ing.name.toLowerCase().includes(q) ||
        ing.sku.toLowerCase().includes(q) ||
        (ing.categoryName?.toLowerCase().includes(q) ?? false),
    );
  }, [available, search]);

  function toggle(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible(): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const ing of filtered) next.add(ing.id);
      return next;
    });
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  return (
    <div className={modalBackdropRaisedClass} onClick={onClose} role="presentation">
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grn-ingredient-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 id="grn-ingredient-picker-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              Select ingredients
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Choose one or more items to add to this GRN.</p>
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
            placeholder="Search ingredients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <button
              type="button"
              onClick={clearSelection}
              className="text-slate-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-slate-500">
              {available.length === 0
                ? "All ingredients are already on this GRN."
                : "No ingredients match your search."}
            </li>
          ) : (
            filtered.map((ing) => {
              const checked = selectedIds.has(ing.id);
              return (
                <li key={ing.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ing.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">{ing.name}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {ing.sku}
                        {ing.categoryName ? ` · ${ing.categoryName}` : ""}
                        {` · ${ing.currentStock} ${ing.unit}`}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            {selectedIds.size} selected
          </span>
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
