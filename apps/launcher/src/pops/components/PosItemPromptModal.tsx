import { useEffect, useRef, useState } from "react";
import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { formatMenuItemLabel } from "@platform/contracts";

type Props = {
  item: MenuItem;
  variant: MenuItemVariant | null;
  defaultPrice: number;
  defaultQty?: number;
  onConfirm: (result: { price: number; qty: number }) => void;
  onClose: () => void;
};

export function PosItemPromptModal({
  item,
  variant,
  defaultPrice,
  defaultQty = 1,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [price, setPrice] = useState(String(defaultPrice > 0 ? defaultPrice : ""));
  const [qty, setQty] = useState(String(defaultQty > 0 ? defaultQty : 1));
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  const label = formatMenuItemLabel({
    name: item.name,
    portion: item.portion,
    variantLabel: variant?.label ?? null,
  });

  useEffect(() => {
    firstRef.current?.focus();
    firstRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(): void {
    const nextQty = item.askForQty ? Number(qty) : 1;
    const nextPrice = item.askForPrice ? Number(price) : defaultPrice;
    if (item.askForQty && (!Number.isFinite(nextQty) || nextQty < 1)) {
      setError("Enter a valid quantity (1 or more).");
      return;
    }
    if (item.askForPrice && (!Number.isFinite(nextPrice) || nextPrice < 0)) {
      setError("Enter a valid price.");
      return;
    }
    onConfirm({
      price: Math.round(nextPrice),
      qty: Math.max(1, Math.round(nextQty)),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-item-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pos-item-prompt-title" className="text-sm font-semibold text-slate-900 dark:text-white">
          {label}
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">Enter details, then press Enter.</p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {item.askForPrice ? (
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              Price (PKR)
              <input
                ref={firstRef}
                type="number"
                min={0}
                step={1}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
              />
            </label>
          ) : null}
          {item.askForQty ? (
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              Quantity
              <input
                ref={item.askForPrice ? undefined : firstRef}
                type="number"
                min={1}
                step={1}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
              />
            </label>
          ) : null}
          {error ? <p className="text-xs text-red-600 dark:text-red-300">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
            >
              Add to ticket
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
