import {
  type StorePaymentLine,
  type StoreProduct,
  type StoreSale,
} from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  completeStoreHeldSale,
  createStoreSale,
  fetchStoreCustomers,
  fetchStoreOpenShift,
  fetchStorePosShortcuts,
  fetchStoreProducts,
  fetchStorePromotions,
  fetchStoreSales,
  syncStoreInventory,
  voidStoreHeldSale,
} from "../api/store";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { estimatePromotionDiscount, touchButtonEmoji } from "../lib/storePromotions";
import { StoreCheckoutModal } from "../components/StoreCheckoutModal";
import { StoreWeightModal } from "../components/StoreWeightModal";
import { printStoreInvoice } from "../lib/printStoreInvoice";
import {
  bumpOfflineAttempt,
  cartLineTotal,
  cartLineQtyLabel,
  cartToDisplayState,
  enqueueOfflineSale,
  getTerminalId,
  isOnline,
  loadOfflineQueue,
  publishCustomerDisplay,
  removeOfflineSale,
  subscribeScaleWeight,
  type CartLine,
} from "../lib/storePosSync";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { isLocalDataMode, shouldAutoSyncToCloud } from "../../stores/dataModeStore";

function ProductAvatar({ name }: { name: string }): JSX.Element {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sm font-bold text-sky-400 ring-1 ring-sky-500/20">
      {letter}
    </div>
  );
}

function StockBadge({ product }: { product: StoreProduct }): JSX.Element {
  const stock = product.isWeighed ? product.availableStock / 1000 : product.availableStock;
  const reorder = product.isWeighed ? product.reorderLevel / 1000 : product.reorderLevel;
  const label = product.isWeighed ? `${stock.toFixed(1)} kg` : String(stock);
  if (stock === 0) {
    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">Out</span>;
  }
  if (stock <= reorder) {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">{label} left</span>;
  }
  return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">{label} in stock</span>;
}

