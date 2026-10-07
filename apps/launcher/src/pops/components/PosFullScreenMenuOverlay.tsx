import { menuItemDisplayPrice, type MenuItem as ApiMenuItem } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";
import {
  cartLineNet,
  cartLinePrintLabel,
  itemQtyInCart,
  resolvePosSellableVariants,
  type PosCartLine,
} from "../lib/posCart";
import {
  formatRecentOrderTime,
  posRecentOrderTotal,
  type PosRecentOrder,
} from "../lib/recentOrders";
import { DEFAULT_POS_SETTINGS } from "../lib/posSettings";

type Category = { id: string; name: string; imageUrl?: string | null };

type OrdersListMode = "open" | "closed";

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
  orderMode: "dine-in" | "takeaway" | "delivery" | "online" | "foodpanda" | "staff-food";
  tableSelected?: boolean;
  initialViewMode: "category" | "all";
  /** Ticket / cart column side (Settings). */
  ticketPanelSide?: "left" | "right";
  /** Open (unpaid) orders for the Open Orders drawer. */
  openOrders?: PosRecentOrder[];
  /** Closed / paid orders for the Closed Orders drawer. */
  closedOrders?: PosRecentOrder[];
  ordersLoading?: boolean;
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
  onNewOrder: () => void;
  onSelectTables: () => void;
  onTakeaway: () => void;
  onDineIn: () => void;
  onDelivery: () => void;
  onTvDisplay: () => void;
  onDone: () => void;
  onClose: () => void;
};

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
  tableSelected = false,
  initialViewMode,
  ticketPanelSide = "right",
  openOrders = [],
  closedOrders = [],
  ordersLoading = false,
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
  onNewOrder,
  onSelectTables,
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
  const [ordersListMode, setOrdersListMode] = useState<OrdersListMode | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        if (ordersListMode) {
          setOrdersListMode(null);
          return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, ordersListMode]);

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

  const listOrders = ordersListMode === "closed" ? closedOrders : openOrders;

  const actionBtn =
    "rounded px-1.5 py-1.5 text-[10px] font-semibold leading-tight transition disabled:cursor-not-allowed disabled:opacity-40";
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

  const ticketAside = (
    <aside
      className={`flex min-h-[36vh] w-full shrink-0 flex-col bg-slate-900 lg:min-h-0 lg:w-[20rem] xl:w-[22rem] ${
        panelOnLeft
          ? "border-b border-slate-800 lg:order-first lg:border-b-0 lg:border-r"
          : "border-t border-slate-800 lg:border-l lg:border-t-0"
      }`}
    >
      <div className="shrink-0 border-b border-slate-800 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
              {editingLabel ? "Editing" : "Current order"}
            </div>
            <div className="truncate text-xs font-semibold text-white">
              {editingLabel ?? modeLabel}
            </div>
          </div>
          <span className="rounded bg-amber-400/15 px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-amber-300 ring-1 ring-amber-400/30">
            {orderRef}
          </span>
        </div>
        <p className="mt-0.5 text-[9px] text-slate-500">
          {totalQty} item{totalQty === 1 ? "" : "s"}
        </p>
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
                    <div className="min-w-0 truncate text-[10px] font-medium text-white">
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

        <div className="grid grid-cols-4 gap-1">
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
            className={secondaryBtn}
            disabled={cartLines.length === 0 || payBusy}
            onClick={onPrintBill}
          >
            Print Bill
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
            disabled={cartLines.length === 0 || orderBusy}
            onClick={onReprintKot}
          >
            Reprint KOT
          </button>
          <button
            type="button"
            className={`${secondaryBtn} ${ordersListMode === "open" ? "ring-1 ring-amber-400" : ""}`}
            onClick={() => setOrdersListMode((m) => (m === "open" ? null : "open"))}
          >
            Open Orders
          </button>
          <button
            type="button"
            className={`${secondaryBtn} col-span-2 ${ordersListMode === "closed" ? "ring-1 ring-amber-400" : ""}`}
            onClick={() => setOrdersListMode((m) => (m === "closed" ? null : "closed"))}
          >
            Closed Orders
          </button>
        </div>
      </div>
    </aside>
  );

  const menuColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {viewMode === "category" && categories.length > 0 ? (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-2 py-1.5">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11">
            {categories.map((c, index) => {
              const active = activeCategoryId === c.id;
              const img = resolveMenuImageUrl(c.imageUrl);
              const count = items.filter((m) => m.isActive && m.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-md px-1.5 py-1.5 text-center transition ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30"
                      : "bg-slate-800 text-white ring-1 ring-slate-600 hover:bg-slate-700"
                  }`}
                >
                  {img ? (
                    <img src={img} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold ${
                        active ? "bg-slate-950/15" : "bg-slate-700 text-amber-300"
                      }`}
                    >
                      {(c.name.trim().charAt(0) || "?").toUpperCase()}
                    </span>
                  )}
                  <span className="line-clamp-2 w-full text-[9px] font-semibold leading-tight">
                    {index + 1}. {c.name}
                  </span>
                  <span className="text-[8px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-1 text-[9px] text-slate-500">
          {filtered.length === 0
            ? "No items to show."
            : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                className="flex flex-col rounded-md border border-slate-600 bg-slate-800 p-1.5 transition hover:border-amber-400/60"
              >
                {img ? (
                  <img src={img} alt="" className="mb-1 h-12 w-full rounded object-cover" />
                ) : (
                  <div className="mb-1 flex h-12 items-center justify-center rounded bg-slate-700 text-[9px] font-semibold text-slate-300">
                    {item.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-white">
                  {item.featured ? <span className="mr-0.5 text-amber-400">★</span> : null}
                  {item.name}
                </span>
                <span className="mt-0.5 text-[10px] font-semibold text-amber-300">
                  {hasPicker ? "From " : ""}
                  {display.toLocaleString()}
                  {original != null && original !== display ? (
                    <span className="ml-1 font-normal text-slate-500 line-through">
                      {original.toLocaleString()}
                    </span>
                  ) : null}
                </span>
                <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
                  <button
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => onDecrementItem(item)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-900 text-sm font-semibold text-white transition hover:border-amber-400 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <span className="min-w-[1.75rem] text-center text-xs font-bold tabular-nums text-white">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddItem(item)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber-400/50 bg-amber-400/15 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/30"
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
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col bg-slate-950 text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-fullscreen-menu-title"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-800 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <h2 id="pos-fullscreen-menu-title" className="text-xs font-semibold text-white">
            Full screen POS
          </h2>
          <p className="text-[9px] text-slate-400">
            Dine-in / Takeaway / Delivery · Place Order · Quick Bill closes cash
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="toolbar"
          aria-label="Order type shortcuts"
        >
          <button type="button" className={topQuickBtn(false)} onClick={onNewOrder} title="Start a new blank order">
            New Orders
          </button>
          <button
            type="button"
            className={topQuickBtn(orderMode === "dine-in" && tableSelected)}
            onClick={onSelectTables}
            title="Select dine-in table"
          >
            Select Tables
          </button>
          <button
            type="button"
            className={topQuickBtn(orderMode === "dine-in")}
            onClick={onDineIn}
            title="Switch to Dine-in"
          >
            Dining
          </button>
          <button
            type="button"
            className={topQuickBtn(orderMode === "takeaway")}
            onClick={onTakeaway}
            title="Switch to Takeaway"
          >
            Take Away
          </button>
          <button
            type="button"
            className={topQuickBtn(orderMode === "delivery")}
            onClick={onDelivery}
            title="Switch to Delivery"
          >
            Delivery
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item…"
          className="w-32 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-white placeholder:text-slate-400 outline-none focus:border-amber-400 sm:w-40"
        />
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
                    {ordersListMode === "open" ? "Open Orders" : "Closed Orders"}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {ordersListMode === "open"
                      ? "Not closed yet — tap to load into this window"
                      : "Paid / closed bills"}
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
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {ordersLoading ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-500">Loading orders…</p>
                ) : listOrders.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-500">
                    {ordersListMode === "open" ? "No open orders." : "No closed orders."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {listOrders.map((order) => {
                      const amount = posRecentOrderTotal(order, DEFAULT_POS_SETTINGS);
                      return (
                        <li key={order.id}>
                          <button
                            type="button"
                            disabled={ordersListMode === "closed"}
                            onClick={() => {
                              if (ordersListMode !== "open") return;
                              onPickOpenOrder(order);
                              setOrdersListMode(null);
                            }}
                            className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                              ordersListMode === "open"
                                ? "border-slate-600 bg-slate-800 hover:border-amber-400/50 hover:bg-slate-700"
                                : "cursor-default border-slate-700 bg-slate-950/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-mono text-xs font-bold text-amber-300">
                                  {order.ref}
                                </div>
                                <div className="truncate text-[11px] text-slate-300">
                                  {order.stationLabel || order.orderMode}
                                </div>
                                <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                                  {order.summary}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[10px] font-semibold text-slate-400">
                                  {order.statusLabel}
                                </div>
                                {amount != null ? (
                                  <div className="text-xs font-bold tabular-nums text-white">
                                    {amount.toLocaleString()}
                                  </div>
                                ) : null}
                                <div className="text-[9px] text-slate-500">
                                  {formatRecentOrderTime(order.createdAt)}
                                </div>
                              </div>
                            </div>
                          </button>
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
