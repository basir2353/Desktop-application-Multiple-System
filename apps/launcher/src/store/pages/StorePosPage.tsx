import {
  type StorePaymentLine,
  type StorePaymentMethod,
  type StoreProduct,
  type StoreSale,
} from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  completeStoreHeldSale,
  createStoreSale,
  fetchStoreCustomers,
  fetchStoreOpenShift,
  fetchStoreProducts,
  fetchStorePromotions,
  fetchStoreSales,
  syncStoreInventory,
  voidStoreHeldSale,
} from "../api/store";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { estimatePromotionDiscount } from "../lib/storePromotions";
import { StoreCheckoutModal } from "../components/StoreCheckoutModal";
import { StoreWeightModal } from "../components/StoreWeightModal";
import { StorePayInOutModal } from "../components/StorePayInOutModal";
import { printStoreInvoice, printStoreCartReceipt, buildStoreCartReceiptHtml, buildStoreSaleInvoiceHtml } from "../lib/printStoreInvoice";
import {
  findDefaultStoreCustomer,
  loadStoreCashSetup,
} from "../lib/storeCashSetup";
import {
  DEFAULT_STORE_POS_VIEW,
  loadStorePosBookmarks,
  loadStorePosBrowseView,
  saveStorePosBrowseView,
  toggleStorePosBookmark,
  type StorePosBrowseView,
} from "../lib/storePosBookmarks";
import {
  loadStorePosActionMap,
  matchStorePosHotkey,
  type StorePosActionId,
} from "../lib/storePosActionShortcuts";
import {
  bumpOfflineAttempt,
  cartLineTotal,
  cartLineUnitPrice,
  cartLineDisplayName,
  cartToDisplayState,
  enqueueOfflineSale,
  getTerminalId,
  isOnline,
  loadOfflineQueue,
  publishCustomerDisplay,
  productMatchesCode,
  removeOfflineSale,
  subscribeScaleWeight,
  type CartLine,
} from "../lib/storePosSync";
import {
  loadVisibleColumns,
  POS_COLUMNS,
  saveVisibleColumns,
  type PosColumnId,
} from "../lib/posColumns";
import { StoreItemPropertiesModal } from "../components/StoreItemPropertiesModal";
import { StorePriceDiscountModal } from "../components/StorePriceDiscountModal";
import { StoreLatestSalesPanel } from "../components/StoreLatestSalesPanel";
import { StoreSalesReceiptTable } from "../components/StoreSalesReceiptTable";
import {
  StorePosSalesWorkbench,
  defaultPaymentLabelFromMethod,
  isAccountPaymentLabel,
  paymentMethodFromPosLabel,
  type PosPaymentLabel,
} from "../components/StorePosSalesWorkbench";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { isLocalDataMode, shouldAutoSyncToCloud } from "../../stores/dataModeStore";

/** Ticket / product / sales columns — taller so footer is fully visible. */
const STORE_POS_COL_H =
  "lg:sticky lg:top-0 lg:h-[calc(100dvh-5rem)] lg:max-h-[calc(100dvh-5rem)] lg:min-h-0";

const POS_ZOOM_MIN = 60;
const POS_ZOOM_MAX = 150;
const POS_ZOOM_STEP = 10;
const POS_ZOOM_STORAGE_KEY = "store-pos-zoom-pct";

function loadPosZoomPct(): number {
  try {
    const raw = localStorage.getItem(POS_ZOOM_STORAGE_KEY);
    const n = raw ? Number(raw) : 100;
    if (!Number.isFinite(n)) return 100;
    return Math.min(POS_ZOOM_MAX, Math.max(POS_ZOOM_MIN, Math.round(n / POS_ZOOM_STEP) * POS_ZOOM_STEP));
  } catch {
    return 100;
  }
}

const POS_HOLD_BTN =
  "inline-flex h-9 w-full items-center justify-center rounded-lg border-0 bg-amber-500 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50";
const POS_PAY_BTN =
  "inline-flex h-9 w-full items-center justify-center rounded-lg border-0 bg-emerald-600 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50";
const POS_SECONDARY_BTN =
  "inline-flex h-8 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-50";

function StockBadge({ product }: { product: StoreProduct }): JSX.Element {
  const stock = product.isWeighed ? product.availableStock / 1000 : product.availableStock;
  const reorder = product.isWeighed ? product.reorderLevel / 1000 : product.reorderLevel;
  const label = product.isWeighed ? `${stock.toFixed(1)} kg` : String(stock);
  if (stock === 0) {
    return <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Out</span>;
  }
  if (stock <= reorder) {
    return <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{label}</span>;
  }
  return <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{label}</span>;
}

