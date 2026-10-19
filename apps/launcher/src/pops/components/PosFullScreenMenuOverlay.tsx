import { menuItemDisplayPrice, type MenuItem as ApiMenuItem } from "@platform/contracts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { SafeMenuImage } from "../ui/SafeMenuImage";
import {
  cartLineNet,
  cartLinePrintLabel,
  itemQtyInCart,
  resolvePosSellableVariants,
  type PosCartLine,
} from "../lib/posCart";
import { POS_SHORTCUTS } from "../lib/posShortcuts";
import {
  canEditPosRecentOrder,
  canPayPosRecentOrder,
  filterPosRecentOrdersByMode,
  filterPosRecentOrdersWithinDays,
  formatRecentOrderTime,
  posRecentOrderTotal,
  sumPosRecentOrdersItemQty,
  type PosRecentOrder,
  type PosRecentOrderModeFilter,
} from "../lib/recentOrders";
import { formatPosStationDisplay, type PosOrderMode } from "../lib/posOrderMode";
import { DEFAULT_POS_SETTINGS } from "../lib/posSettings";
import {
  PosCustomerDetailsPanel,
  type PosKnownCustomer,
  type PosRiderOption,
} from "./PosCustomerDetailsPanel";

type Category = { id: string; name: string; imageUrl?: string | null };

type OrdersListMode = "open" | "closed";

type CustomerPanelProps = {
  open: boolean;
  summary: string;
  customer: string;
  phone: string;
  address: string;
  riderId: string;
  deliveryChargePkr: number;
  customerPickerOpen: boolean;
  filteredCustomers: PosKnownCustomer[];
  customersLoading?: boolean;
  customersError?: string | null;
  riders: PosRiderOption[];
  ridersLoading?: boolean;
  ridersError?: boolean;
  panelRef?: RefObject<HTMLDivElement>;
  customerInputRef?: RefObject<HTMLInputElement>;
  phoneInputRef?: RefObject<HTMLInputElement>;
  customerFieldRef?: RefObject<HTMLDivElement>;
  onToggle: () => void;
  onCustomerChange: (value: string) => void;
  onCustomerFocus: () => void;
  onCloseCustomerPicker: () => void;
  onSelectCustomer: (customer: PosKnownCustomer) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onRiderChange: (riderId: string) => void;
  onChargeChange: (amount: number) => void;
  onApply: () => void;
  applyLabel: string;
  showAddress?: boolean;
  knownCustomers?: PosKnownCustomer[];
};

type Props = {
  categories: Category[];
  items: ApiMenuItem[];
  cartLines: PosCartLine[];
  selectedCartKey: string | null;
  totalQty: number;
  subtotal: number;
  discount: number;
  discountPct: number;
  service: number;
  tax: number;
  total: number;
  ticketServicePct: number;
  taxPct: number;
  showTaxRow: boolean;
  deliveryCharge: number;
  showDeliveryCharge: boolean;
  orderRef: string;
  modeLabel: string;
  editingLabel?: string | null;
  orderBusy?: boolean;
  payBusy?: boolean;
  showTicketDiscount: boolean;
  autoDiscountEnabled: boolean;
  autoDiscountPct: number;
  autoDiscountAmount: number;
  discountEditedAs: "pct" | "amount";
  discountPctInput: number;
  discountAmountInput: number;
  ticketTaxFree: boolean;
  ticketServiceFree: boolean;
  showTaxServiceFreeToggles: boolean;
  /** Active order channel for top-bar highlight. */
  orderMode: PosOrderMode;
  /** Which order types are enabled in Settings (defaults: all three). */
  orderModesEnabled?: {
    dineIn?: boolean;
    takeaway?: boolean;
    delivery?: boolean;
  };
  tableSelected?: boolean;
  /** Current seating label when dine-in (e.g. "Hall · Table 5"). */
  tableLabel?: string | null;
  initialViewMode: "category" | "all";
  /** Ticket / cart column side (Settings). */
  ticketPanelSide?: "left" | "right";
  /** Open (unpaid) orders for the Open Orders drawer. */
  openOrders?: PosRecentOrder[];
  /** Closed / paid orders for the Closed Orders drawer. */
  closedOrders?: PosRecentOrder[];
  ordersLoading?: boolean;
  /** Customer / rider panel for takeaway & delivery (and dine-in). */
  showCustomerPanel?: boolean;
  customerPanel?: CustomerPanelProps;
  /** Optional external ref so parent (F9) can focus this search field. */
  searchInputRef?: RefObject<HTMLInputElement | null>;
  priceLabel?: (item: ApiMenuItem) => { display: number; original?: number };
  onSelectCartLine: (key: string) => void;
  onRequestSetQty: (lineKey: string, qty: number) => void;
  onRequestRemoveLine: (lineKey: string) => void;
  onAddItem: (item: ApiMenuItem) => void;
  onDecrementItem: (item: ApiMenuItem) => void;
  onOpenDiscount: () => void;
  onToggleTaxFree: (value: boolean) => void;
  onToggleServiceFree: (value: boolean) => void;
  onPlaceOrder: () => void;
  onPrintBill: () => void;
  /** Silent cash complete — no payment modal. */
  onQuickBill: () => void;
  /** Silent cash complete for the current ticket. */
  onCloseOrder: () => void;
  onReprintKot: () => void;
  onPickOpenOrder: (order: PosRecentOrder) => void;
  /** Pay an open takeaway / delivery / dine-in order from the list. */
  onPayOpenOrder?: (order: PosRecentOrder) => void;
  /** Print receipt / slip for an open or closed order in the drawer. */
  onPrintOrder?: (order: PosRecentOrder) => void;
  onOpenCustomer?: () => void;
  onNewOrder: () => void;
  onSelectTables: () => void;
  /** Move an open dine-in order to another table (merge if destination booked). */
  onTableTransfer: () => void;
  /** Split bill payments / merge guest checks. */
  onMergeSplit: () => void;
  onTakeaway: () => void;
  onDineIn: () => void;
  onDelivery: () => void;
  onTvDisplay: () => void;
  onDone: () => void;
  onClose: () => void;
};

