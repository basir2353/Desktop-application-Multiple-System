import { useRef, type RefObject } from "react";
import { fieldInputClass } from "../lib/themeClasses";
import type { PosOrderMode } from "../lib/posOrderMode";

export type PosKnownCustomer = {
  name: string;
  phone: string;
  address: string;
};

export type PosRiderOption = {
  id: string;
  name: string;
  phone?: string | null;
};

type Tone = "ticket" | "fullscreen";

type Props = {
  tone?: Tone;
  mode: PosOrderMode;
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
};

const TICKET_INPUT = `${fieldInputClass} w-full min-w-0 text-xs py-1.5`;
const FULL_INPUT =
  "w-full min-w-0 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none placeholder:text-slate-500 focus:border-amber-400";

/**
 * Shared customer / delivery details panel for split POS ticket and full-screen POS.
 * Takeaway + delivery (and other channel modes) are managed here without leaving the register.
 */
export function PosCustomerDetailsPanel({
  tone = "ticket",
  mode,
  open,
  summary,
  customer,
  phone,
  address,
  riderId,
  deliveryChargePkr,
  customerPickerOpen,
  filteredCustomers,
  customersLoading = false,
  customersError = null,
  riders,
  ridersLoading = false,
  ridersError = false,
  panelRef,
  customerInputRef,
  phoneInputRef,
  customerFieldRef,
  onToggle,
  onCustomerChange,
  onCustomerFocus,
  onCloseCustomerPicker,
  onSelectCustomer,
  onPhoneChange,
  onAddressChange,
  onRiderChange,
  onChargeChange,
  onApply,
  applyLabel,
}: Props): JSX.Element {
  const localCustomerFieldRef = useRef<HTMLDivElement>(null);
  const fieldRef = customerFieldRef ?? localCustomerFieldRef;
  const isDelivery = mode === "delivery";
  const inputClass = tone === "fullscreen" ? FULL_INPUT : TICKET_INPUT;
  const isFullscreen = tone === "fullscreen";

  const toggleClass = isFullscreen
    ? open
      ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
      : "border-slate-600 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
    : open
      ? "border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200";

  const bodyClass = isFullscreen
    ? "mt-1.5 grid grid-cols-1 gap-1.5 rounded border border-slate-700 bg-slate-950/60 p-2"
    : "mt-1.5 grid grid-cols-1 gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700/60 dark:bg-slate-950/40";

  const pickerClass = isFullscreen
    ? "absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded border border-slate-600 bg-slate-900 shadow-xl"
    : "absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900";

  const pickerItemClass = isFullscreen
    ? "flex w-full flex-col items-start gap-0 px-2.5 py-1.5 text-left text-[11px] text-slate-200 hover:bg-slate-800"
    : "flex w-full flex-col items-start gap-0 px-2.5 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

  const applyClass = isFullscreen
    ? "rounded border border-amber-400/40 bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/25"
    : "rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-500/25 dark:text-amber-100";

  return (
    <div className={isFullscreen ? "mt-1.5" : "mt-2"} ref={panelRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${toggleClass}`}
      >
        <span className="min-w-0 truncate font-medium">{summary}</span>
        <span
          className={`shrink-0 text-[10px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div className={bodyClass}>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-1.5">
            <div className="relative min-w-0" ref={fieldRef}>
              <input
                ref={customerInputRef}
                placeholder="Customer — type to search"
                value={customer}
                onChange={(e) => onCustomerChange(e.target.value)}
                onFocus={onCustomerFocus}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    phoneInputRef?.current?.focus();
                  }
                  if (e.key === "Escape") {
                    onCloseCustomerPicker();
                  }
                }}
                className={inputClass}
              />
              {customerPickerOpen ? (
                <div className={pickerClass}>
                  {customersLoading ? (
                    <p className="px-2.5 py-2 text-xs text-slate-500">Loading customers…</p>
                  ) : customersError ? (
                    <p className="px-2.5 py-2 text-xs text-red-400">
                      Could not load accounts: {customersError}
                    </p>
                  ) : filteredCustomers.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-slate-500">
                      No saved customers yet — type a name/phone, or add from Accounts.
                    </p>
                  ) : (
                    filteredCustomers.map((row) => (
                      <button
                        key={`${row.name}-${row.phone}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSelectCustomer(row)}
                        className={pickerItemClass}
                      >
                        <span className="font-medium">{row.name}</span>
                        {row.phone ? (
                          <span className="text-[10px] text-slate-500">{row.phone}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <input
              ref={phoneInputRef}
              placeholder="Phone"
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApply();
                }
              }}
              className={inputClass}
              title="Customer phone"
            />
          </div>

          {isDelivery ? (
            <>
              <input
                placeholder="Delivery address"
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-1.5">
                <select
                  value={riderId}
                  onChange={(e) => onRiderChange(e.target.value)}
                  required
                  className={`${inputClass} ${!riderId ? "border-amber-400" : ""}`}
                >
                  <option value="">
                    {ridersLoading
                      ? "Loading riders…"
                      : ridersError
                        ? "Could not load riders"
                        : riders.length === 0
                          ? "No riders for this branch"
                          : "Rider *"}
                  </option>
                  {riders.map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.name}
                      {rider.phone ? ` · ${rider.phone}` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={50000}
                  placeholder="Charge"
                  title="Delivery charge"
                  value={deliveryChargePkr}
                  onChange={(e) => onChargeChange(Math.max(0, Number(e.target.value) || 0))}
                  className={`${inputClass} text-right tabular-nums`}
                />
              </div>
            </>
          ) : null}

          <button type="button" onClick={onApply} className={applyClass}>
            {applyLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