/** Restaurant-style POS product tile (category · name · Rs · badges · SKU). */
function StorePosProductCard({
  product,
  bookmarked,
  onAdd,
  onToggleBookmark,
}: {
  product: StoreProduct;
  bookmarked: boolean;
  onAdd: () => void;
  onToggleBookmark: () => void;
}): JSX.Element {
  const badges: string[] = [];
  if (product.isWeighed) badges.push("kg");
  const size = (product.size ?? "").trim();
  const color = (product.color ?? "").trim();
  const unit = (product.unitName ?? "").trim();
  if (size) badges.push(size);
  if (color) badges.push(color);
  if (unit && !product.isWeighed && !badges.some((b) => b.toLowerCase() === unit.toLowerCase())) {
    badges.push(unit);
  }
  if (badges.length === 0) badges.push("Unit");

  const hasPromo =
    product.salePrice > 0 && product.salePrice < product.sellingPrice;
  const displayPrice = hasPromo ? product.salePrice : product.sellingPrice;
  const priceLabel = product.isWeighed
    ? `From ${formatPkr(displayPrice)}`
    : formatPkr(displayPrice);

  return (
    <div className="group relative flex min-h-[7.75rem] flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-amber-400/60 hover:bg-amber-50/40 dark:border-slate-700/70 dark:bg-[#0b1220] dark:shadow-none dark:hover:border-amber-500/35 dark:hover:bg-slate-900/90">
      <button
        type="button"
        title={bookmarked ? "Remove from POS bookmarks" : "Bookmark for POS screen"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark();
        }}
        className={`absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none transition ${
          bookmarked
            ? "bg-amber-500 text-slate-950 shadow-sm"
            : "bg-white/90 text-slate-400 opacity-0 shadow-sm ring-1 ring-slate-200 group-hover:opacity-100 dark:bg-slate-900/90 dark:text-slate-500 dark:ring-slate-700"
        }`}
      >
        ★
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-[7.75rem] flex-1 flex-col px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45"
      >
        <p className="truncate text-center text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
          {product.categoryName ?? "General"}
        </p>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-center text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">
          {product.name}
        </p>
        <p className="mt-2 text-center text-[15px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
          {priceLabel}
          {product.isWeighed ? <span className="text-[11px] font-semibold text-amber-500/80">/kg</span> : null}
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-1.5 pt-3">
          <div className="flex flex-wrap gap-1">
            {badges.slice(0, 3).map((badge) => (
              <span
                key={badge}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {badge}
              </span>
            ))}
            <StockBadge product={product} />
          </div>
          {product.sku ? (
            <span className="max-w-[40%] truncate text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{product.sku}</span>
          ) : null}
        </div>
      </button>
    </div>
  );
}

