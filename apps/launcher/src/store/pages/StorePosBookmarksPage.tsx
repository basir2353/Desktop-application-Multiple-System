import type { StoreProduct } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import { fetchStoreProducts } from "../api/store";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import {
  loadStorePosBookmarks,
  saveStorePosBookmarks,
  toggleStorePosBookmark,
} from "../lib/storePosBookmarks";
import { StoreInput } from "../ui/StoreUi";

export function StorePosBookmarksPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => loadStorePosBookmarks(undefined));
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"bookmarked" | "add">("bookmarked");

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  useEffect(() => {
    setBookmarks(loadStorePosBookmarks(branch?.code));
  }, [branch?.code]);

  const products = productsQuery.data ?? [];

  const bookmarkedProducts = useMemo(() => {
    return products
      .filter((p) => bookmarks.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, bookmarks]);

  const addCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => !bookmarks.has(p.id));
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q) ||
          (p.barcodes ?? []).some((b) => b.toLowerCase().includes(q)) ||
          (p.categoryName ?? "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);
  }, [products, bookmarks, search]);

  function handleToggle(productId: string): void {
    setBookmarks(toggleStorePosBookmark(productId, branch?.code));
  }

  function clearAll(): void {
    if (!window.confirm("Remove all POS bookmarks for this branch?")) return;
    saveStorePosBookmarks(new Set(), branch?.code);
    setBookmarks(new Set());
  }

  if (productsQuery.isError) {
    return <div className={noticeErrorClass}>{(productsQuery.error as Error).message}</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="POS bookmarks"
        subtitle="Choose which products appear on the Point of sale screen by default. Large catalogs stay fast when POS shows only ★ bookmarks — search still finds every item."
      />

      <section className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {bookmarkedProducts.length} product{bookmarkedProducts.length === 1 ? "" : "s"} bookmarked
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
              Sales → Point of sale opens on the Bookmarks tab. Open{" "}
              <Link to="/pops/store/pos" className="font-semibold underline underline-offset-2">
                POS
              </Link>{" "}
              to sell.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pops/store/pos"
              className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              Open POS
            </Link>
            {bookmarkedProducts.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
        <button
          type="button"
          onClick={() => setTab("bookmarked")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
            tab === "bookmarked"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          ★ Bookmarked ({bookmarkedProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("add")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
            tab === "add"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          + Add products
        </button>
      </div>

      {tab === "add" ? (
        <div className="space-y-3">
          <StoreInput
            placeholder="Search name, SKU, barcode, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {productsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading products…</p>
          ) : addCandidates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              {search.trim()
                ? "No matching products left to bookmark."
                : "All products are already bookmarked, or none exist yet."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="hidden px-3 py-2 font-semibold sm:table-cell">Category</th>
                    <th className="hidden px-3 py-2 font-semibold md:table-cell">SKU</th>
                    <th className="px-3 py-2 font-semibold">Price</th>
                    <th className="px-3 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950/40">
                  {addCandidates.map((p) => (
                    <ProductRow key={p.id} product={p} bookmarked={false} onToggle={() => handleToggle(p.id)} />
                  ))}
                </tbody>
              </table>
              {search.trim() === "" && products.filter((p) => !bookmarks.has(p.id)).length > 80 ? (
                <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                  Showing first 80 — use search to find more.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : productsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading products…</p>
      ) : bookmarkedProducts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No POS bookmarks yet</p>
          <p className="max-w-md text-xs text-slate-500">
            Add fast-selling items here. They will show first when you open Point of sale.
          </p>
          <button
            type="button"
            onClick={() => setTab("add")}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            Add products
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/80">
              <tr>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Category</th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">SKU</th>
                <th className="px-3 py-2 font-semibold">Price</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950/40">
              {bookmarkedProducts.map((p) => (
                <ProductRow key={p.id} product={p} bookmarked onToggle={() => handleToggle(p.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  bookmarked,
  onToggle,
}: {
  product: StoreProduct;
  bookmarked: boolean;
  onToggle: () => void;
}): JSX.Element {
  const price =
    product.salePrice > 0 && product.salePrice < product.sellingPrice
      ? product.salePrice
      : product.sellingPrice;

  return (
    <tr className="hover:bg-amber-50/40 dark:hover:bg-slate-900/60">
      <td className="px-3 py-2.5">
        <p className="font-semibold text-slate-900 dark:text-white">{product.name}</p>
        {product.barcode ? (
          <p className="text-[11px] tabular-nums text-slate-400">{product.barcode}</p>
        ) : null}
      </td>
      <td className="hidden px-3 py-2.5 text-slate-600 dark:text-slate-400 sm:table-cell">
        {product.categoryName ?? "—"}
      </td>
      <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-500 md:table-cell">{product.sku || "—"}</td>
      <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-800 dark:text-slate-200">
        {formatPkr(price)}
        {product.isWeighed ? <span className="text-[10px] font-medium text-slate-400">/kg</span> : null}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
            bookmarked
              ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
              : "border border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-500/50"
          }`}
        >
          <span aria-hidden>★</span>
          {bookmarked ? "Remove" : "Bookmark"}
        </button>
      </td>
    </tr>
  );
}
