import { STORE_PAYMENT_METHODS, type StoreProduct, type StoreSale } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createStoreSale, fetchStoreCustomers, fetchStoreProducts } from "../api/store";
import { printStoreInvoice } from "../lib/printStoreInvoice";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

type CartLine = { product: StoreProduct; qty: number };

const PAYMENT_ICONS: Record<(typeof STORE_PAYMENT_METHODS)[number], string> = {
  Cash: "💵",
  Card: "💳",
  "Bank Transfer": "🏦",
  "Mobile Wallet": "📱",
  Credit: "📋",
};

function ProductAvatar({ name }: { name: string }): JSX.Element {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sm font-bold text-sky-400 ring-1 ring-sky-500/20">
      {letter}
    </div>
  );
}

function StockBadge({ stock, reorder }: { stock: number; reorder: number }): JSX.Element {
  if (stock === 0) {
    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">Out</span>;
  }
  if (stock <= reorder) {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">{stock} left</span>;
  }
  return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">{stock} in stock</span>;
}

export function StorePosPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<(typeof STORE_PAYMENT_METHODS)[number]>("Cash");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isCredit, setIsCredit] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<StoreSale | null>(null);

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });
  const customersQuery = useQuery({
    queryKey: ["store", "customers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreCustomers(branch!.code),
  });

  const saleMutation = useMutation({
    mutationFn: () =>
      createStoreSale({
        branchCode: branch!.code,
        customerId: customerId || undefined,
        paymentMethod,
        discount,
        isCredit,
        lines: cart.map((c) => ({ productId: c.product.id, qty: c.qty })),
      }),
    onSuccess: (sale: StoreSale) => {
      invalidate();
      setCart([]);
      setSearch("");
      setDiscount(0);
      setLastSale(sale);
      setNotice(`Invoice ${sale.invoiceNumber} — ${formatPkr(sale.total)}`);
      setError(null);
      printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", sale);
    },
    onError: (e: Error) => setError(e.message),
  });

  const inStock = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.availableStock > 0),
    [productsQuery.data],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of inStock) {
      if (p.categoryName) set.add(p.categoryName);
    }
    return ["all", ...Array.from(set).sort()];
  }, [inStock]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = inStock;
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.categoryName === categoryFilter);
    }
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q) ||
        (p.categoryName ?? "").toLowerCase().includes(q),
    );
  }, [inStock, search, categoryFilter]);

  const subtotal = cart.reduce((s, l) => s + l.product.sellingPrice * l.qty, 0);
  const tax = cart.reduce(
    (s, l) => s + Math.round((l.product.sellingPrice * l.qty * l.product.taxPct) / 100),
    0,
  );
  const total = Math.max(0, subtotal + tax - discount);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  function addToCart(product: StoreProduct): void {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.availableStock) return prev;
        return prev.map((c) => (c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { product, qty: 1 }];
    });
    setSearch("");
    setError(null);
  }

  function updateQty(productId: string, qty: number): void {
    setCart((prev) => {
      const line = prev.find((c) => c.product.id === productId);
      if (!line) return prev;
      const max = line.product.availableStock;
      if (qty <= 0) return prev.filter((c) => c.product.id !== productId);
      return prev.map((c) => (c.product.id === productId ? { ...c, qty: Math.min(qty, max) } : c));
    });
  }

  function tryAddFromSearch(): void {
    const q = search.trim();
    if (!q) return;
    const exact = inStock.find((p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase());
    if (exact) {
      addToCart(exact);
      return;
    }
    if (matches[0]) addToCart(matches[0]);
  }

  if (productsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Loading products…</p>
        </div>
      </div>
    );
  }

  if (productsQuery.isError) {
    return <div className={noticeErrorClass}>{(productsQuery.error as Error).message}</div>;
  }

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row lg:gap-5">
      {/* ── Left: catalog ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Header strip */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Point of Sale</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {branch?.name ?? "Store"} · Scan barcode or tap a product to add
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono dark:border-slate-600 dark:bg-slate-800">Enter</kbd>
            <span>to add ·</span>
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono dark:border-slate-600 dark:bg-slate-800">Esc</kbd>
            <span>to clear search</span>
          </div>
        </div>

        {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
        {error ? <div className={noticeErrorClass}>{error}</div> : null}

        {/* Search */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search name, SKU, barcode, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryAddFromSearch();
              }
              if (e.key === "Escape") setSearch("");
            }}
            autoFocus
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-sky-500/30"
          />
        </div>

        {/* Category pills */}
        {categories.length > 2 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  categoryFilter === cat
                    ? "bg-sky-600 text-white shadow-sm shadow-sky-600/25"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:border-sky-600"
                }`}
              >
                {cat === "all" ? "All products" : cat}
              </button>
            ))}
          </div>
        ) : null}

        {/* Product grid */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {search.trim() ? `${matches.length} result${matches.length === 1 ? "" : "s"}` : `${matches.length} products`}
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 dark:border-slate-700">
              <span className="text-3xl opacity-40">📦</span>
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">No products found</p>
              <p className="mt-1 text-xs text-slate-500">Try a different search or category</p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {matches.map((p) => {
                const inCart = cart.find((c) => c.product.id === p.id)?.qty ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className={`group relative flex items-start gap-3 rounded-xl border bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md dark:bg-slate-900/70 ${
                      inCart > 0
                        ? "border-sky-500/60 ring-1 ring-sky-500/30"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {inCart > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white shadow">
                        {inCart}
                      </span>
                    ) : null}
                    <ProductAvatar name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
                        {p.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {p.sku}
                        {p.categoryName ? ` · ${p.categoryName}` : ""}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-base font-bold tabular-nums text-sky-600 dark:text-sky-400">
                          {formatPkr(p.sellingPrice)}
                        </span>
                        <StockBadge stock={p.availableStock} reorder={p.reorderLevel} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: cart & checkout ── */}
      <div className="w-full shrink-0 lg:w-[380px] xl:w-[400px]">
        <div className="sticky top-4 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-950/50">
          {/* Cart header */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Current sale</h2>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Cart lines */}
          <div className="min-h-[180px] flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">🛒</div>
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Cart is empty</p>
                <p className="mt-1 max-w-[200px] text-xs text-slate-500">Tap products on the left or scan a barcode to start</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {cart.map((line) => (
                  <li key={line.product.id} className="flex items-center gap-2 py-3 first:pt-1">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{line.product.name}</p>
                      <p className="text-[11px] text-slate-500">{formatPkr(line.product.sellingPrice)} each</p>
                    </div>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={() => updateQty(line.product.id, line.qty - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.qty}</span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={() => updateQty(line.product.id, line.qty + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <p className="w-[72px] text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatPkr(line.product.sellingPrice * line.qty)}
                    </p>
                    <button
                      type="button"
                      onClick={() => updateQty(line.product.id, 0)}
                      className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                      aria-label={`Remove ${line.product.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals & checkout */}
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPkr(subtotal)}</span>
              </div>
              {tax > 0 ? (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax</span>
                  <span className="tabular-nums">{formatPkr(tax)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-400">Discount</span>
                <input
                  type="number"
                  min={0}
                  value={discount || ""}
                  placeholder="0"
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{formatPkr(total)}</span>
            </div>

            {/* Customer */}
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Customer</span>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Walk-in customer</option>
                {(customersQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            {/* Payment method pills */}
            <div className="mt-3">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Payment</span>
              <div className="grid grid-cols-3 gap-1.5">
                {STORE_PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-[10px] font-medium transition ${
                      paymentMethod === m
                        ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    <span className="text-base leading-none">{PAYMENT_ICONS[m]}</span>
                    <span className="truncate">{m.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900/60">
              <input
                type="checkbox"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Credit sale (add to customer balance)</span>
            </label>

            <button
              type="button"
              disabled={cart.length === 0 || saleMutation.isPending}
              onClick={() => saleMutation.mutate()}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-600/25 transition hover:from-sky-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {saleMutation.isPending ? "Processing…" : `Complete sale · ${formatPkr(total)}`}
            </button>

            {cart.length > 0 ? (
              <button
                type="button"
                onClick={() => { setCart([]); setDiscount(0); }}
                className="mt-2 w-full rounded-lg py-2 text-sm text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                Clear cart
              </button>
            ) : null}

            {lastSale ? (
              <button
                type="button"
                onClick={() => printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", lastSale)}
                className="mt-1 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                Reprint last invoice ({lastSale.invoiceNumber})
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