export function StorePosPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const navigate = useNavigate();
  const terminalId = getTerminalId();
  const [search, setSearch] = useState("");
  const [browseView, setBrowseView] = useState<StorePosBrowseView>(
    () => loadStorePosBrowseView(undefined) ?? DEFAULT_STORE_POS_VIEW,
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => loadStorePosBookmarks(undefined));
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethod>(() =>
    loadStoreCashSetup(undefined).defaultPaymentMethod,
  );
  const [paymentLabel, setPaymentLabel] = useState<PosPaymentLabel>(() =>
    defaultPaymentLabelFromMethod(loadStoreCashSetup(undefined).defaultPaymentMethod),
  );
  const [quickPickOpen, setQuickPickOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("amount");
  const [discountValue, setDiscountValue] = useState(0);
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
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [qtyPromptOpen, setQtyPromptOpen] = useState(false);
  const [qtyPromptValue, setQtyPromptValue] = useState("");
  const [columnVisible, setColumnVisible] = useState(loadVisibleColumns);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [priceDiscountOpen, setPriceDiscountOpen] = useState(false);
  const [slipPreview, setSlipPreview] = useState<{ title: string; html: string } | null>(null);
  const [zoomPct, setZoomPct] = useState(loadPosZoomPct);
  const [wantToOpen, setWantToOpen] = useState(false);
  const [printAfterSale, setPrintAfterSale] = useState(true);
  const [heldPanelOpen, setHeldPanelOpen] = useState(false);
  const [cashModalType, setCashModalType] = useState<"paid_in" | "paid_out" | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const heldPanelRef = useRef<HTMLDivElement>(null);
  const discPercentRef = useRef<HTMLInputElement>(null);
  const giftCardRef = useRef<HTMLInputElement>(null);

  const adjustZoom = useCallback((delta: number) => {
    setZoomPct((prev) => {
      const next = Math.min(POS_ZOOM_MAX, Math.max(POS_ZOOM_MIN, prev + delta));
      try {
        localStorage.setItem(POS_ZOOM_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

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

  const heldSalesQuery = useQuery({
    queryKey: ["store", "sales-held", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSales(branch!.code, "Held"),
  });

  const recentSalesQuery = useQuery({
    queryKey: ["store", "sales-recent", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSales(branch!.code, "Completed"),
    refetchInterval: 8000,
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

  useEffect(() => {
    const setup = loadStoreCashSetup(branch?.code);
    setBrowseView(loadStorePosBrowseView(branch?.code) ?? DEFAULT_STORE_POS_VIEW);
    setBookmarks(loadStorePosBookmarks(branch?.code));
    setPaymentMethod(setup.defaultPaymentMethod);
    setPaymentLabel(defaultPaymentLabelFromMethod(setup.defaultPaymentMethod));
    setQuickPickOpen(false);
  }, [branch?.code]);

  const applySaleDefaults = useCallback(() => {
    const setup = loadStoreCashSetup(branch?.code);
    setPaymentMethod(setup.defaultPaymentMethod);
    setPaymentLabel(defaultPaymentLabelFromMethod(setup.defaultPaymentMethod));
    const match = findDefaultStoreCustomer(customersQuery.data ?? [], setup.defaultCustomerName);
    setCustomerId(match?.id ?? "");
    setCustomerFilter("");
  }, [branch?.code, customersQuery.data]);

  useEffect(() => {
    if (!customersQuery.data?.length) return;
    if (customerId) {
      const stillThere = customersQuery.data.some((c) => c.id === customerId);
      if (stillThere) return;
    }
    applySaleDefaults();
  }, [customersQuery.data, customerId, applySaleDefaults]);

  function setMenuBrowseView(next: StorePosBrowseView): void {
    setBrowseView(next);
    saveStorePosBrowseView(next, branch?.code);
    if (next !== "category") setCategoryFilter("all");
  }

  function handleToggleBookmark(productId: string): void {
    setBookmarks(toggleStorePosBookmark(productId, branch?.code));
  }

  const inStock = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.availableStock > 0),
    [productsQuery.data],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of inStock) if (p.categoryName) set.add(p.categoryName);
    return Array.from(set).sort();
  }, [inStock]);

  const bookmarkCount = useMemo(
    () => inStock.filter((p) => bookmarks.has(p.id)).length,
    [inStock, bookmarks],
  );

  const orderCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of recentSalesQuery.data ?? []) {
      for (const line of sale.lines ?? []) {
        map.set(line.productId, (map.get(line.productId) ?? 0) + (line.qty || 0));
      }
    }
    return map;
  }, [recentSalesQuery.data]);

  const isSearching = search.trim().length > 0;
  const showBookmarksOnly = browseView === "bookmarks" && !isSearching;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = inStock;
    if (showBookmarksOnly) {
      list = list.filter((p) => bookmarks.has(p.id));
    } else if (browseView === "category" && categoryFilter !== "all" && !q) {
      list = list.filter((p) => p.categoryName === categoryFilter);
    }
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
    return [...list].sort((a, b) => {
      const oa = orderCountByProduct.get(a.id) ?? 0;
      const ob = orderCountByProduct.get(b.id) ?? 0;
      if (ob !== oa) return ob - oa;
      return a.name.localeCompare(b.name);
    });
  }, [
    inStock,
    search,
    browseView,
    categoryFilter,
    bookmarks,
    orderCountByProduct,
    showBookmarksOnly,
  ]);

  const promotionDiscount = useMemo(
    () => estimatePromotionDiscount(cart, promotionsQuery.data ?? []),
    [cart, promotionsQuery.data],
  );

  const subtotal = cart.reduce((s, l) => s + cartLineTotal(l), 0);
  const tax = cart.reduce((s, l) => s + Math.round((cartLineTotal(l) * l.product.taxPct) / 100), 0);
  const discount =
    discountMode === "percent"
      ? Math.min(subtotal, Math.round((subtotal * Math.max(0, discountValue)) / 100))
      : Math.max(0, discountValue);
  const total = Math.max(0, subtotal + tax - discount - promotionDiscount);
  const itemCount = cart.length;
  const totalQtySold = cart.reduce((s, l) => s + (l.product.isWeighed ? 1 : l.qty), 0);
  const selectedCustomer = (customersQuery.data ?? []).find((c) => c.id === customerId);
  const selectedLine = cart.find((c) => c.product.id === selectedLineId) ?? null;
  const isCreditSale = isAccountPaymentLabel(paymentLabel);
  const paymentHint =
    paymentLabel === "Account"
      ? "Account (credit) sale — select the customer who will be billed"
      : paymentLabel === "Gift"
        ? "Gift — enter gift card number below, then Save"
        : paymentLabel === "Credit"
          ? "Credit card tender selected"
          : paymentLabel === "Debit"
            ? "Debit card tender selected"
            : paymentLabel === "Check"
              ? "Check / bank transfer selected"
              : null;

  const selectPaymentLabel = useCallback((label: PosPaymentLabel) => {
    setPaymentLabel(label);
    setPaymentMethod(paymentMethodFromPosLabel(label));
    setError(null);
    if (label === "Gift") {
      window.setTimeout(() => giftCardRef.current?.focus(), 50);
    }
    if (label === "Account") {
      window.setTimeout(() => customerInputRef.current?.focus(), 50);
    }
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    const list = customersQuery.data ?? [];
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customersQuery.data, customerFilter]);

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
    setSelectedLineId(product.id);
  }, [pendingScaleKg]);

  useBarcodeScanner((code) => {
    const exact = inStock.find((p) => productMatchesCode(p, code));
    if (exact) addToCart(exact);
    else setSearch(code);
  }, true);

  useEffect(() => {
    function runAction(action: StorePosActionId): void {
      switch (action) {
        case "none":
          return;
        case "focusSearch":
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
          return;
        case "focusCustomer":
          customerInputRef.current?.focus();
          customerInputRef.current?.select();
          return;
        case "clearSearch":
          setSearch("");
          searchInputRef.current?.focus();
          return;
        case "editQty": {
          const targetId = selectedLineId ?? cart[cart.length - 1]?.product.id ?? null;
          if (!targetId) return;
          const line = cart.find((c) => c.product.id === targetId);
          if (!line || line.product.isWeighed) return;
          setSelectedLineId(targetId);
          setQtyPromptValue(String(line.qty));
          setQtyPromptOpen(true);
          return;
        }
        case "hold":
          if (cart.length === 0) return;
          if (!ensureShiftForSale()) return;
          setCheckoutMode("hold");
          setCheckoutOpen(true);
          return;
        case "pay":
          if (cart.length === 0) return;
          if (!ensureShiftForSale()) return;
          setCheckoutMode("complete");
          setCheckoutOpen(true);
          return;
        case "print":
          if (lastSale && cart.length === 0) {
            printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", lastSale);
            return;
          }
          if (cart.length === 0) return;
          printStoreCartReceipt({
            branchName: branch?.name ?? "Store",
            branchCode: branch?.code ?? "—",
            kind: "invoice",
            cart,
            subtotal,
            tax,
            discount,
            total,
            customerName: selectedCustomer?.name,
            terminalId,
          });
          return;
        case "payIn":
          setCashModalType("paid_in");
          return;
        case "payOut":
          setCashModalType("paid_out");
          return;
        case "toggleQuickPick":
          setQuickPickOpen((v) => !v);
          return;
        case "viewBookmarks":
          setQuickPickOpen(true);
          setMenuBrowseView("bookmarks");
          return;
        case "viewAll":
          setQuickPickOpen(true);
          setMenuBrowseView("all");
          return;
        case "syncStock":
          if (!branch?.code) return;
          void syncStoreInventory(branch.code).then(() => productsQuery.refetch());
          return;
        default:
          return;
      }
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (checkoutOpen || weighProduct || qtyPromptOpen || cashModalType || editModalOpen || priceDiscountOpen) {
        return;
      }
      const hotkey = matchStorePosHotkey(e);
      if (!hotkey) return;
      const liveMap = loadStorePosActionMap(branch?.code);
      const action = liveMap[hotkey];
      if (!action || action === "none") return;
      e.preventDefault();
      runAction(action);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    branch,
    cart,
    cashModalType,
    checkoutOpen,
    discount,
    editModalOpen,
    lastSale,
    priceDiscountOpen,
    productsQuery,
    qtyPromptOpen,
    selectedCustomer?.name,
    selectedLineId,
    subtotal,
    tax,
    terminalId,
    total,
    weighProduct,
  ]);

  function ensureShiftForSale(): boolean {
    const setup = loadStoreCashSetup(branch?.code);
    if (setup.requireShiftForPos && !shiftQuery.data) {
      setError("Open a shift first (Pay In / Pay Out or Shifts), or turn off “require shift” in General Store setup.");
      return false;
    }
    return true;
  }

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
        paymentMethod: (payload.paymentMethod ?? paymentMethod ?? "Cash") as StorePaymentMethod,
        discount,
        isCredit: payload.isCredit ?? isCreditSale,
        reserveStock: false,
        status: payload.status,
        shiftId: shiftQuery.data?.id,
        terminalId,
        loyaltyPointsRedeem: payload.loyaltyPointsRedeem ?? 0,
        couponCode: couponCode || undefined,
        giftCardNumber: giftCardNumber || undefined,
        payments: payload.payments,
        heldLabel: payload.status === "Held" ? (heldLabel || `Hold ${new Date().toLocaleTimeString()}`) : undefined,
        lines: cart.map((c) => {
          const net = cartLineTotal(c);
          const effectiveUnit = c.product.isWeighed
            ? (() => {
                const grams = c.qtyGrams ?? Math.round(c.qty * 1000);
                return grams > 0 ? Math.round((net * 1000) / grams) : cartLineUnitPrice(c);
              })()
            : c.qty > 0
              ? Math.round(net / c.qty)
              : cartLineUnitPrice(c);
          const name = cartLineDisplayName(c);
          return {
            productId: c.product.id,
            qty: c.product.isWeighed ? c.qty : c.qty,
            qtyGrams: c.product.isWeighed ? c.qtyGrams : undefined,
            unitPrice: effectiveUnit,
            productName: name !== c.product.name ? name : undefined,
            priceLevel: c.unitPriceOverride != null ? undefined : (c.priceLevel ?? "regular"),
          };
        }),
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
      setDiscountValue(0);
      setCheckoutOpen(false);
      setResumingSaleId(null);
      setSelectedLineId(null);
      applySaleDefaults();
      if (sale) {
        setLastSale(sale);
        setNotice(`Invoice ${sale.invoiceNumber} — ${formatPkr(sale.total)}`);
        if (printAfterSale) {
          printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", sale);
        }
      } else {
        setNotice(
          isLocalDataMode()
            ? "Sale saved locally — open Sync and push to cloud when ready"
            : "Sale saved offline — will sync when connection returns",
        );
      }
      setError(null);
      setPrintAfterSale(true);
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
      setSelectedLineId(null);
      applySaleDefaults();
      setLastSale(sale);
      setNotice(`Resumed & completed ${sale.invoiceNumber}`);
      if (printAfterSale) {
        printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", sale);
      }
      setPrintAfterSale(true);
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

  function setLineQty(productId: string, nextQty: number): void {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId || c.product.isWeighed) return c;
          const qty = Math.max(0, Math.min(Math.round(nextQty), c.product.availableStock));
          return qty <= 0 ? null : { ...c, qty };
        })
        .filter(Boolean) as CartLine[],
    );
  }

  function setLinePrice(productId: string, price: number): void {
    setCart((prev) =>
      prev.map((c) =>
        c.product.id === productId
          ? { ...c, unitPriceOverride: Math.max(0, Math.round(price)), priceLevel: undefined }
          : c,
      ),
    );
  }

  function clearTicket(): void {
    setCart([]);
    setSelectedLineId(null);
    setDiscountValue(0);
    setCouponCode("");
    setGiftCardNumber("");
    setHeldLabel("");
    setResumingSaleId(null);
    applySaleDefaults();
    setError(null);
    setNotice("Ticket cancelled");
  }

  function applyQtyPrompt(): void {
    if (!selectedLineId) {
      setQtyPromptOpen(false);
      return;
    }
    const n = Number(qtyPromptValue);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid quantity");
      return;
    }
    setLineQty(selectedLineId, n);
    setQtyPromptOpen(false);
    setError(null);
  }

  function toggleColumn(id: PosColumnId): void {
    setColumnVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // Keep at least qty + name visible for a usable grid
      if (!next.itemName) next.itemName = true;
      if (!next.qty) next.qty = true;
      saveVisibleColumns(next);
      return next;
    });
  }

  function tryAddFromSearch(): void {
    const q = search.trim();
    if (!q) return;
    const exact = inStock.find(
      (p) => productMatchesCode(p, q) || p.sku.toLowerCase() === q.toLowerCase(),
    );
    if (exact) {
      addToCart(exact);
      return;
    }
    if (matches[0]) {
      addToCart(matches[0]);
      return;
    }
    setError(`No product found for “${q}”`);
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
    setDiscountMode("amount");
    setDiscountValue(sale.discount);
    setResumingSaleId(sale.id);
    setNotice(`Resumed ${sale.heldLabel ?? sale.invoiceNumber}`);
  }

  if (productsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading products…</p>
        </div>
      </div>
    );
  }

  if (productsQuery.isError) {
    return <div className={noticeErrorClass}>{(productsQuery.error as Error).message}</div>;
  }

  return (
    <>
    <StorePosSalesWorkbench
      zoomPct={zoomPct}
      branchLabel={`${branch?.name ?? "Store"} · ${terminalId}`}
      cashierLabel={shiftQuery.data ? `Cashier: ${shiftQuery.data.cashierName}` : "No shift open"}
      notice={notice}
      error={error}
      sideActions={[
        {
          id: "quick",
          label: "Quick Pick Items",
          active: quickPickOpen,
          onClick: () => setQuickPickOpen((v) => !v),
        },
        {
          id: "add",
          label: "Add New Item",
          onClick: () => {
            setQuickPickOpen(false);
            searchInputRef.current?.focus();
          },
        },
        {
          id: "disc",
          label: "Give Discount",
          onClick: () => {
            if (selectedLineId) {
              setPriceDiscountOpen(true);
              return;
            }
            setDiscountMode("percent");
            discPercentRef.current?.focus();
            setNotice("Enter bill discount % or Rs below, or select a line for item discount");
          },
        },
        {
          id: "return",
          label: "Accept Return",
          onClick: () => navigate("/pops/store/returns"),
        },
        {
          id: "cashier",
          label: "Cashier/Associate",
          onClick: () =>
            setNotice(
              shiftQuery.data
                ? `Cashier: ${shiftQuery.data.cashierName}`
                : "No open shift — open one under Shifts & cash",
            ),
        },
        {
          id: "ship",
          label: "Ship Items",
          onClick: () => setNotice("Ship Items — complete the sale first, then mark delivery from Sales orders"),
        },
        {
          id: "msg",
          label: "Show Messages",
          badge: (heldSalesQuery.data ?? []).length,
          onClick: () => {
            setHeldPanelOpen(true);
            window.setTimeout(() => heldPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
            const n = (heldSalesQuery.data ?? []).length;
            setNotice(n ? `${n} held ticket(s) — resume from the list below` : "No held tickets");
          },
        },
      ]}
      wantToOpen={wantToOpen}
      onToggleWantTo={() => setWantToOpen((v) => !v)}
      wantToItems={[
        { label: "Put on Hold (F9)", onClick: () => { if (cart.length && ensureShiftForSale()) { setCheckoutMode("hold"); setCheckoutOpen(true); } } },
        { label: "Pay / Complete (F10)", onClick: () => { if (cart.length && ensureShiftForSale()) { setPrintAfterSale(true); setCheckoutMode("complete"); setCheckoutOpen(true); } } },
        { label: "Quick Pick Items", onClick: () => setQuickPickOpen(true) },
        { label: "Pay In", onClick: () => setCashModalType("paid_in") },
        { label: "Pay Out", onClick: () => setCashModalType("paid_out") },
        { label: "Sync stock", onClick: () => void syncStoreInventory(branch!.code).then(() => productsQuery.refetch()) },
        { label: "Customize columns", onClick: () => setCustomizeOpen((v) => !v) },
        { label: "Cancel ticket", onClick: clearTicket },
      ]}
      search={search}
      onSearchChange={setSearch}
      onSearchEnter={tryAddFromSearch}
      searchInputRef={searchInputRef}
      searchSuggestions={
        search.trim() && matches.length > 0 ? (
          <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {matches.slice(0, 10).map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-sky-50 dark:hover:bg-slate-800"
                onClick={() => addToCart(p)}
              >
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {formatPkr(p.salePrice > 0 && p.salePrice < p.sellingPrice ? p.salePrice : p.sellingPrice)}
                </span>
              </button>
            ))}
          </div>
        ) : null
      }
      customerFilter={customerFilter}
      onCustomerFilterChange={setCustomerFilter}
      customerId={customerId}
      onCustomerIdChange={setCustomerId}
      customerInputRef={customerInputRef}
      customerOptions={filteredCustomers.map((c) => ({
        id: c.id,
        label: `${c.name}${c.phone ? ` · ${c.phone}` : ""}`,
      }))}
      isCreditSale={isCreditSale}
      defaultCustomerHint={selectedCustomer?.name ?? loadStoreCashSetup(branch?.code).defaultCustomerName}
      columnsPanel={
        customizeOpen ? (
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Visible columns</p>
            <div className="flex flex-wrap gap-1.5">
              {POS_COLUMNS.map((col) => (
                <label key={col.id} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-700">
                  <input type="checkbox" checked={columnVisible[col.id]} onChange={() => toggleColumn(col.id)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        ) : null
      }
      receiptTable={
        <StoreSalesReceiptTable
          cart={cart}
          selectedLineId={selectedLineId}
          columnVisible={columnVisible}
          onSelect={setSelectedLineId}
          onQtyDelta={updateQty}
          onQtySet={setLineQty}
          onPriceSet={setLinePrice}
          onEdit={() => setEditModalOpen(true)}
          onPriceDiscount={() => setPriceDiscountOpen(true)}
          onRemove={(id) => {
            setCart((prev) => prev.filter((c) => c.product.id !== id));
            if (selectedLineId === id) setSelectedLineId(null);
          }}
        />
      }
      quickPickOpen={quickPickOpen}
      onCloseQuickPick={() => setQuickPickOpen(false)}
      quickPickDrawer={
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="text-sm font-bold">Quick Pick Items</p>
            <button type="button" className="text-xs font-semibold text-sky-700" onClick={() => setQuickPickOpen(false)}>
              Close
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2 dark:border-slate-800">
            <button type="button" onClick={() => setMenuBrowseView("bookmarks")} className={`rounded px-2 py-1 text-[11px] font-bold ${browseView === "bookmarks" ? "bg-amber-500 text-slate-950" : "bg-slate-100 dark:bg-slate-800"}`}>★ Bookmarks</button>
            <button type="button" onClick={() => setMenuBrowseView("all")} className={`rounded px-2 py-1 text-[11px] font-bold ${browseView === "all" ? "bg-amber-500 text-slate-950" : "bg-slate-100 dark:bg-slate-800"}`}>All</button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategoryFilter(cat); setMenuBrowseView("category"); }}
                className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold ${browseView === "category" && categoryFilter === cat ? "bg-amber-500 text-slate-950" : "bg-slate-100 dark:bg-slate-800"}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-2">
              {matches.map((p) => (
                <StorePosProductCard
                  key={p.id}
                  product={p}
                  bookmarked={bookmarks.has(p.id)}
                  onAdd={() => addToCart(p)}
                  onToggleBookmark={() => handleToggleBookmark(p.id)}
                />
              ))}
            </div>
            {matches.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">No products</p> : null}
          </div>
        </div>
      }
      itemCount={itemCount}
      totalQtySold={totalQtySold}
      subtotal={subtotal}
      tax={tax}
      discount={discount}
      promotionDiscount={promotionDiscount}
      total={total}
      paymentLabel={paymentLabel}
      onPaymentLabel={selectPaymentLabel}
      paymentHint={paymentHint}
      discountControls={
        <div className="flex flex-wrap gap-2">
          <input
            ref={discPercentRef}
            type="number"
            min={0}
            placeholder="Disc %"
            value={discountMode === "percent" ? discountValue || "" : ""}
            onChange={(e) => { setDiscountMode("percent"); setDiscountValue(Math.max(0, Number(e.target.value) || 0)); }}
            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="number"
            min={0}
            placeholder="Disc Rs"
            value={discountMode === "amount" ? discountValue || "" : ""}
            onChange={(e) => { setDiscountMode("amount"); setDiscountValue(Math.max(0, Number(e.target.value) || 0)); }}
            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="text"
            placeholder="Coupon"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            ref={giftCardRef}
            type="text"
            placeholder="Gift card"
            value={giftCardNumber}
            onChange={(e) => setGiftCardNumber(e.target.value)}
            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      }
      onHold={() => {
        if (!ensureShiftForSale()) return;
        setCheckoutMode("hold");
        setCheckoutOpen(true);
      }}
      onCancel={clearTicket}
      onSaveOnly={() => {
        if (!ensureShiftForSale()) return;
        if (isCreditSale && !customerId) {
          setError("Select a customer for Account (credit) sale.");
          customerInputRef.current?.focus();
          return;
        }
        if (paymentLabel === "Gift" && !giftCardNumber.trim()) {
          setError("Enter gift card number, or choose another payment.");
          giftCardRef.current?.focus();
          return;
        }
        setPrintAfterSale(false);
        setCheckoutMode("complete");
        setCheckoutOpen(true);
      }}
      onSavePrint={() => {
        if (!ensureShiftForSale()) return;
        if (isCreditSale && !customerId) {
          setError("Select a customer for Account (credit) sale.");
          customerInputRef.current?.focus();
          return;
        }
        if (paymentLabel === "Gift" && !giftCardNumber.trim()) {
          setError("Enter gift card number, or choose another payment.");
          giftCardRef.current?.focus();
          return;
        }
        setPrintAfterSale(true);
        setCheckoutMode("complete");
        setCheckoutOpen(true);
      }}
      canCheckout={cart.length > 0}
      paying={saleMutation.isPending || completeHeldMutation.isPending}
      toolbarExtra={
        <>
          {offlineCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700">{offlineCount} offline</span>
          ) : null}
          <button type="button" className="rounded px-1.5 py-0.5 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800" disabled={zoomPct <= POS_ZOOM_MIN} onClick={() => adjustZoom(-POS_ZOOM_STEP)}>−</button>
          <span className="tabular-nums font-semibold">{zoomPct}%</span>
          <button type="button" className="rounded px-1.5 py-0.5 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800" disabled={zoomPct >= POS_ZOOM_MAX} onClick={() => adjustZoom(POS_ZOOM_STEP)}>+</button>
          <Link to="/pops/store/setup" className="font-semibold text-sky-700 hover:underline">Setup</Link>
          {(heldSalesQuery.data ?? []).length > 0 ? (
            <button
              type="button"
              className="font-semibold text-amber-700 hover:underline"
              onClick={() => setNotice(`${(heldSalesQuery.data ?? []).length} held — use Show Messages or resume below`)}
            >
              {(heldSalesQuery.data ?? []).length} held
            </button>
          ) : null}
        </>
      }
    />

    <div ref={heldPanelRef} className="border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
      <StoreLatestSalesPanel
        held={heldSalesQuery.data ?? []}
        recent={(recentSalesQuery.data ?? []).slice(0, 24)}
        isLoading={heldSalesQuery.isLoading || recentSalesQuery.isLoading}
        onResume={(sale) => {
          resumeHeldSale(sale);
          setHeldPanelOpen(false);
        }}
        onReprint={(sale) => printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", sale)}
      />
    </div>

      {editModalOpen && selectedLine ? (
        <StoreItemPropertiesModal
          line={selectedLine}
          onClose={() => setEditModalOpen(false)}
          onSave={(patch) => {
            setCart((prev) =>
              prev.map((c) =>
                c.product.id === selectedLine.product.id
                  ? {
                      ...c,
                      displayName: patch.displayName,
                      displayDescription: patch.displayDescription,
                      unitPriceOverride: patch.unitPrice,
                      priceLevel: undefined,
                    }
                  : c,
              ),
            );
            setEditModalOpen(false);
          }}
        />
      ) : null}

      {priceDiscountOpen && selectedLine ? (
        <StorePriceDiscountModal
          line={selectedLine}
          onClose={() => setPriceDiscountOpen(false)}
          onSave={(patch) => {
            setCart((prev) =>
              prev.map((c) => {
                if (c.product.id !== selectedLine.product.id) return c;
                if (c.product.isWeighed) {
                  const grams = Math.round(patch.qty * 1000);
                  return {
                    ...c,
                    qty: patch.qty,
                    qtyGrams: grams,
                    unitPriceOverride: patch.unitPrice,
                    priceLevel: undefined,
                    lineDiscountAmount: patch.lineDiscountAmount,
                    lineDiscountPct: patch.lineDiscountPct,
                    discountName: patch.discountName || undefined,
                  };
                }
                return {
                  ...c,
                  qty: Math.min(patch.qty, c.product.availableStock),
                  unitPriceOverride: patch.unitPrice,
                  priceLevel: undefined,
                  lineDiscountAmount: patch.lineDiscountAmount,
                  lineDiscountPct: patch.lineDiscountPct,
                  discountName: patch.discountName || undefined,
                };
              }),
            );
            setPriceDiscountOpen(false);
          }}
        />
      ) : null}

      {qtyPromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Enter quantity (F6)</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Press Enter to apply</p>
            <input
              autoFocus
              type="number"
              min={1}
              value={qtyPromptValue}
              onChange={(e) => setQtyPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyQtyPrompt();
                }
                if (e.key === "Escape") setQtyPromptOpen(false);
              }}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQtyPromptOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyQtyPrompt}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {slipPreview ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{slipPreview.title}</h3>
              <button
                type="button"
                onClick={() => setSlipPreview(null)}
                className="rounded px-2 text-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="store-receipt-preview min-h-0 flex-1 overflow-auto bg-white p-2 text-slate-900">
              <iframe
                title={slipPreview.title}
                srcDoc={slipPreview.html}
                className="mx-auto block min-h-[420px] w-full max-w-[320px] border-0 bg-white"
                sandbox="allow-same-origin"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSlipPreview(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cart.length === 0 && lastSale) {
                    printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", lastSale);
                    return;
                  }
                  printStoreCartReceipt({
                    branchName: branch?.name ?? "Store",
                    branchCode: branch?.code ?? "—",
                    kind: slipPreview.title.toLowerCase().includes("order") ? "order" : "invoice",
                    cart,
                    subtotal,
                    tax,
                    discount,
                    total,
                    customerName: selectedCustomer?.name,
                    terminalId,
                  });
                }}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Print again
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          initialPaymentMethod={paymentMethod}
          initialIsCredit={isCreditSale}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={(payload) => {
            const method = payload.paymentMethod || paymentMethod;
            const credit = payload.isCredit || isCreditSale;
            if (resumingSaleId && checkoutMode === "complete") {
              completeHeldMutation.mutate({
                saleId: resumingSaleId,
                payments: payload.payments.length
                  ? payload.payments
                  : [{ method, amount: total }],
                loyaltyPointsRedeem: payload.loyaltyPointsRedeem,
                isCredit: credit,
                paymentMethod: method,
              });
            } else {
              saleMutation.mutate({
                status: checkoutMode === "hold" ? "Held" : "Completed",
                payments: payload.payments.length
                  ? payload.payments
                  : checkoutMode === "complete"
                    ? [{ method, amount: total }]
                    : undefined,
                loyaltyPointsRedeem: payload.loyaltyPointsRedeem,
                isCredit: credit,
                paymentMethod: method,
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

      {cashModalType ? (
        <StorePayInOutModal
          type={cashModalType}
          onClose={() => setCashModalType(null)}
          onDone={(message) => setNotice(message)}
        />
      ) : null}
    </>
  );
}
