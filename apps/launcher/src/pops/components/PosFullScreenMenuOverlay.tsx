import { menuItemDisplayPrice, type MenuItem as ApiMenuItem } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";
import { resolvePosSellableVariants } from "../lib/posCart";

type Category = { id: string; name: string; imageUrl?: string | null };

type Props = {
  categories: Category[];
  items: ApiMenuItem[];
  initialViewMode: "category" | "all";
  priceLabel?: (item: ApiMenuItem) => { display: number; original?: number };
  onPickItem: (item: ApiMenuItem) => void;
  onClose: () => void;
};

export function PosFullScreenMenuOverlay({
  categories,
  items,
  initialViewMode,
  priceLabel,
  onPickItem,
  onClose,
}: Props): JSX.Element {
  const [viewMode, setViewMode] = useState<"category" | "all">(initialViewMode);
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [search, setSearch] = useState("");

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
      className="fixed inset-0 z-[45] flex flex-col bg-slate-950"
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
        <div className="inline-flex rounded-md border border-slate-700 bg-slate-900 p-0.5" role="group">
          <button
            type="button"
            onClick={() => setViewMode("category")}
            className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${
              viewMode === "category" ? "bg-amber-500 text-slate-950" : "text-slate-300"
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
            className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${
              viewMode === "all" ? "bg-amber-500 text-slate-950" : "text-slate-300"
            }`}
          >
            All items
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item…"
          className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50 sm:w-56"
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          Close
        </button>
      </div>

      {viewMode === "category" && categories.length > 0 ? (
        <div className="shrink-0 border-b border-slate-800 bg-amber-500/5 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => {
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
                      ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                      : "bg-slate-900 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-800"
                  }`}
                >
                  {img ? (
                    <img src={img} alt="" className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold ${
                        active ? "bg-slate-950/15" : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {(c.name.trim().charAt(0) || "?").toUpperCase()}
                    </span>
                  )}
                  <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight">
                    {c.name}
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {filtered.map((item) => {
            const img = resolveMenuImageUrl(item.imageUrl);
            const hasPicker = resolvePosSellableVariants(item).length > 1;
            const priced = priceLabel?.(item);
            const display = priced?.display ?? menuItemDisplayPrice(item);
            const original = priced?.original;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPickItem(item)}
                className="flex flex-col rounded-md border border-slate-800 bg-slate-900/70 p-2 text-left transition hover:border-amber-500/40 hover:bg-slate-900"
              >
                {img ? (
                  <img src={img} alt="" className="mb-1 h-16 w-full rounded object-cover" />
                ) : (
                  <div className="mb-1 flex h-16 items-center justify-center rounded bg-slate-950 text-[10px] text-slate-600">
                    {item.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-100">
                  {item.featured ? <span className="mr-0.5 text-amber-400">★</span> : null}
                  {item.name}
                </span>
                <span className="mt-1 text-[11px] font-semibold text-amber-200/90">
                  {hasPicker ? "From " : ""}
                  {display.toLocaleString()}
                  {original != null && original !== display ? (
                    <span className="ml-1 font-normal text-slate-500 line-through">
                      {original.toLocaleString()}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
