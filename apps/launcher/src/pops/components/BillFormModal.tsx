import { Button } from "@platform/ui";
import {
  formatMenuItemLabel,
  menuItemDisplayPrice,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_VALUES,
  type Bill,
  type BillLine,
  type BillPayment,
  type MenuItem,
  type PaymentMethod,
  type WaiterOption,
} from "@platform/contracts";
import { useMemo, useState } from "react";
import { BillReceiptPreview } from "./BillReceiptPreview";
import { computeCheckoutTotals } from "../lib/posCheckout";
import { discountAmountFromPct } from "../lib/posDiscount";
import { billChannelLabel } from "../lib/orderSales";
import { type PrintTicketInput } from "../lib/printTicket";
import type { BillPrintSettings } from "../lib/billPrintSettings";
import { fieldInputClass, fieldSelectClass, linkDangerClass } from "../lib/themeClasses";

export type BillFormValues = {
  tableLabel: string;
  orderRef: string;
  waiterName: string;
  notes: string;
  lines: BillLine[];
  discountPct: number;
  servicePct: number;
  taxPct: number;
  deliveryChargePkr: number;
  saveAs: "held" | "completed";
  payments: BillPayment[];
};

type Props = {
  mode: "create" | "edit";
  bill?: Bill;
  branchName: string;
  branchCode: string;
  menuItems: MenuItem[];
  waiters: WaiterOption[];
  defaultServicePct: number;
  defaultTaxPct: number;
  billPrintSettings: BillPrintSettings;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: BillFormValues) => void;
};

function emptyLine(): BillLine {
  return { label: "", qty: 1, unitPrice: 0 };
}

function billToForm(
  bill: Bill,
  defaultServicePct: number,
  defaultTaxPct: number,
): BillFormValues {
  const discountPct =
    bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0;
  return {
    tableLabel: bill.tableLabel,
    orderRef: bill.orderRef ?? "",
    waiterName: bill.waiterName,
    notes: bill.notes ?? "",
    lines: bill.lines.length > 0 ? bill.lines.map((l) => ({ ...l })) : [emptyLine()],
    discountPct,
    servicePct: bill.servicePct,
    taxPct: bill.taxPct,
    deliveryChargePkr: bill.deliveryChargePkr,
    saveAs: "held",
    payments: [{ method: "cash", amount: bill.total }],
  };
}

function defaultForm(defaultServicePct: number, defaultTaxPct: number): BillFormValues {
  return {
    tableLabel: "T1",
    orderRef: "",
    waiterName: "POS Counter",
    notes: "",
    lines: [emptyLine()],
    discountPct: 0,
    servicePct: defaultServicePct,
    taxPct: defaultTaxPct,
    deliveryChargePkr: 0,
    saveAs: "held",
    payments: [{ method: "cash", amount: 0 }],
  };
}

