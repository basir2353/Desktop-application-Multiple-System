import { menuItemDisplayPrice, type MenuItem as ApiMenuItem } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";
import { resolvePosSellableVariants, type PosCartLine } from "../lib/posCart";

type Category = { id: string; name: string; imageUrl?: string | null };

type Props = {
  categories: Category[];
  items: ApiMenuItem[];
  cartLines: PosCartLine[];
  totalQty: number;
  total: number;
  initialViewMode: "category" | "all";
  priceLabel?: (item: ApiMenuItem) => { display: number; original?: number };
  onAddItem: (item: ApiMenuItem) => void;
  onDecrementItem: (item: ApiMenuItem) => void;
  onDone: () => void;
  onClose: () => void;
};

function itemQtyInCart(itemId: string, cartLines: PosCartLine[]): number {
  return cartLines
    .filter((line) => line.item.id === itemId && !line.isComplimentary)
    .reduce((sum, line) => sum + line.qty, 0);
}

export function PosFullScreenMenuOverlay({
  categories,
  items,
  cartLines,
  totalQty,
  total,
  initialViewMode,
  priceLabel,
  onAddItem,
  onDecrementItem,
  onDone,
  onClose,
}: Props): JSX.Element {
  const [viewMode, setViewMode] = useState<"category" | "all">(initialViewMode);
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [search, setSearch] = useState("");

  const hasCartItems = totalQty > 0;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    if (!categoryId && categories[0]?.id) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const activeCategoryId = categoryId ?? categories[0]?.id ?? null;
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = items.filter((m) => {
      if (!m.isActive) return false;
      const catOk =
        viewMode === "all" || Boolean(q) || !activeCategoryId || m.categoryId === activeCategoryId;
      if (!catOk) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.barcode?.toLowerCase().includes(q) ?? false) ||
        m.variants.some((v) => v.label.toLowerCase().includes(q))
      );
    });
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [items, viewMode, activeCategoryId, q]);

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col bg-slate-950 text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-fullscreen-menu-title"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="pos-fullscreen-menu-title" className="text-sm font-semibold text-white">
            Full screen menu
          </h2>
          <p className="text-[11px] text-slate-400">
            {viewMode === "category"
              ? "Categories on top — tap one to see its items"
              : "All active items in one list"}
          </p>
        </div>
        <div className="inline-flex rounded-md border border-slate-600 bg-slate-800 p-0.5" role="group">
          <button
            type="button"
            onClick={() => setViewMode("category")}
            className={`rounded px-2.5 py-1.5 text-[11px] font-semibold transition ${
              viewMode === "category"
                ? "bg-amber-400 text-slate-950"
                : "text-white hover:bg-slate-700"
            }`}
          >
            Category wise
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("all");
              setCategoryId(null);
            }}
            className={`rounded px-2.5 py-1.5 text-[11px] font-semibold transition ${
              viewMode === "all"
                ? "bg-amber-400 text-slate-950"
                : "text-white hover:bg-slate-700"
            }`}
          >
            All items
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item…"
          className="w-44 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 outline-none focus:border-amber-400 sm:w-56"
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Close
        </button>
      </div>

      {viewMode === "category" && categories.length > 0 ? (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-3 py-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
            {categories.map((c, index) => {
              const active = activeCategoryId === c.id;
              const img = resolveMenuImageUrl(c.imageUrl);
              const count = items.filter((m) => m.isActive && m.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`flex min-w-[5.5rem] flex-col items-center gap-1 rounded-lg px-2 py-2 text-center transition ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30"
                      : "bg-slate-800 text-white ring-1 ring-slate-600 hover:bg-slate-700"
                  }`}
                >
                  {img ? (
                    <img src={img} alt="" className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold ${
                        active ? "bg-slate-950/15" : "bg-slate-700 text-amber-300"
                      }`}
                    >
                      {(c.name.trim().charAt(0) || "?").toUpperCase()}
                    </span>
                  )}
                  <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight">
                    {index + 1}. {c.name}
                  </span>
                  <span className="text-[9px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-[10px] text-slate-500">
          {filtered.length === 0
            ? "No items to show."
            : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {filtered.map((item) => {
            const img = resolveMenuImageUrl(item.imageUrl);
            const hasPicker = resolvePosSellableVariants(item).length > 1;
            const priced = priceLabel?.(item);
            const display = priced?.display ?? menuItemDisplayPrice(item);
            const original = priced?.original;
            const qty = itemQtyInCart(item.id, cartLines);
            return (
              <div
                key={item.id}
                className="flex flex-col rounded-lg border border-slate-600 bg-slate-800 p-2 transition hover:border-amber-400/60"
              >
                {img ? (
                  <img src={img} alt="" className="mb-1 h-16 w-full rounded object-cover" />
                ) : (
                  <div className="mb-1 flex h-16 items-center justify-center rounded bg-slate-700 text-[10px] font-semibold text-slate-300">
                    {item.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-white">
                  {item.featured ? <span className="mr-0.5 text-amber-400">★</span> : null}
                  {item.name}
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-amber-300">
                  {hasPicker ? "From " : ""}
                  {display.toLocaleString()}
                  {original != null && original !== display ? (
                    <span className="ml-1 font-normal text-slate-500 line-through">
                      {original.toLocaleString()}
                    </span>
                  ) : null}
                </span>
                <div className="mt-auto flex items-center justify-between gap-1 pt-2">
                  <button
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => onDecrementItem(item)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-900 text-base font-semibold text-white transition hover:border-amber-400 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-white">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddItem(item)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-400/50 bg-amber-400/15 text-base font-semibold text-amber-300 transition hover:bg-amber-400/30"
                    aria-label={`Add one ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasCartItems ? (
        <div className="shrink-0 border-t border-slate-700 bg-slate-900/95 px-4 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="min-w-0 text-xs text-slate-300">
              <span className="font-medium text-white">
                {totalQty} item{totalQty === 1 ? "" : "s"}
              </span>
              <span className="mx-2 text-slate-600">·</span>
              <span className="font-semibold tabular-nums text-amber-300">
                Rs {total.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onDone}
              className="shrink-0 rounded-md bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/25 transition hover:bg-amber-300"
            >
              Done — back to ticket
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