function modeToOrdersFilter(mode: PosOrderMode): PosRecentOrderModeFilter {
  if (mode === "takeaway") return "Takeaway";
  if (mode === "delivery") return "Delivery";
  if (mode === "dine-in") return "Dine-in";
  if (mode === "online") return "Online Orders";
  if (mode === "foodpanda") return "Foodpanda Orders";
  if (mode === "staff-food") return "Staff Food";
  return "all";
}

function channelBadgeClass(channel: string): string {
  if (channel === "Takeaway") return "bg-sky-500/20 text-sky-300 ring-sky-500/30";
  if (channel === "Delivery") return "bg-violet-500/20 text-violet-300 ring-violet-500/30";
  if (channel === "Dine-in") return "bg-amber-500/20 text-amber-300 ring-amber-500/30";
  return "bg-slate-500/20 text-slate-300 ring-slate-500/30";
}

export function PosFullScreenMenuOverlay({
  categories,
  items,
  cartLines,
  selectedCartKey,
  totalQty,
  subtotal,
  discount,
  discountPct,
  service,
  tax,
  total,
  ticketServicePct,
  taxPct,
  showTaxRow,
  deliveryCharge,
  showDeliveryCharge,
  orderRef,
  modeLabel,
  editingLabel,
  orderBusy = false,
  payBusy = false,
  showTicketDiscount,
  autoDiscountEnabled,
  autoDiscountPct,
  autoDiscountAmount,
  discountEditedAs,
  discountPctInput,
  discountAmountInput,
  ticketTaxFree,
  ticketServiceFree,
  showTaxServiceFreeToggles,
  orderMode,
  orderModesEnabled,
  tableSelected = false,
  tableLabel = null,
  initialViewMode,
  ticketPanelSide = "right",
  openOrders = [],
  closedOrders = [],
  ordersLoading = false,
  showCustomerPanel = false,
  customerPanel,
  searchInputRef: searchInputRefProp,
  priceLabel,
  onSelectCartLine,
  onRequestSetQty,
  onRequestRemoveLine,
  onAddItem,
  onDecrementItem,
  onOpenDiscount,
  onToggleTaxFree,
  onToggleServiceFree,
  onPlaceOrder,
  onPrintBill,
  onQuickBill,
  onCloseOrder,
  onReprintKot,
  onPickOpenOrder,
  onPayOpenOrder,
  onPrintOrder,
  onOpenCustomer,
  onNewOrder,
  onSelectTables,
  onTableTransfer,
  onMergeSplit,
  onTakeaway,
  onDineIn,
  onDelivery,
  onTvDisplay,
  onDone,
  onClose,
}: Props): JSX.Element {
  const [viewMode, setViewMode] = useState<"category" | "all">(initialViewMode);
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(0);
  const [ordersListMode, setOrdersListMode] = useState<OrdersListMode | null>(null);
  const [ordersChannelFilter, setOrdersChannelFilter] = useState<PosRecentOrderModeFilter>("all");
  const localSearchInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = searchInputRefProp ?? localSearchInputRef;
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  function focusSearch(): void {
    const el = searchInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }

  function clearSearch(): void {
    setSearch("");
    setSearchDropdownOpen(false);
    setSearchHighlight(0);
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    // Open ready to type / scan — same habit as main POS (F9).
    const t = window.setTimeout(() => focusSearch(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only focus
  }, []);

  useEffect(() => {
    /** Escape only — F2–F12 / P stay on PosPage so full-screen matches simple POS shortcuts. */
    function onKey(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      if (ordersListMode) {
        e.preventDefault();
        setOrdersListMode(null);
        return;
      }
      if (searchDropdownOpen) {
        e.preventDefault();
        setSearchDropdownOpen(false);
        return;
      }
      if (search.trim()) {
        e.preventDefault();
        clearSearch();
        focusSearch();
        return;
      }
      e.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, ordersListMode, search, searchDropdownOpen, searchInputRef]);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    if (!categoryId && categories[0]?.id) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  /** Prefer the active channel when opening Open Orders so takeaway/delivery are easy to find. */
  useEffect(() => {
    if (ordersListMode === "open") {
      setOrdersChannelFilter(modeToOrdersFilter(orderMode));
    } else if (ordersListMode === "closed") {
      setOrdersChannelFilter("all");
    }
  }, [ordersListMode, orderMode]);

  const activeCategoryId = categoryId ?? categories[0]?.id ?? null;
  const q = search.trim().toLowerCase();
  const isSearching = q.length > 0;

  const filtered = useMemo(() => {
    const list = items.filter((m) => {
      if (!m.isActive) return false;
      const catOk =
        viewMode === "all" || isSearching || !activeCategoryId || m.categoryId === activeCategoryId;
      if (!catOk) return false;
      if (!isSearching) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.barcode?.toLowerCase().includes(q) ?? false) ||
        m.variants.some((v) => v.label.toLowerCase().includes(q)) ||
        m.variants.some((v) => v.barcode?.toLowerCase().includes(q)) ||
        (categoryById.get(m.categoryId)?.toLowerCase().includes(q) ?? false)
      );
    });
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [items, viewMode, activeCategoryId, q, isSearching, categoryById]);

  /** Same as simple POS: top matches under the search field. */
  const searchDropdownItems = useMemo(() => filtered.slice(0, 8), [filtered]);

  useEffect(() => {
    setSearchHighlight(0);
  }, [q]);

  useEffect(() => {
    if (!searchDropdownOpen) return;
    function onClickOutside(e: MouseEvent): void {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [searchDropdownOpen]);

  function selectSearchDropdownItem(item: ApiMenuItem): void {
    onAddItem(item);
    clearSearch();
    window.setTimeout(() => focusSearch(), 0);
  }

  function onSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Escape") {
      if (searchDropdownOpen) {
        e.preventDefault();
        setSearchDropdownOpen(false);
        return;
      }
      if (search.trim()) {
        e.preventDefault();
        clearSearch();
      }
      return;
    }
    if (!isSearching || searchDropdownItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchDropdownOpen(true);
      setSearchHighlight((i) => Math.min(searchDropdownItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchDropdownOpen(true);
      setSearchHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (!searchDropdownOpen) {
        setSearchDropdownOpen(true);
        return;
      }
      e.preventDefault();
      const item = searchDropdownItems[searchHighlight];
      if (item) selectSearchDropdownItem(item);
    }
  }

  const paidOrdersLast2Days = useMemo(
    () => filterPosRecentOrdersWithinDays(closedOrders, 2),
    [closedOrders],
  );

  const listOrders = useMemo(() => {
    if (ordersListMode === "closed") return paidOrdersLast2Days;
    if (ordersChannelFilter === "Paid") return paidOrdersLast2Days;
    return filterPosRecentOrdersByMode(openOrders, ordersChannelFilter);
  }, [ordersListMode, paidOrdersLast2Days, openOrders, ordersChannelFilter]);

  const openOrderCounts = useMemo(() => {
    const all = openOrders.length;
    const dineIn = filterPosRecentOrdersByMode(openOrders, "Dine-in").length;
    const takeaway = filterPosRecentOrdersByMode(openOrders, "Takeaway").length;
    const delivery = filterPosRecentOrdersByMode(openOrders, "Delivery").length;
    const paidQty = sumPosRecentOrdersItemQty(paidOrdersLast2Days);
    return { all, dineIn, takeaway, delivery, paidQty };
  }, [openOrders, paidOrdersLast2Days]);

  function openOrdersDrawer(next: OrdersListMode): void {
    setOrdersListMode((m) => (m === next ? null : next));
  }

  const actionBtn =
    "rounded px-2 py-2 text-[11px] font-semibold leading-tight transition disabled:cursor-not-allowed disabled:opacity-40";
  const primaryBtn = `${actionBtn} bg-amber-400 text-slate-950 hover:bg-amber-300`;
  const payBtn = `${actionBtn} bg-emerald-500 text-white hover:bg-emerald-400`;
  const closeBtn = `${actionBtn} bg-rose-500/90 text-white hover:bg-rose-400`;
  const secondaryBtn = `${actionBtn} border border-slate-600 bg-slate-800 text-white hover:bg-slate-700`;

  const topQuickBtn = (active: boolean) =>
    `shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition ${
      active
        ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/25"
        : "border border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
    }`;

  const panelOnLeft = ticketPanelSide === "left";

  const orderTypeSegBtn = (active: boolean) =>
    `min-w-0 flex-1 rounded px-1.5 py-1.5 text-xs font-extrabold uppercase tracking-wide leading-tight transition ${
      active
        ? "bg-amber-400 text-slate-950 shadow-sm"
        : "text-slate-200 hover:bg-slate-800 hover:text-white"
    }`;

  const orderTypeSwitcher = (
    <div
      className="inline-flex w-full rounded-md border border-amber-500/40 bg-slate-950/80 p-0.5"
      role="group"
      aria-label="Order type"
    >
      {orderModesEnabled?.dineIn !== false ? (
        <button
          type="button"
          className={orderTypeSegBtn(orderMode === "dine-in")}
          onClick={onDineIn}
          title="Dine-in"
          aria-pressed={orderMode === "dine-in"}
        >
          Dine-in
        </button>
      ) : null}
      {orderModesEnabled?.takeaway !== false ? (
        <button
          type="button"
          className={orderTypeSegBtn(orderMode === "takeaway")}
          onClick={onTakeaway}
          title="Takeaway"
          aria-pressed={orderMode === "takeaway"}
        >
          Takeaway
        </button>
      ) : null}
      {orderModesEnabled?.delivery !== false ? (
        <button
          type="button"
          className={orderTypeSegBtn(orderMode === "delivery")}
          onClick={onDelivery}
          title="Delivery"
          aria-pressed={orderMode === "delivery"}
        >
          Delivery
        </button>
      ) : null}
    </div>
  );

  const ticketAside = (
    <aside
      className={`flex min-h-[36vh] w-full shrink-0 flex-col overflow-hidden bg-slate-900 lg:min-h-0 lg:w-[17.5rem] xl:w-[18.5rem] ${
        panelOnLeft
          ? "border-b border-slate-800 lg:border-b-0 lg:border-r"
          : "border-t border-slate-800 lg:border-l lg:border-t-0"
      }`}
    >
      <div
        className={`flex shrink-0 flex-col border-b border-slate-800 ${
          editingLabel ? "max-h-[28vh] lg:max-h-[24vh]" : "max-h-[42vh] lg:max-h-[38vh]"
        }`}
      >
        <div className="shrink-0 px-2 pt-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
                {editingLabel ? "Editing" : "Current order"}
              </div>
              {editingLabel ? (
                <div className="truncate text-xs font-semibold text-white">{editingLabel}</div>
              ) : null}
            </div>
            <span className="max-w-[7.5rem] truncate rounded bg-amber-400/15 px-1 py-px font-mono text-[8px] font-semibold tracking-wide text-amber-300 ring-1 ring-amber-400/30" title={orderRef}>
              {orderRef}
            </span>
          </div>
          {/* Always visible — dine-in / takeaway / delivery stay on screen for every mode */}
          <div className="mt-1.5">{orderTypeSwitcher}</div>
          {orderMode === "dine-in" ? (
            <button
              type="button"
              onClick={onSelectTables}
              className={`mt-1 flex w-full items-center justify-between rounded border px-2 py-1 text-left text-[10px] transition ${
                tableSelected
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                  : "border-slate-600 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
              title="Select or change dine-in table"
            >
              <span className="truncate">{tableLabel?.trim() || "Select table"}</span>
              <span className="shrink-0 text-slate-500" aria-hidden>
                ›
              </span>
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-1.5">
          {showCustomerPanel && customerPanel ? (
            <PosCustomerDetailsPanel tone="fullscreen" mode={orderMode} {...customerPanel} />
          ) : null}
          <p className="mt-0.5 text-[9px] text-slate-500">
            {totalQty} item{totalQty === 1 ? "" : "s"}
            {modeLabel ? ` · ${modeLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {cartLines.length === 0 ? (
          <div className="flex min-h-[4rem] flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950/40 px-3 py-3 text-center">
            <p className="text-[11px] font-medium text-slate-400">No items yet</p>
            <p className="mt-0.5 text-[10px] text-slate-600">Tap + on menu items</p>
          </div>
        ) : (
          <>
            <div className="mb-0.5 grid grid-cols-[minmax(0,1fr)_2.6rem_3.8rem_2.8rem_1.1rem] items-center gap-0.5 px-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Name</span>
              <span className="text-right">Price</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            <ul className="flex flex-col gap-0.5">
              {cartLines.map((line) => {
                const selected = selectedCartKey === line.key;
                return (
                  <li
                    key={line.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectCartLine(line.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectCartLine(line.key);
                      }
                    }}
                    className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_2.6rem_3.8rem_2.8rem_1.1rem] items-center gap-0.5 rounded border px-1 py-0.5 transition ${
                      line.isComplimentary
                        ? "border-amber-500/30 bg-amber-500/10"
                        : selected
                          ? "border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/40"
                          : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
                    }`}
                  >
                    <div
                      className="min-w-0 truncate text-[10px] font-medium text-white"
                      title={cartLinePrintLabel(line)}
                    >
                      {cartLinePrintLabel(line)}
                    </div>
                    <div className="text-right text-[9px] tabular-nums text-slate-400">
                      {line.isComplimentary ? "—" : line.unitPrice.toLocaleString()}
                    </div>
                    {line.isComplimentary ? (
                      <span className="justify-self-center text-[8px] font-semibold text-amber-300">
                        FREE
                      </span>
                    ) : (
                      <div
                        className="flex items-center justify-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex h-5 w-5 items-center justify-center rounded text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          onClick={() => onRequestSetQty(line.key, line.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-[0.9rem] text-center text-[10px] font-semibold tabular-nums text-white">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          className="flex h-5 w-5 items-center justify-center rounded text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          onClick={() => onRequestSetQty(line.key, line.qty + 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <div className="text-right text-[9px] font-semibold tabular-nums text-slate-200">
                      {line.isComplimentary ? "0" : cartLineNet(line).toLocaleString()}
                    </div>
                    {!line.isComplimentary ? (
                      <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-rose-400 hover:bg-rose-500/15"
                        title="Remove item"
                        aria-label="Remove item"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestRemoveLine(line.key);
                        }}
                      >
                        ×
                      </button>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950/80 p-1.5">
        {autoDiscountEnabled && autoDiscountAmount > 0 ? (
          <div className="mb-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 text-[9px] text-emerald-300">
            Auto discount {autoDiscountPct}% · − Rs {autoDiscountAmount.toLocaleString()}
          </div>
        ) : showTicketDiscount ? (
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Discount
              </span>
              {discount > 0 ? (
                <p className="text-[10px] font-semibold tabular-nums text-emerald-400">
                  {discountEditedAs === "pct" ? `${discountPctInput || discountPct}% · ` : ""}
                  − Rs {(discountEditedAs === "amount" ? discountAmountInput : discount).toLocaleString()}
                </p>
              ) : (
                <p className="text-[9px] text-slate-500">None</p>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenDiscount}
              className="shrink-0 rounded bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-amber-300"
            >
              Disc
            </button>
          </div>
        ) : null}

        {showTaxServiceFreeToggles ? (
          <div className="mb-1 flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-300">
              <input
                type="checkbox"
                checked={ticketTaxFree}
                onChange={(e) => onToggleTaxFree(e.target.checked)}
                className="rounded border-slate-600 text-amber-500 focus:ring-amber-400"
              />
              TAX free
            </label>
            <label className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-300">
              <input
                type="checkbox"
                checked={ticketServiceFree}
                onChange={(e) => onToggleServiceFree(e.target.checked)}
                className="rounded border-slate-600 text-amber-500 focus:ring-amber-400"
              />
              Service free
            </label>
          </div>
        ) : null}

        <div className="mb-1.5 space-y-0.5 text-[10px] text-slate-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums text-slate-200">{subtotal.toLocaleString()}</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-emerald-400">
              <span>Discount</span>
              <span className="tabular-nums">− {discount.toLocaleString()}</span>
            </div>
          ) : null}
          {ticketServicePct > 0 ? (
            <div className="flex justify-between">
              <span>Service {ticketServicePct}%</span>
              <span className="tabular-nums text-slate-200">{service.toLocaleString()}</span>
            </div>
          ) : null}
          {showTaxRow ? (
            <div className="flex justify-between">
              <span>Tax {taxPct}%</span>
              <span className="tabular-nums text-slate-200">{tax.toLocaleString()}</span>
            </div>
          ) : null}
          {showDeliveryCharge && deliveryCharge > 0 ? (
            <div className="flex justify-between">
              <span>Delivery</span>
              <span className="tabular-nums text-slate-200">{deliveryCharge.toLocaleString()}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-800 pt-1">
            <span className="text-xs font-semibold text-white">Total</span>
            <span className="text-sm font-bold tabular-nums text-amber-300">
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className={primaryBtn}
            onClick={onNewOrder}
            title="Start a new order — pick Dine-in / Takeaway / Delivery"
          >
            New Order
          </button>
          <button
            type="button"
            className={primaryBtn}
            disabled={cartLines.length === 0 || orderBusy}
            onClick={onPlaceOrder}
            title="Place order + print KOT — stay on this screen"
          >
            {orderBusy ? "…" : editingLabel ? "Update order" : "Place Order"}
          </button>
          <button
            type="button"
            className={payBtn}
            disabled={cartLines.length === 0 || payBusy}
            onClick={onQuickBill}
            title="Close order as cash — no payment screen"
          >
            {payBusy ? "…" : "Quick Bill"}
          </button>
          <button
            type="button"
            className={closeBtn}
            disabled={cartLines.length === 0 || payBusy}
            onClick={onCloseOrder}
            title="Close this open order (cash)"
          >
            {payBusy ? "…" : "Close Order"}
          </button>
          <button
            type="button"
            className={secondaryBtn}
            disabled={cartLines.length === 0 || payBusy}
            onClick={onPrintBill}
          >
            Print Bill
          </button>
          <button
            type="button"
            className={secondaryBtn}
            disabled={cartLines.length === 0 || orderBusy}
            onClick={onReprintKot}
          >
            Reprint KOT
          </button>
          <button
            type="button"
            className={`${secondaryBtn} ${ordersListMode === "open" ? "ring-1 ring-amber-400" : ""}`}
            onClick={() => openOrdersDrawer("open")}
            title="Open dine-in, takeaway & delivery orders"
          >
            Open Orders{openOrderCounts.all > 0 ? ` (${openOrderCounts.all})` : ""}
          </button>
          <button
            type="button"
            className={`${secondaryBtn} ${ordersListMode === "closed" ? "ring-1 ring-amber-400" : ""}`}
            onClick={() => openOrdersDrawer("closed")}
            title="Paid / closed orders — last 2 days (badge = item qty)"
          >
            Paid
          </button>
        </div>
      </div>
    </aside>
  );

  const menuColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {viewMode === "category" && categories.length > 0 ? (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c, index) => {
              const active = activeCategoryId === c.id;
              const count = items.filter((m) => m.isActive && m.categoryId === c.id).length;
              const letterFallback = (
                <span
                  className={`absolute inset-0 flex items-center justify-center bg-slate-800 text-lg font-bold ${
                    active ? "text-amber-300" : "text-slate-500"
                  }`}
                >
                  {(c.name.trim().charAt(0) || "?").toUpperCase()}
                </span>
              );
              return (
                <button
                  key={c.id}
                  type="button"
                  title={`${c.name} (${count})`}
                  onClick={() => setCategoryId(c.id)}
                  className={`group relative h-14 min-w-[5.5rem] max-w-[7.5rem] flex-1 overflow-hidden rounded-md text-center transition ${
                    active
                      ? "ring-2 ring-amber-400 shadow-sm shadow-amber-400/30"
                      : "ring-1 ring-slate-600 hover:ring-amber-400/50"
                  }`}
                >
                  <SafeMenuImage
                    imageUrl={c.imageUrl}
                    alt=""
                    fill
                    fallback={letterFallback}
                  />
                  <span className="absolute inset-x-0 bottom-0 z-[1] line-clamp-2 w-full bg-slate-950/90 px-1 py-1 text-[10px] font-bold leading-tight text-white">
                    {index + 1}. {c.name}
                    <span className="ml-0.5 font-semibold text-amber-200">({count})</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-1 text-[9px] text-slate-500">
          {filtered.length === 0
            ? isSearching
              ? `No match for “${search.trim()}”.`
              : "No items to show."
            : isSearching
              ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}`
              : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap content-start gap-2">
          {filtered.map((item) => {
            const hasPicker = resolvePosSellableVariants(item).length > 1;
            const priced = priceLabel?.(item);
            const display = priced?.display ?? menuItemDisplayPrice(item);
            const original = priced?.original;
            const qty = itemQtyInCart(item.id, cartLines);
            const itemFallback = (
              <div className="absolute inset-0 bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
            );
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                title={item.name}
                onClick={() => onAddItem(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAddItem(item);
                  }
                }}
                className="group relative h-36 w-[7.5rem] shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-amber-500/50 hover:ring-1 hover:ring-amber-400/40 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-amber-400/70"
              >
                <SafeMenuImage
                  imageUrl={item.imageUrl}
                  alt=""
                  fill
                  fallback={itemFallback}
                />
                {/* Hover-only qty controls — above fixed footer */}
                <div className="pointer-events-none absolute inset-x-0 bottom-[4.25rem] z-[2] flex h-8 items-center justify-between gap-0.5 px-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={qty <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDecrementItem(item);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-sm font-bold text-slate-800 shadow disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-500 dark:bg-slate-900 dark:text-white"
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] rounded bg-white/95 px-1 text-center text-[11px] font-bold tabular-nums text-slate-900 shadow dark:bg-slate-950/90 dark:text-white">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddItem(item);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber-300 bg-amber-400 text-sm font-bold text-slate-950 shadow"
                    aria-label={`Add one ${item.name}`}
                  >
                    +
                  </button>
                </div>
                {/* Name + price — taller so long names wrap instead of cutting off */}
                <div className="absolute inset-x-0 bottom-0 z-[1] flex min-h-[4.25rem] flex-col justify-end bg-white/95 px-1.5 pb-1.5 pt-1 dark:bg-slate-950/95">
                  <span
                    className="line-clamp-3 text-[12px] font-bold leading-snug text-slate-900 dark:text-white"
                    title={item.name}
                  >
                    {item.featured ? <span className="mr-0.5 text-amber-600 dark:text-amber-300">★</span> : null}
                    {item.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] font-bold text-orange-600 dark:text-orange-400">
                    {hasPicker ? "From " : ""}
                    {display.toLocaleString()}
                    {original != null && original !== display ? (
                      <span className="ml-1 font-normal text-slate-400 line-through dark:text-slate-300">
                        {original.toLocaleString()}
                      </span>
                    ) : null}
                  </span>
                </div>
                {qty > 0 ? (
                  <span className="absolute right-0.5 top-0.5 z-[1] rounded bg-amber-400 px-1 py-px text-[9px] font-bold text-slate-950 group-hover:opacity-0">
                    {qty}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-slate-950 text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-fullscreen-menu-title"
    >
      {/* Always pinned — must stay visible for dine-in / takeaway / delivery */}
      <div className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-950 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <h2 id="pos-fullscreen-menu-title" className="text-xs font-semibold text-white">
            Full screen POS
          </h2>
          <p className="text-[9px] text-slate-400">
            {orderMode === "dine-in" && tableSelected && tableLabel?.trim()
              ? `${tableLabel.trim()} · same window: menu → Place Order → Pay`
              : orderMode === "takeaway"
                ? "Takeaway · customer → menu → Place Order → Pay · Open Orders to manage"
                : orderMode === "delivery"
                  ? "Delivery · customer/rider → menu → Place Order → Pay · Open Orders to manage"
                  : "Pick order type · run dine-in, takeaway & delivery in this window"}
          </p>
        </div>

        <div
          className="inline-flex shrink-0 rounded-md border border-amber-500/40 bg-slate-900 p-0.5 shadow-sm shadow-amber-500/10"
          role="group"
          aria-label="Order type"
        >
          {(orderModesEnabled?.dineIn !== false) ? (
            <button
              type="button"
              className={`rounded px-3.5 py-1.5 text-sm font-extrabold uppercase tracking-wide transition ${
                orderMode === "dine-in"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-100 hover:bg-slate-800 hover:text-white"
              }`}
              onClick={onDineIn}
              title="Dine-in — select table, order, pay here"
              aria-pressed={orderMode === "dine-in"}
            >
              Dine-in
            </button>
          ) : null}
          {(orderModesEnabled?.takeaway !== false) ? (
            <button
              type="button"
              className={`rounded px-3.5 py-1.5 text-sm font-extrabold uppercase tracking-wide transition ${
                orderMode === "takeaway"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-100 hover:bg-slate-800 hover:text-white"
              }`}
              onClick={onTakeaway}
              title="Takeaway — order and pay here"
              aria-pressed={orderMode === "takeaway"}
            >
              Takeaway
            </button>
          ) : null}
          {(orderModesEnabled?.delivery !== false) ? (
            <button
              type="button"
              className={`rounded px-3.5 py-1.5 text-sm font-extrabold uppercase tracking-wide transition ${
                orderMode === "delivery"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-100 hover:bg-slate-800 hover:text-white"
              }`}
              onClick={onDelivery}
              title="Delivery — order and pay here"
              aria-pressed={orderMode === "delivery"}
            >
              Delivery
            </button>
          ) : null}
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="toolbar"
          aria-label="POS shortcuts"
        >
          {showCustomerPanel && onOpenCustomer ? (
            <button
              type="button"
              className={topQuickBtn(Boolean(customerPanel?.open))}
              onClick={onOpenCustomer}
              title={
                orderMode === "delivery"
                  ? "Customer, address & rider for this delivery"
                  : orderMode === "takeaway"
                    ? "Customer details for takeaway"
                    : "Customer details"
              }
            >
              Customer
            </button>
          ) : null}
          {orderMode === "dine-in" ? (
            <button
              type="button"
              className={topQuickBtn(tableSelected)}
              onClick={onSelectTables}
              title={
                tableSelected && tableLabel?.trim()
                  ? `Change table (${tableLabel.trim()})`
                  : "Select dine-in table"
              }
            >
              {tableSelected && tableLabel?.trim() ? tableLabel.trim() : "Select Table"}
            </button>
          ) : null}
          {orderMode === "dine-in" ? (
            <button
              type="button"
              className={topQuickBtn(false)}
              onClick={onTableTransfer}
              title="Move dine-in order to another table (merge if occupied)"
            >
              Table transfer
            </button>
          ) : null}
          <button
            type="button"
            className={topQuickBtn(false)}
            onClick={onMergeSplit}
            title="Split bill or merge guest checks"
          >
            Merge / split
          </button>
          <button
            type="button"
            className={topQuickBtn(false)}
            onClick={onTvDisplay}
            title="Open kitchen / TV order display"
          >
            TV
          </button>
        </div>

        <div className="inline-flex rounded border border-slate-600 bg-slate-800 p-0.5" role="group">
          <button
            type="button"
            onClick={() => setViewMode("category")}
            className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
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
            className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
              viewMode === "all"
                ? "bg-amber-400 text-slate-950"
                : "text-white hover:bg-slate-700"
            }`}
          >
            All items
          </button>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/25"
        >
          Back to ticket
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
        >
          Close
        </button>
      </div>

      {/* Always-visible search row — dropdown matches simple POS */}
      <div className="relative z-40 shrink-0 border-b border-slate-800 bg-slate-900 px-2.5 py-1.5">
        <div ref={searchContainerRef} className="relative w-full max-w-2xl">
          <label className="relative flex w-full items-center">
            <span className="sr-only">Search menu item ({POS_SHORTCUTS.search.key})</span>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder={`Search item by name or barcode… (${POS_SHORTCUTS.search.key})`}
              autoComplete="off"
              enterKeyHint="search"
              className="w-full rounded-md border border-amber-500/50 bg-slate-950 px-3 py-2 pr-14 text-sm font-semibold text-white placeholder:text-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
            />
            {search.trim() ? (
              <button
                type="button"
                className="absolute right-2 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  clearSearch();
                  focusSearch();
                }}
                title="Clear search"
              >
                Clear
              </button>
            ) : null}
          </label>
          {searchDropdownOpen && isSearching && searchDropdownItems.length > 0 ? (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-[min(22rem,50vh)] w-full overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-xl shadow-black/50">
              {searchDropdownItems.map((item, index) => {
                const priced = priceLabel?.(item);
                const price = priced?.display ?? menuItemDisplayPrice(item);
                const hasPicker = resolvePosSellableVariants(item).length > 1;
                const highlighted = index === searchHighlight;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSearchHighlight(index)}
                    onClick={() => selectSearchDropdownItem(item)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                      highlighted
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate font-medium">{item.name}</span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        highlighted ? "" : "text-amber-300"
                      }`}
                    >
                      {hasPicker ? "From " : ""}
                      {price.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {panelOnLeft ? (
          <>
            {ticketAside}
            {menuColumn}
          </>
        ) : (
          <>
            {menuColumn}
            {ticketAside}
          </>
        )}

        {ordersListMode ? (
          <div
            className={`absolute inset-0 z-10 flex bg-slate-950/70 ${panelOnLeft ? "flex-row-reverse" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={ordersListMode === "open" ? "Open orders" : "Closed orders"}
          >
            <button
              type="button"
              className="min-w-0 flex-1 cursor-default"
              aria-label="Dismiss orders list"
              onClick={() => setOrdersListMode(null)}
            />
            <div
              className={`flex h-full w-full max-w-md flex-col border-slate-700 bg-slate-900 shadow-2xl ${
                panelOnLeft ? "border-r" : "border-l"
              }`}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {ordersListMode === "open" ? "Open Orders" : "Paid"}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {ordersListMode === "open"
                      ? "Dine-in, takeaway, delivery & Paid — edit, pay or print"
                      : "Paid / closed — last 2 days only · badge shows item qty"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrdersListMode(null)}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
              {ordersListMode === "open" ? (
                <div
                  className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-2 py-1.5"
                  role="tablist"
                  aria-label="Filter by order type"
                >
                  {(
                    [
                      { id: "all" as const, label: "All", count: openOrderCounts.all },
                      ...(orderModesEnabled?.dineIn !== false
                        ? [{ id: "Dine-in" as const, label: "Dine-in", count: openOrderCounts.dineIn }]
                        : []),
                      ...(orderModesEnabled?.takeaway !== false
                        ? [
                            {
                              id: "Takeaway" as const,
                              label: "Takeaway",
                              count: openOrderCounts.takeaway,
                            },
                          ]
                        : []),
                      ...(orderModesEnabled?.delivery !== false
                        ? [
                            {
                              id: "Delivery" as const,
                              label: "Delivery",
                              count: openOrderCounts.delivery,
                            },
                          ]
                        : []),
                      {
                        id: "Paid" as const,
                        label: "Paid",
                        count: 0,
                        hideCount: true,
                      },
                    ] as {
                      id: PosRecentOrderModeFilter;
                      label: string;
                      count: number;
                      hideCount?: boolean;
                    }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={ordersChannelFilter === tab.id}
                      onClick={() => setOrdersChannelFilter(tab.id)}
                      className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold transition ${
                        ordersChannelFilter === tab.id
                          ? "bg-amber-400 text-slate-950"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {tab.label}
                      {!tab.hideCount && tab.count > 0 ? ` (${tab.count})` : ""}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {ordersLoading ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-500">Loading orders…</p>
                ) : listOrders.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-500">
                    {ordersListMode === "closed" || ordersChannelFilter === "Paid"
                      ? "No paid orders in the last 2 days."
                      : ordersChannelFilter === "all"
                        ? "No open orders."
                        : `No open ${String(ordersChannelFilter).toLowerCase()} orders.`}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {listOrders.map((order) => {
                      const amount = posRecentOrderTotal(order, DEFAULT_POS_SETTINGS);
                      const listingPaid =
                        ordersListMode === "closed" || ordersChannelFilter === "Paid";
                      const canEdit =
                        !listingPaid &&
                        ordersListMode === "open" &&
                        canEditPosRecentOrder(order);
                      const canPay =
                        !listingPaid &&
                        ordersListMode === "open" &&
                        Boolean(onPayOpenOrder) &&
                        canPayPosRecentOrder(order);
                      const station = formatPosStationDisplay(
                        order.stationLabel || order.orderMode,
                        order.orderMode,
                      );
                      return (
                        <li key={order.id}>
                          <div
                            className={`overflow-hidden rounded-md border px-2.5 py-2 ${
                              ordersListMode === "open"
                                ? "border-slate-600 bg-slate-800"
                                : "border-slate-700 bg-slate-950/60"
                            }`}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span className="max-w-full truncate font-mono text-[10px] font-semibold text-amber-300" title={order.ref}>
                                    {order.ref}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${channelBadgeClass(order.orderMode)}`}
                                  >
                                    {order.orderMode}
                                  </span>
                                </div>
                                <div className="truncate text-[11px] text-slate-300" title={station}>
                                  {station}
                                </div>
                                <div
                                  className="mt-0.5 line-clamp-2 break-words text-[10px] text-slate-500"
                                  title={order.summary}
                                >
                                  {order.summary}
                                </div>
                              </div>
                              <div className="w-[4.5rem] shrink-0 text-right">
                                <div className="truncate text-[10px] font-semibold text-slate-400">
                                  {order.statusLabel}
                                </div>
                                {amount != null ? (
                                  <div className="truncate text-xs font-bold tabular-nums text-white">
                                    {amount.toLocaleString()}
                                  </div>
                                ) : null}
                                <div className="truncate text-[9px] text-slate-500">
                                  {formatRecentOrderTime(order.createdAt)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                              {ordersListMode === "open" && !listingPaid ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => {
                                      onPickOpenOrder(order);
                                      setOrdersListMode(null);
                                    }}
                                    className="min-w-0 flex-1 rounded border border-slate-500 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:border-amber-400/50 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Edit
                                  </button>
                                  {onPayOpenOrder ? (
                                    <button
                                      type="button"
                                      disabled={!canPay || payBusy}
                                      onClick={() => {
                                        onPayOpenOrder(order);
                                        setOrdersListMode(null);
                                      }}
                                      className="min-w-0 flex-1 rounded bg-emerald-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Pay
                                    </button>
                                  ) : null}
                                </>
                              ) : null}
                              {onPrintOrder ? (
                                <button
                                  type="button"
                                  onClick={() => onPrintOrder(order)}
                                  className="min-w-0 flex-1 rounded border border-amber-400/40 bg-amber-400/15 px-2 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/25"
                                >
                                  Print
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