export function BillFormModal({
  mode,
  bill,
  branchName,
  branchCode,
  menuItems,
  waiters,
  defaultServicePct,
  defaultTaxPct,
  billPrintSettings,
  loading = false,
  error = null,
  onClose,
  onSubmit,
}: Props): JSX.Element {
  const [form, setForm] = useState<BillFormValues>(() =>
    mode === "edit" && bill
      ? billToForm(bill, defaultServicePct, defaultTaxPct)
      : defaultForm(defaultServicePct, defaultTaxPct),
  );
  const [menuPick, setMenuPick] = useState("");

  const totals = useMemo(() => {
    const validLines = form.lines.filter((l) => l.label.trim() && l.qty > 0);
    const subtotal = validLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const discount = discountAmountFromPct(form.discountPct, subtotal);
    return computeCheckoutTotals(
      validLines,
      discount,
      form.servicePct,
      form.taxPct,
      form.deliveryChargePkr,
    );
  }, [form]);

  const previewInput = useMemo((): Omit<PrintTicketInput, "kind"> => {
    const validLines = form.lines.filter((l) => l.label.trim() && l.qty > 0);
    const discount = discountAmountFromPct(form.discountPct, totals.subtotal);
    const billRef = mode === "edit" && bill ? bill.billRef : "PREVIEW";
    return {
      branchName,
      branchCode,
      orderRef: form.orderRef.trim() || billRef,
      billRef,
      modeLabel: billChannelLabel(form.tableLabel.trim() || "T1"),
      tableLabel: form.tableLabel.trim() || "—",
      waiterName: form.waiterName.trim() || "—",
      notes: form.notes.trim() || undefined,
      lines: validLines.map((line) => ({
        label: line.label,
        qty: line.qty,
        unitPrice: line.unitPrice,
      })),
      subtotal: totals.subtotal,
      discount,
      service: totals.service,
      tax: totals.tax,
      deliveryCharge: form.deliveryChargePkr > 0 ? form.deliveryChargePkr : undefined,
      total: totals.total,
      servicePct: form.servicePct,
      taxPct: form.taxPct,
      discountPct: form.discountPct,
    };
  }, [form, totals, mode, bill, branchName, branchCode]);

  function addItemLine(): void {
    setForm((f) => ({ ...f, lines: [...f.lines.filter((l) => l.label.trim()), emptyLine()] }));
  }

  function addMenuItem(itemId: string): void {
    const item = menuItems.find((i) => i.id === itemId);
    if (!item) return;
    const variant = item.variants.find((v) => v.isActive) ?? item.variants[0];
    const label = variant ? `${item.name} (${variant.label})` : formatMenuItemLabel(item);
    const price = variant?.price ?? menuItemDisplayPrice(item);
    setForm((f) => ({
      ...f,
      lines: [...f.lines.filter((l) => l.label.trim()), { label, qty: 1, unitPrice: price, menuItemId: item.id }],
    }));
    setMenuPick("");
  }

  function updateLine(index: number, patch: Partial<BillLine>): void {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const lines = form.lines.filter((l) => l.label.trim() && l.qty > 0 && l.unitPrice >= 0);
    if (lines.length === 0) return;
    const payments =
      mode === "create" && form.saveAs === "completed"
        ? [{ method: form.payments[0]?.method ?? "cash", amount: totals.total }]
        : form.payments;
    onSubmit({ ...form, lines, payments });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65">
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-form-title"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 id="bill-form-title" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {mode === "create" ? "Create bill" : `Edit bill — ${bill?.billRef ?? ""}`}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "edit"
              ? "Only held bills can be edited. Changes update totals automatically."
              : "Add items and save as held or complete with payment."}
          </p>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="grid min-h-0 flex-1 lg:grid-cols-2">
            <div className="min-h-0 overflow-y-auto border-b border-slate-200 px-5 py-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs text-slate-500">
                Table / station
                <input
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.tableLabel}
                  onChange={(e) => setForm((f) => ({ ...f, tableLabel: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs text-slate-500">
                Order ref (optional)
                <input
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.orderRef}
                  onChange={(e) => setForm((f) => ({ ...f, orderRef: e.target.value }))}
                  placeholder="ORD-…"
                />
              </label>
              <label className="block text-xs text-slate-500">
                Waiter
                {waiters.length > 0 ? (
                  <select
                    className={`mt-1 w-full ${fieldSelectClass}`}
                    value={form.waiterName}
                    onChange={(e) => setForm((f) => ({ ...f, waiterName: e.target.value }))}
                  >
                    <option value="POS Counter">POS Counter</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={`mt-1 w-full ${fieldInputClass}`}
                    value={form.waiterName}
                    onChange={(e) => setForm((f) => ({ ...f, waiterName: e.target.value }))}
                  />
                )}
              </label>
              <label className="block text-xs text-slate-500 sm:col-span-2">
                Notes
                <input
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Line items</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" className="text-xs" onClick={addItemLine}>
                    + Add item
                  </Button>
                  {menuItems.length > 0 ? (
                    <select
                      className={`text-xs ${fieldSelectClass}`}
                      value={menuPick}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) addMenuItem(id);
                      }}
                    >
                      <option value="">Add from menu…</option>
                      {menuItems
                        .filter((i) => i.isActive)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} — Rs {menuItemDisplayPrice(item).toLocaleString()}
                          </option>
                        ))}
                    </select>
                  ) : null}
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {form.lines.map((line, index) => (
                  <li
                    key={index}
                    className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-12"
                  >
                    <label className="block text-[10px] text-slate-500 sm:col-span-5">
                      Item / charge
                      <input
                        className={`mt-1 w-full ${fieldInputClass}`}
                        value={line.label}
                        onChange={(e) => updateLine(index, { label: e.target.value })}
                        placeholder="e.g. Extra sauce, corkage fee"
                        required
                      />
                    </label>
                    <label className="block text-[10px] text-slate-500 sm:col-span-2">
                      Qty
                      <input
                        type="number"
                        min={1}
                        className={`mt-1 w-full ${fieldInputClass}`}
                        value={line.qty}
                        onChange={(e) => updateLine(index, { qty: Number(e.target.value) || 1 })}
                      />
                    </label>
                    <label className="block text-[10px] text-slate-500 sm:col-span-3">
                      Unit price (PKR)
                      <input
                        type="number"
                        min={0}
                        className={`mt-1 w-full ${fieldInputClass}`}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <div className="flex items-end justify-end sm:col-span-2">
                      {form.lines.length > 1 ? (
                        <button
                          type="button"
                          className={`pb-2 text-[10px] ${linkDangerClass}`}
                          onClick={() =>
                            setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <label className="block text-xs text-slate-500">
                Discount (%)
                <input
                  type="number"
                  min={0}
                  max={50}
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.discountPct}
                  onChange={(e) => setForm((f) => ({ ...f, discountPct: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="block text-xs text-slate-500">
                Service (%)
                <input
                  type="number"
                  min={0}
                  max={30}
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.servicePct}
                  onChange={(e) => setForm((f) => ({ ...f, servicePct: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="block text-xs text-slate-500">
                Tax (%)
                <input
                  type="number"
                  min={0}
                  max={30}
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.taxPct}
                  onChange={(e) => setForm((f) => ({ ...f, taxPct: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="block text-xs text-slate-500">
                Delivery (PKR)
                <input
                  type="number"
                  min={0}
                  className={`mt-1 w-full ${fieldInputClass}`}
                  value={form.deliveryChargePkr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deliveryChargePkr: Number(e.target.value) || 0 }))
                  }
                />
              </label>
            </div>

            {mode === "create" ? (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="radio"
                    name="saveAs"
                    checked={form.saveAs === "held"}
                    onChange={() => setForm((f) => ({ ...f, saveAs: "held" }))}
                  />
                  Save as held bill
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="radio"
                    name="saveAs"
                    checked={form.saveAs === "completed"}
                    onChange={() => setForm((f) => ({ ...f, saveAs: "completed" }))}
                  />
                  Complete with payment
                </label>
                {form.saveAs === "completed" ? (
                  <select
                    className={`text-xs ${fieldSelectClass}`}
                    value={form.payments[0]?.method ?? "cash"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        payments: [{ method: e.target.value as PaymentMethod, amount: totals.total }],
                      }))
                    }
                  >
                    {PAYMENT_METHOD_VALUES.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums">Rs {totals.subtotal.toLocaleString()}</span>
              </div>
              {totals.discount > 0 ? (
                <div className="mt-1 flex justify-between text-red-600 dark:text-red-400">
                  <span>Discount</span>
                  <span className="tabular-nums">− Rs {totals.discount.toLocaleString()}</span>
                </div>
              ) : null}
              <div className="mt-1 flex justify-between font-semibold text-slate-900 dark:text-white">
                <span>Total</span>
                <span className="tabular-nums">Rs {totals.total.toLocaleString()}</span>
              </div>
            </div>

            {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}
            </div>

            <div className="min-h-0 overflow-y-auto bg-slate-50 px-5 py-4 dark:bg-slate-950/30">
              <BillReceiptPreview
                input={previewInput}
                branchCode={branchCode}
                printSettings={billPrintSettings}
                title="Bill preview"
              />
              <p className="mt-2 text-[10px] text-slate-500">
                Preview matches printed and digital receipts ({billChannelLabel(form.tableLabel)}).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <Button type="submit" className="text-xs" disabled={loading}>
              {loading ? "Saving…" : mode === "create" ? "Create bill" : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" className="text-xs" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
