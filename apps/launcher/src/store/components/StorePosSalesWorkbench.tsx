import type { ReactNode } from "react";
import type { StorePaymentMethod } from "@platform/contracts";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

export const POS_FOOTER_PAYMENT_LABELS = ["Cash", "Credit", "Debit", "Check", "Gift", "Account"] as const;
export type PosPaymentLabel = (typeof POS_FOOTER_PAYMENT_LABELS)[number];

/**
 * Receipt payment chips → API payment method.
 * Credit/Debit = card · Account = customer credit (udhaar) · Gift = wallet/gift.
 */
export function paymentMethodFromPosLabel(label: string): StorePaymentMethod {
  switch (label) {
    case "Cash":
      return "Cash";
    case "Credit":
    case "Debit":
      return "Card";
    case "Check":
      return "Bank Transfer";
    case "Gift":
      return "Mobile Wallet";
    case "Account":
      return "Credit";
    default:
      return "Cash";
  }
}

export function isAccountPaymentLabel(label: PosPaymentLabel): boolean {
  return label === "Account";
}

export function isPaymentLabelSelected(
  label: PosPaymentLabel,
  selectedLabel: PosPaymentLabel,
): boolean {
  return label === selectedLabel;
}

export function defaultPaymentLabelFromMethod(method: StorePaymentMethod): PosPaymentLabel {
  switch (method) {
    case "Cash":
      return "Cash";
    case "Card":
      return "Debit";
    case "Bank Transfer":
      return "Check";
    case "Mobile Wallet":
      return "Gift";
    case "Credit":
      return "Account";
    default:
      return "Cash";
  }
}

const sideBtn =
  "relative min-w-[7.5rem] rounded-xl px-2.5 py-2.5 text-left text-[11px] font-semibold leading-snug shadow-sm transition md:min-w-0 md:w-full";
const sideBtnIdle =
  "border border-slate-200 bg-white text-slate-700 hover:border-amber-400/60 hover:bg-amber-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-amber-500/40 dark:hover:bg-slate-800";
const sideBtnActive =
  "border border-amber-500/50 bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/40";

const payBtn =
  "min-w-[4.75rem] rounded-lg px-3 py-2 text-xs font-bold shadow-sm transition disabled:opacity-40";
const payBtnIdle =
  "border border-slate-200 bg-white text-slate-700 hover:border-sky-400/50 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const payBtnActive = "border border-sky-600 bg-sky-600 text-white shadow-sky-600/20";

const actionBtn =
  "rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40";

type SideAction = {
  id: string;
  label: string;
  badge?: string | number;
  onClick: () => void;
  active?: boolean;
};

type Props = {
  zoomPct: number;
  branchLabel: string;
  cashierLabel: string;
  notice?: string | null;
  error?: string | null;
  sideActions: SideAction[];
  wantToOpen: boolean;
  onToggleWantTo: () => void;
  wantToItems: { label: string; onClick: () => void }[];
  search: string;
  onSearchChange: (v: string) => void;
  onSearchEnter: () => void;
  searchSuggestions?: ReactNode;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  customerFilter: string;
  onCustomerFilterChange: (v: string) => void;
  customerId: string;
  onCustomerIdChange: (v: string) => void;
  customerOptions: { id: string; label: string }[];
  customerInputRef?: React.RefObject<HTMLInputElement | null>;
  isCreditSale: boolean;
  defaultCustomerHint: string;
  columnsPanel?: ReactNode;
  receiptTable: ReactNode;
  quickPickDrawer?: ReactNode;
  quickPickOpen: boolean;
  onCloseQuickPick?: () => void;
  itemCount: number;
  totalQtySold: number;
  subtotal: number;
  tax: number;
  discount: number;
  promotionDiscount: number;
  total: number;
  paymentLabel: PosPaymentLabel;
  onPaymentLabel: (label: PosPaymentLabel) => void;
  paymentHint?: string | null;
  discountControls?: ReactNode;
  onHold: () => void;
  onCancel: () => void;
  onSaveOnly: () => void;
  onSavePrint: () => void;
  canCheckout: boolean;
  paying?: boolean;
  toolbarExtra?: ReactNode;
};

/**
 * Sales Receipt workbench — colors match General Store (amber / sky / slate).
 */