export function StorePosPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const terminalId = getTerminalId();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<StoreSale | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"complete" | "hold">("complete");
  const [weighProduct, setWeighProduct] = useState<StoreProduct | null>(null);
  const [pendingScaleKg, setPendingScaleKg] = useState<number | null>(null);
  const [offlineCount, setOfflineCount] = useState(loadOfflineQueue().length);
  const [resumingSaleId, setResumingSaleId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [giftCardNumber, setGiftCardNumber] = useState("");
  const [heldLabel, setHeldLabel] = useState("");

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
    refetchInterval: 5000,
  });

  const customersQuery = useQuery({
    queryKey: ["store", "customers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreCustomers(branch!.code),
  });

  const shortcutsQuery = useQuery({
    queryKey: ["store", "shortcuts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStorePosShortcuts(branch!.code),
  });

  const heldSalesQuery = useQuery({
    queryKey: ["store", "sales-held", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSales(branch!.code, "Held"),
  });

  const promotionsQuery = useQuery({
    queryKey: ["store", "promotions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStorePromotions(branch!.code),
  });

  const shiftQuery = useQuery({
    queryKey: ["store", "shift-open", branch?.code, terminalId],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreOpenShift(branch!.code, terminalId),
  });

  useEffect(() => {
    return subscribeScaleWeight((kg) => setPendingScaleKg(kg));
  }, []);

  const inStock = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.availableStock > 0),
    [productsQuery.data],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of inStock) if (p.categoryName) set.add(p.categoryName);
    return ["all", ...Array.from(set).sort()];
  }, [inStock]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = inStock;
    if (categoryFilter !== "all") list = list.filter((p) => p.categoryName === categoryFilter);
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q) ||
        (p.categoryName ?? "").toLowerCase().includes(q),
    );
  }, [inStock, search, categoryFilter]);

  const promotionDiscount = useMemo(
    () => estimatePromotionDiscount(cart, promotionsQuery.data ?? []),
    [cart, promotionsQuery.data],
  );

  const subtotal = cart.reduce((s, l) => s + cartLineTotal(l), 0);
  const tax = cart.reduce((s, l) => s + Math.round((cartLineTotal(l) * l.product.taxPct) / 100), 0);
  const total = Math.max(0, subtotal + tax - discount - promotionDiscount);
  const itemCount = cart.length;
  const selectedCustomer = (customersQuery.data ?? []).find((c) => c.id === customerId);

  const broadcastDisplay = useCallback(() => {
    if (!branch?.code) return;
    publishCustomerDisplay(
      cartToDisplayState(branch.code, branch.name ?? "Store", cart, subtotal, tax, discount, promotionDiscount, total),
    );
  }, [branch, cart, subtotal, tax, discount, promotionDiscount, total]);

  useEffect(() => {
    broadcastDisplay();
  }, [broadcastDisplay]);

  const addToCart = useCallback((product: StoreProduct, qtyKg?: number): void => {
    if (product.isWeighed) {
      const kg = qtyKg ?? pendingScaleKg ?? 0;
      if (kg <= 0) {
        setWeighProduct(product);
        return;
      }
      const grams = Math.round(kg * 1000);
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === product.id);
        if (existing) {
          const newGrams = (existing.qtyGrams ?? 0) + grams;
          if (newGrams > product.availableStock) return prev;
          return prev.map((c) =>
            c.product.id === product.id ? { ...c, qty: newGrams / 1000, qtyGrams: newGrams } : c,
          );
        }
        if (grams > product.availableStock) return prev;
        return [...prev, { product, qty: kg, qtyGrams: grams }];
      });
    } else {
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === product.id);
        if (existing) {
          if (existing.qty >= product.availableStock) return prev;
          return prev.map((c) => (c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c));
        }
        return [...prev, { product, qty: 1 }];
      });
    }
    setSearch("");
    setError(null);
    setPendingScaleKg(null);
  }, [pendingScaleKg]);

  useBarcodeScanner((code) => {
    const exact = inStock.find((p) => p.barcode === code || p.sku === code);
    if (exact) addToCart(exact);
    else setSearch(code);
  }, true);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key !== "F1" && !e.key.startsWith("F")) return;
      }
      const shortcut = shortcutsQuery.data?.find((s) => s.hotkey === e.key);
      if (shortcut) {
        e.preventDefault();
        const product = inStock.find((p) => p.id === shortcut.productId);
        if (product) addToCart(product);
        return;
      }
      if (e.key === "F9" && cart.length > 0) {
        e.preventDefault();
        setCheckoutMode("hold");
        setCheckoutOpen(true);
      }
      if (e.key === "F10" && cart.length > 0) {
        e.preventDefault();
        setCheckoutMode("complete");
        setCheckoutOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutsQuery.data, inStock, cart.length, addToCart]);

  async function flushOfflineQueue(): Promise<void> {
    const queue = loadOfflineQueue();
    for (const entry of queue) {
      try {
        await createStoreSale(entry.payload);
        removeOfflineSale(entry.id);
      } catch {
        bumpOfflineAttempt(entry.id);
      }
    }
    setOfflineCount(loadOfflineQueue().length);
    invalidate();
  }

  useEffect(() => {
    function onOnline(): void {
      if (shouldAutoSyncToCloud()) void flushOfflineQueue();
    }
    window.addEventListener("online", onOnline);
    if (shouldAutoSyncToCloud() && isOnline() && loadOfflineQueue().length > 0) void flushOfflineQueue();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const saleMutation = useMutation({
    mutationFn: async (payload: {
      status: "Completed" | "Held";
      payments?: StorePaymentLine[];
      loyaltyPointsRedeem?: number;
      isCredit?: boolean;
      paymentMethod?: string;
    }) => {
      const body = {
        branchCode: branch!.code,
        customerId: customerId || undefined,
        paymentMethod: (payload.paymentMethod ?? "Cash") as "Cash" | "Card" | "Bank Transfer" | "Mobile Wallet" | "Credit",
        discount,
        isCredit: payload.isCredit ?? false,
        reserveStock: false,
        status: payload.status,
        shiftId: shiftQuery.data?.id,
        terminalId,
        loyaltyPointsRedeem: payload.loyaltyPointsRedeem ?? 0,
        couponCode: couponCode || undefined,
        giftCardNumber: giftCardNumber || undefined,
        payments: payload.payments,
        heldLabel: payload.status === "Held" ? (heldLabel || `Hold ${new Date().toLocaleTimeString()}`) : undefined,
        lines: cart.map((c) => ({
          productId: c.product.id,
          qty: c.product.isWeighed ? c.qty : c.qty,
          qtyGrams: c.product.isWeighed ? c.qtyGrams : undefined,
        })),
      };

      if (isLocalDataMode() || !isOnline()) {
        enqueueOfflineSale(body);
        setOfflineCount(loadOfflineQueue().length);
        return null;
      }
      return createStoreSale(body);
    },
    onSuccess: (sale) => {
      invalidate();
      setCart([]);
      setSearch("");
      setDiscount(0);
      setCheckoutOpen(false);
      setResumingSaleId(null);
      if (sale) {
        setLastSale(sale);
        setNotice(`Invoice ${sale.invoiceNumber} — ${formatPkr(sale.total)}`);
        printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", sale);
      } else {
        setNotice(
          isLocalDataMode()
            ? "Sale saved locally — open Sync and push to cloud when ready"
            : "Sale saved offline — will sync when connection returns",
        );
      }
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const completeHeldMutation = useMutation({
    mutationFn: (payload: { saleId: string; payments: StorePaymentLine[]; loyaltyPointsRedeem: number; isCredit: boolean; paymentMethod: string }) =>
      completeStoreHeldSale(payload.saleId, {
        paymentMethod: payload.paymentMethod,
        payments: payload.payments,
        discount,
        loyaltyPointsRedeem: payload.loyaltyPointsRedeem,
        isCredit: payload.isCredit,
      }),
    onSuccess: (sale) => {
      invalidate();
      setCart([]);
      setCheckoutOpen(false);
      setResumingSaleId(null);
      setLastSale(sale);
      setNotice(`Resumed & completed ${sale.invoiceNumber}`);
      printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", sale);
    },
    onError: (e: Error) => setError(e.message),
  });

  function updateQty(productId: string, delta: number): void {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId) return c;
          if (c.product.isWeighed) {
            const grams = Math.max(0, (c.qtyGrams ?? 0) + delta * 100);
            return grams <= 0 ? null : { ...c, qty: grams / 1000, qtyGrams: grams };
          }
          const qty = c.qty + delta;
          return qty <= 0 ? null : { ...c, qty: Math.min(qty, c.product.availableStock) };
        })
        .filter(Boolean) as CartLine[],
    );
  }

  function tryAddFromSearch(): void {
    const q = search.trim();
    if (!q) return;
    const exact = inStock.find((p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase());
    if (exact) { addToCart(exact); return; }
    if (matches[0]) addToCart(matches[0]);
  }

  function resumeHeldSale(sale: StoreSale): void {
    const products = productsQuery.data ?? [];
    const lines: CartLine[] = sale.lines.map((l) => {
      const product = products.find((p) => p.id === l.productId);
      if (!product) throw new Error(`Product ${l.productName} not found`);
      return product.isWeighed
        ? { product, qty: l.qty / 1000, qtyGrams: l.qty }
        : { product, qty: l.qty };
    });
    setCart(lines);
    setCustomerId(sale.customerId ?? "");
    setDiscount(sale.discount);
    setResumingSaleId(sale.id);
    setNotice(`Resumed ${sale.heldLabel ?? sale.invoiceNumber}`);
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

  const displayBranch = branch?.code ?? "default";

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row lg:gap-5">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">High-Speed Checkout</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {branch?.name} · Terminal {terminalId}
              {shiftQuery.data ? ` · Shift: ${shiftQuery.data.cashierName}` : " · No shift open"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {offlineCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 font-medium text-amber-600">{offlineCount} offline sale(s)</span>
            ) : null}
            <Link to={`/pops/store/customer-display?branch=${encodeURIComponent(displayBranch)}`} target="_blank" className="text-sky-600 hover:underline">
              Open customer display ↗
            </Link>
            <button type="button" onClick={() => void syncStoreInventory(branch!.code).then(() => productsQuery.refetch())} className="text-slate-500 hover:text-sky-600">
              Sync stock
            </button>
          </div>
        </div>

        {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
        {error ? <div className={noticeErrorClass}>{error}</div> : null}
        {pendingScaleKg != null ? (
          <div className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-200">
            Scale: <strong>{pendingScaleKg.toFixed(3)} kg</strong> — tap a weighed product to add
          </div>
        ) : null}

        {(shortcutsQuery.data ?? []).length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {(shortcutsQuery.data ?? []).map((s) => {
              const product = inStock.find((x) => x.id === s.productId);
              return (
              <button
                key={s.id}
                type="button"
                onClick={() => { if (product) addToCart(product); }}
                className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2.5 text-center shadow-sm transition hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900/60"
              >
                <span className="text-2xl">{touchButtonEmoji(s.label, product)}</span>
                <span className="text-[10px] font-semibold leading-tight">{s.label}</span>
                <kbd className="text-[9px] text-slate-400">{s.hotkey}</kbd>
              </button>
            );})}
          </div>
        ) : null}

        {(heldSalesQuery.data ?? []).length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Suspended bills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(heldSalesQuery.data ?? []).map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => resumeHeldSale(sale)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-amber-700 dark:bg-slate-900"
                >
                  {sale.heldLabel ?? sale.invoiceNumber} · {formatPkr(sale.total)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative">
            <input
            type="text"
            data-scan-target="true"
            placeholder="Search name, SKU, barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); tryAddFromSearch(); }
              if (e.key === "Escape") setSearch("");
            }}
            autoFocus
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-4 pr-4 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
          />
        </div>

        {categories.length > 2 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ${categoryFilter === cat ? "bg-sky-600 text-white" : "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40"}`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-sky-400 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <ProductAvatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold group-hover:text-sky-600 dark:group-hover:text-sky-400">{p.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{p.sku}{p.isWeighed ? " · by weight" : ""}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-sky-600 dark:text-sky-400">
                      {p.isWeighed ? `${formatPkr(p.sellingPrice)}/kg` : formatPkr(p.sellingPrice)}
                    </span>
                    <StockBadge product={p} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-[400px]">
        <div className="sticky top-4 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900/80">
          <div className="border-b bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Current sale</h2>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">{itemCount} lines</span>
            </div>
          </div>

          <div className="min-h-[180px] flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-slate-500">
                <span className="text-3xl">🛒</span>
                <p className="mt-2">Scan, tap, or press F-keys</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {cart.map((line) => (
                  <li key={line.product.id} className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.product.name}</p>
                      <p className="text-[11px] text-slate-500">{cartLineQtyLabel(line)} · {formatPkr(cartLineTotal(line))}</p>
                    </div>
                    {!line.product.isWeighed ? (
                      <div className="flex items-center rounded-lg border bg-slate-50 dark:bg-slate-800/60">
                        <button type="button" className="h-8 w-8" onClick={() => updateQty(line.product.id, -1)}>−</button>
                        <span className="w-6 text-center text-sm">{line.qty}</span>
                        <button type="button" className="h-8 w-8" onClick={() => updateQty(line.product.id, 1)}>+</button>
                      </div>
                    ) : null}
                    <button type="button" onClick={() => updateQty(line.product.id, -999)} className="text-slate-400 hover:text-red-500">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t bg-slate-50/80 px-4 py-4 dark:bg-slate-950/40">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPkr(subtotal)}</span></div>
              {tax > 0 ? <div className="flex justify-between"><span>Tax</span><span>{formatPkr(tax)}</span></div> : null}
              {promotionDiscount > 0 ? (
                <div className="flex justify-between text-emerald-600"><span>Promotions</span><span>-{formatPkr(promotionDiscount)}</span></div>
              ) : null}
              <div className="flex justify-between gap-2">
                <span>Discount</span>
                <input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="w-24 rounded border px-2 py-1 text-right text-sm" />
              </div>
            </div>
            <div className="mt-3 flex justify-between border-t pt-3 text-2xl font-bold">
              <span>Total</span>
              <span>{formatPkr(total)}</span>
            </div>

            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-3 w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">Walk-in customer</option>
              {(customersQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.loyaltyPoints} pts</option>
              ))}
            </select>

            <input type="text" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input type="text" placeholder="Gift card number" value={giftCardNumber} onChange={(e) => setGiftCardNumber(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => { setCheckoutMode("hold"); setCheckoutOpen(true); }}
                className="rounded-xl border border-amber-300 py-3 text-sm font-semibold text-amber-700 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300"
              >
                Suspend (F9)
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || saleMutation.isPending}
                onClick={() => { setCheckoutMode("complete"); setCheckoutOpen(true); }}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Checkout (F10)
              </button>
            </div>

            {resumingSaleId ? (
              <button
                type="button"
                onClick={() => void voidStoreHeldSale(resumingSaleId).then(() => { setResumingSaleId(null); setCart([]); invalidate(); })}
                className="mt-2 w-full text-xs text-red-500 hover:underline"
              >
                Cancel resumed hold
              </button>
            ) : null}

            {lastSale ? (
              <button type="button" onClick={() => printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", lastSale)} className="mt-2 w-full rounded-lg border py-2 text-xs">
                Reprint {lastSale.invoiceNumber}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {checkoutOpen ? (
        <StoreCheckoutModal
          total={total}
          subtotal={subtotal}
          tax={tax}
          discount={discount}
          promotionDiscount={promotionDiscount}
          loyaltyRedeem={0}
          customerLoyaltyPoints={selectedCustomer?.loyaltyPoints ?? 0}
          isSubmitting={saleMutation.isPending || completeHeldMutation.isPending}
          mode={checkoutMode}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={(payload) => {
            if (resumingSaleId && checkoutMode === "complete") {
              completeHeldMutation.mutate({
                saleId: resumingSaleId,
                payments: payload.payments,
                loyaltyPointsRedeem: payload.loyaltyPointsRedeem,
                isCredit: payload.isCredit,
                paymentMethod: payload.paymentMethod,
              });
            } else {
              saleMutation.mutate({
                status: checkoutMode === "hold" ? "Held" : "Completed",
                payments: payload.payments,
                loyaltyPointsRedeem: payload.loyaltyPointsRedeem,
                isCredit: payload.isCredit,
                paymentMethod: payload.paymentMethod,
              });
            }
          }}
        />
      ) : null}

      {weighProduct ? (
        <StoreWeightModal
          product={weighProduct}
          initialKg={pendingScaleKg ?? undefined}
          onClose={() => setWeighProduct(null)}
          onConfirm={(kg) => {
            addToCart(weighProduct, kg);
            setWeighProduct(null);
          }}
        />
      ) : null}
    </div>
  );
}