export function StorePosSalesWorkbench(props: Props): JSX.Element {
  const {
    zoomPct,
    branchLabel,
    cashierLabel,
    notice,
    error,
    sideActions,
    wantToOpen,
    onToggleWantTo,
    wantToItems,
    search,
    onSearchChange,
    onSearchEnter,
    searchSuggestions,
    searchInputRef,
    customerFilter,
    onCustomerFilterChange,
    customerId,
    onCustomerIdChange,
    customerOptions,
    customerInputRef,
    isCreditSale,
    defaultCustomerHint,
    columnsPanel,
    receiptTable,
    quickPickDrawer,
    quickPickOpen,
    onCloseQuickPick,
    itemCount,
    totalQtySold,
    subtotal,
    tax,
    discount,
    promotionDiscount,
    total,
    paymentLabel,
    onPaymentLabel,
    paymentHint,
    discountControls,
    onHold,
    onCancel,
    onSaveOnly,
    onSavePrint,
    canCheckout,
    paying,
    toolbarExtra,
  } = props;

  return (
    <div
      className="flex min-h-[calc(100dvh-1rem)] flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      style={{ zoom: zoomPct / 100 }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Sales Receipt
        </span>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{branchLabel}</span>
        <span className="hidden text-slate-300 sm:inline">·</span>
        <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">{cashierLabel}</span>
        <span className="rounded-md bg-sky-600/10 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300">
          Pay: {paymentLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">{toolbarExtra}</div>
      </div>

      {notice ? <div className={`mx-2 mt-2 ${noticeSuccessClass}`}>{notice}</div> : null}
      {error ? <div className={`mx-2 mt-2 ${noticeErrorClass}`}>{error}</div> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
        <aside className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50/90 p-2 dark:border-slate-800 dark:bg-slate-900/40 md:w-40 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
          {sideActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={a.onClick}
              className={`${sideBtn} ${a.active ? sideBtnActive : sideBtnIdle}`}
            >
              {a.label}
              {a.badge != null && Number(a.badge) > 0 ? (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 text-[9px] font-extrabold text-slate-950">
                  {a.badge}
                </span>
              ) : null}
            </button>
          ))}
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={onToggleWantTo}
                  className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500"
                >
                  I Want to…
                  <span aria-hidden>▾</span>
                </button>
                {wantToOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-20 cursor-default"
                      aria-label="Close menu"
                      onClick={onToggleWantTo}
                    />
                    <div className="absolute left-0 top-full z-30 mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      {wantToItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => {
                            item.onClick();
                            onToggleWantTo();
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="relative min-w-0 flex-1">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Scan or enter item information
                </label>
                <input
                  ref={searchInputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  data-scan-target="true"
                  autoFocus
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSearchEnter();
                    }
                    if (e.key === "Escape") onSearchChange("");
                  }}
                  placeholder="Barcode / SKU / name — Enter to add"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                />
                {searchSuggestions}
              </div>

              <div className="w-full lg:w-64">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Customer name or phone
                </label>
                <input
                  ref={customerInputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={customerFilter}
                  onChange={(e) => onCustomerFilterChange(e.target.value)}
                  placeholder="Search customer…"
                  className="mb-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <select
                  value={customerId}
                  onChange={(e) => onCustomerIdChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Walk-in</option>
                  {customerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {isCreditSale
                    ? "Credit / Account — pick the credit customer"
                    : `Cash default · ${defaultCustomerHint}`}
                </p>
              </div>
            </div>
            {columnsPanel}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2 md:p-3">{receiptTable}</div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {POS_FOOTER_PAYMENT_LABELS.map((label) => {
                const show = isPaymentLabelSelected(label, paymentLabel);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onPaymentLabel(label)}
                    className={`${payBtn} ${show ? payBtnActive : payBtnIdle}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {paymentHint ? (
              <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">{paymentHint}</p>
            ) : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">{discountControls}</div>

              <div className="ml-auto min-w-[14rem] space-y-0.5 text-right text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-end gap-8">
                  <span>No. of Items Sold</span>
                  <span className="w-24 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {itemCount}
                  </span>
                </div>
                <div className="flex justify-end gap-8">
                  <span>Total Qty Sold</span>
                  <span className="w-24 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {totalQtySold}
                  </span>
                </div>
                <div className="flex justify-end gap-8">
                  <span>SubTotal</span>
                  <span className="w-24 tabular-nums text-slate-900 dark:text-slate-100">
                    {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-end gap-8 text-emerald-700 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="w-24 tabular-nums">
                      −{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : null}
                {promotionDiscount > 0 ? (
                  <div className="flex justify-end gap-8 text-emerald-700 dark:text-emerald-400">
                    <span>Promotions</span>
                    <span className="w-24 tabular-nums">
                      −{promotionDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-end gap-8">
                  <span>Tax</span>
                  <span className="w-24 tabular-nums text-slate-900 dark:text-slate-100">
                    {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-end gap-8 border-t border-slate-200 pt-1 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                  <span>Total</span>
                  <span className="w-24 tabular-nums text-amber-600 dark:text-amber-400">
                    {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="pt-1 text-lg font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                  Amount Due {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={!canCheckout}
                onClick={onHold}
                className={`${actionBtn} border-0 bg-amber-500 text-slate-950 hover:bg-amber-400`}
              >
                Put on Hold
              </button>
              <button
                type="button"
                disabled={!canCheckout}
                onClick={onCancel}
                className={`${actionBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canCheckout || paying}
                onClick={onSaveOnly}
                className={`${actionBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
              >
                Save Only
              </button>
              <button
                type="button"
                disabled={!canCheckout || paying}
                onClick={onSavePrint}
                className={`${actionBtn} border-0 bg-emerald-600 text-white hover:bg-emerald-500`}
              >
                Save & Print
              </button>
            </div>
          </div>

          {quickPickOpen && quickPickDrawer ? (
            <>
              <button
                type="button"
                className="absolute inset-0 z-20 bg-slate-900/30 dark:bg-black/50"
                aria-label="Close Quick Pick"
                onClick={onCloseQuickPick}
              />
              <div className="absolute inset-y-0 left-0 z-30 flex w-full max-w-md flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:max-w-lg">
                {quickPickDrawer}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
