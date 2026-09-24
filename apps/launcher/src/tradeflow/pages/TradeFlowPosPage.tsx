import { useMutation, useQuery } from "@tanstack/react-query";
import type { TradeFlowInvoice, TradeFlowItem } from "@platform/contracts";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createTradeFlowCustomer,
  createTradeFlowInvoice,
  createTradeFlowSalesPerson,
  fetchTradeFlowCustomers,
  fetchTradeFlowItems,
  fetchTradeFlowLedger,
  fetchTradeFlowSalesPersons,
  fetchTradeFlowWhatsapp,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { printTradeFlowInvoice, type TradeFlowPrintSize } from "../lib/printTradeFlowInvoice";
import { sendTradeFlowWhatsapp } from "../lib/whatsappTradeFlow";
import "../tradeflow.css";

type CartLine = {
  key: string;
  itemId: string;
  name: string;
  unit: string;
  altUnit: string;
  unitKind: "primary" | "alt";
  qty: number;
  rate: number;
  lastRate: number | null;
  discountType: "none" | "percent" | "amount";
  discountValue: number;
  available: number;
  booked: number;
  bookingId: string | null;
  bookingRemaining: number;
};

type ExpenseLine = { label: string; amount: number };
type FileLine = { fileName: string; mimeType: string; dataUrl: string };

function lineGross(line: CartLine): number {
  return line.unitKind === "alt" ? line.qty : line.qty * line.rate;
}

function lineDiscount(line: CartLine): number {
  const gross = lineGross(line);
  if (line.discountType === "percent") return Math.round((gross * line.discountValue) / 100);
  if (line.discountType === "amount") return Math.round(line.discountValue);
  return 0;
}

function lineTotal(line: CartLine): number {
  return Math.max(0, lineGross(line) - lineDiscount(line));
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fieldClass = `${tfInputClass} py-2`;

export function TradeFlowPosPage(): JSX.Element {
  const { branch, isAdmin } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const searchRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<HTMLElement | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [newParty, setNewParty] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState("1");
  const [unitKind, setUnitKind] = useState<"primary" | "alt">("primary");
  const [rate, setRate] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "amount">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [picked, setPicked] = useState<TradeFlowItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [files, setFiles] = useState<FileLine[]>([]);
  const [notes, setNotes] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<TradeFlowInvoice | null>(null);
  const [printSize, setPrintSize] = useState<TradeFlowPrintSize>("a4");

  const customersQuery = useQuery({
    queryKey: ["tradeflow", "customers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowCustomers(branch!.code),
  });
  const itemsQuery = useQuery({
    queryKey: ["tradeflow", "items", branch?.code, customerId || "cash"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowItems(branch!.code, customerId || undefined),
  });
  const personsQuery = useQuery({
    queryKey: ["tradeflow", "sales-persons", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowSalesPersons(branch!.code),
  });
  const ledgerQuery = useQuery({
    queryKey: ["tradeflow", "ledger", branch?.code, customerId, "pos"],
    enabled: Boolean(branch?.code && customerId),
    queryFn: () => fetchTradeFlowLedger(branch!.code, customerId, "all"),
  });

  const customers = customersQuery.data ?? [];
  const partyCustomers = customers.filter((c) => !c.isCash);
  const selectedCustomer = partyCustomers.find((c) => c.id === customerId) ?? null;
  const paymentMode = selectedCustomer ? "credit" : "cash";
  const items = itemsQuery.data ?? [];
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [items, search]);

  const subtotal = cart.reduce((s, l) => s + lineGross(l), 0);
  const discount = cart.reduce((s, l) => s + lineDiscount(l), 0);
  const total = Math.max(0, subtotal - discount);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const saveMutation = useMutation({
    mutationFn: (receiveNow: boolean) =>
      createTradeFlowInvoice({
        branchCode: branch!.code,
        customerId: customerId || null,
        salesPersonId: salesPersonId || null,
        paymentMode,
        dueDate: paymentMode === "credit" ? dueDate : null,
        receiveNow,
        receivedPkr: receiveNow ? Number(receiveAmount || total) : 0,
        notes,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          ratePkr: l.rate,
          discountType: l.discountType,
          discountValue: l.discountValue,
          bookingId: l.bookingId ?? undefined,
          unitKind: l.unitKind,
        })),
        expenses: expenses
          .filter((e) => e.label.trim() && Number.isFinite(e.amount) && e.amount > 0)
          .map((e) => ({ label: e.label.trim(), amountPkr: Math.round(e.amount) })),
        attachments: files,
      }),
    onSuccess: (invoice, receiveNow) => {
      invalidate();
      setSaved(invoice);
      setCart([]);
      setExpenses([]);
      setFiles([]);
      setNotes("");
      setReceiveAmount("");
      setError(null);
      setNotice(receiveNow ? `Saved and received ${invoice.invoiceNo}` : `Saved ${invoice.invoiceNo}`);
      window.setTimeout(() => savedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save invoice"),
  });

  const addParty = useMutation({
    mutationFn: () => createTradeFlowCustomer({ branchCode: branch!.code, name: newParty, phone: newPartyPhone }),
    onSuccess: (row) => {
      invalidate();
      setCustomerId(row.id);
      setNewParty("");
      setNewPartyPhone("");
      setNotice(`${row.name} added`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not add party"),
  });

  const addPerson = useMutation({
    mutationFn: () => createTradeFlowSalesPerson({ branchCode: branch!.code, name: newPerson }),
    onSuccess: (row) => {
      invalidate();
      setSalesPersonId(row.id);
      setNewPerson("");
      setError(null);
      setNotice(`${row.name} added as sales person`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not add sales person"),
  });

  function chooseItem(item: TradeFlowItem) {
    setPicked(item);
    setSearch(item.name);
    const nextRate = item.openBookingRemaining > 0 && item.openBookingRatePkr != null
      ? item.openBookingRatePkr
      : item.lastRatePkr ?? item.defaultRatePkr;
    setRate(String(nextRate));
    setQty(item.openBookingRemaining > 0 ? String(item.openBookingRemaining) : "1");
    setError(null);
  }

  function addLine(item = picked) {
    if (!item) {
      setError("Select an item first.");
      return;
    }
    const nextQty = Number(qty);
    const nextRate = Number(rate || item.lastRatePkr || item.defaultRatePkr);
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      setError("Enter a quantity.");
      return;
    }
    if (!Number.isFinite(nextRate) || nextRate < 0) {
      setError("Enter a rate.");
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: `${item.id}-${Date.now()}`,
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        altUnit: item.altUnit,
        unitKind,
        qty: nextQty,
        rate: nextRate,
        lastRate: item.lastRatePkr,
        discountType,
        discountValue: Number(discountValue || 0),
        available: item.onHandQty,
        booked: item.bookedQty,
        bookingId: item.openBookingId,
        bookingRemaining: item.openBookingRemaining,
      },
    ]);
    setPicked(null);
    setSearch("");
    setQty("1");
    setRate("");
    setDiscountType("none");
    setDiscountValue("");
    setError(null);
    searchRef.current?.focus();
  }

  function addExpense() {
    const amount = Number(expenseAmount);
    if (!expenseLabel.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter expense name and amount.");
      return;
    }
    setExpenses((prev) => [...prev, { label: expenseLabel.trim(), amount }]);
    setExpenseLabel("");
    setExpenseAmount("");
    setError(null);
  }

  async function onAttach(list: FileList | null) {
    if (!list) return;
    const next: FileLine[] = [];
    for (const file of Array.from(list)) {
      if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
        setError("Attach JPG, PNG, or PDF only.");
        return;
      }
      if (file.size > 2_000_000) {
        setError("Each attachment must be under 2 MB.");
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      next.push({ fileName: file.name, mimeType: file.type, dataUrl });
    }
    setFiles((prev) => [...prev, ...next]);
  }

  return (
    <div className="tf-pos space-y-3">
      <header className="tf-pos-toolbar">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
            {isAdmin ? "Admin counter" : "Counter"} · {branch?.name ?? "Branch"}
          </p>
          <h1 className="truncate text-lg font-semibold leading-tight">MaterialFlow POS</h1>
        </div>
        <span className={`tf-pos-chip ${paymentMode === "cash" ? "tf-pos-chip-cash" : "tf-pos-chip-credit"}`}>
          {paymentMode === "cash" ? "Cash sale" : "Credit / party"}
        </span>
        <Link className="tf-pos-link" to="/pops/tradeflow/bookings">Bookings</Link>
        <Link className="tf-pos-link" to="/pops/tradeflow/stock">Stock</Link>
        <Link className="tf-pos-link" to={customerId ? `/pops/tradeflow/ledger?customerId=${customerId}` : "/pops/tradeflow/ledger"}>Ledger</Link>
        <Link className="tf-pos-link" to="/pops/printer">Printer</Link>
      </header>

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="tf-pos-shell">
        <div className="space-y-3">
          {/* Party strip — compact */}
          <section className="tf-pos-panel p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Party</span>
                <select className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Cash (walk-in)</option>
                  {partyCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {formatPkr(c.closingBalancePkr)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Sales person</span>
                <select className={fieldClass} value={salesPersonId} onChange={(e) => setSalesPersonId(e.target.value)}>
                  <option value="">Optional</option>
                  {(personsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Due date</span>
                <input className={fieldClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={paymentMode === "cash"} />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                Balance:{" "}
                <strong className="text-slate-800 dark:text-slate-100">
                  {selectedCustomer ? formatPkr(selectedCustomer.closingBalancePkr) : "—"}
                </strong>
              </span>
              {ledgerQuery.data ? (
                <span>
                  Booking left:{" "}
                  <strong className="text-amber-800 dark:text-amber-300">
                    {formatPkr(ledgerQuery.data.summary.remainingValuePkr)}
                  </strong>
                </span>
              ) : null}
            </div>
            <details className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                Quick add party / sales person
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input className={fieldClass} placeholder="New party name" value={newParty} onChange={(e) => setNewParty(e.target.value)} />
                <input className={fieldClass} placeholder="WhatsApp phone" value={newPartyPhone} onChange={(e) => setNewPartyPhone(e.target.value)} />
                <button type="button" disabled={!newParty.trim() || addParty.isPending} onClick={() => addParty.mutate()} className="h-[38px] rounded-lg border border-slate-300 text-sm disabled:opacity-50 dark:border-slate-700">
                  {addParty.isPending ? "Adding…" : "Add party"}
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input className={fieldClass} placeholder="New sales person" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} />
                <button type="button" disabled={!newPerson.trim() || addPerson.isPending} onClick={() => addPerson.mutate()} className="h-[38px] rounded-lg bg-slate-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
                  {addPerson.isPending ? "Adding…" : "Add person"}
                </button>
              </div>
            </details>
          </section>

          {/* Item picker — primary surface */}
          <section className="tf-pos-panel p-3">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-[12rem] flex-1">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Find item
                </label>
                <input
                  ref={searchRef}
                  className={fieldClass}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (picked) addLine();
                      else if (matches[0]) addLine(matches[0]);
                    }
                  }}
                  placeholder="Name or SKU — Enter to add"
                  autoFocus
                />
              </div>
              <p className="pb-2 text-xs text-slate-400">
                {itemsQuery.isLoading ? "Loading…" : `${matches.length} of ${items.length}`}
              </p>
            </div>

            <div className="tf-pos-item-grid">
              {matches.length === 0 ? (
                <p className="col-span-full px-2 py-8 text-center text-sm text-slate-500">
                  {itemsQuery.isLoading ? "Fetching items…" : "No items match. Clear search or add stock in Items."}
                </p>
              ) : (
                matches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseItem(item)}
                    onDoubleClick={() => addLine(item)}
                    className={`tf-pos-item ${picked?.id === item.id ? "is-picked" : ""}`}
                  >
                    <p className="tf-pos-item-name truncate">{item.name}</p>
                    <p className="tf-pos-item-meta">
                      {item.onHandQty} {item.unit} · {formatPkr(item.lastRatePkr ?? item.defaultRatePkr)}
                    </p>
                    {item.openBookingRemaining > 0 ? (
                      <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        Booking {item.openBookingRemaining}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-5">
              <TfField label="Unit">
                <select className={fieldClass} value={unitKind} onChange={(e) => setUnitKind(e.target.value as "primary" | "alt")}>
                  <option value="primary">{picked?.unit ?? "Qty unit"}</option>
                  <option value="alt">{picked?.altUnit ?? "Amount unit"}</option>
                </select>
              </TfField>
              <TfField label="Qty">
                <input className={fieldClass} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" />
              </TfField>
              <TfField label="Rate Rs">
                <input className={fieldClass} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1500" />
              </TfField>
              <TfField label="Discount">
                <div className="flex gap-1">
                  <select className={fieldClass} value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)}>
                    <option value="none">None</option>
                    <option value="percent">%</option>
                    <option value="amount">Rs</option>
                  </select>
                  <input
                    className={fieldClass}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={discountType === "none"}
                    placeholder="0"
                  />
                </div>
              </TfField>
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => addLine()}
                  disabled={!picked && matches.length === 0}
                  className="tf-primary-btn h-[42px] rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Add to bill
                </button>
              </div>
            </div>
            {picked ? (
              <p className="mt-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700 dark:text-slate-200">{picked.name}</span>
                {" · "}
                {picked.onHandQty} on hand · {picked.bookedQty} booked · {picked.freeQty} free
                {picked.lastRatePkr != null ? ` · last ${formatPkr(picked.lastRatePkr)}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Click an item to select · Double-click or Enter to add</p>
            )}
          </section>
        </div>

        <aside className="tf-pos-bill tf-pos-panel">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Bill</h2>
            <span className="text-xs tabular-nums text-slate-500">{cart.length} lines</span>
          </div>

          <div className="tf-pos-bill-lines">
            {cart.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Select items on the left to build the bill.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Amt</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((line) => (
                    <tr key={line.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{line.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatPkr(line.rate)}
                          {line.discountType === "percent" ? ` · ${line.discountValue}%` : ""}
                          {line.discountType === "amount" ? ` · −${formatPkr(line.discountValue)}` : ""}
                          {line.bookingRemaining > 0 ? " · booking" : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {line.qty} {line.unitKind === "alt" ? line.altUnit : line.unit}
                      </td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{formatPkr(lineTotal(line))}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 dark:text-red-400"
                          onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-1 border-t border-slate-100 px-3 py-3 text-sm dark:border-slate-800">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">{formatPkr(subtotal)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Discount</span><span className="tabular-nums">{formatPkr(discount)}</span></div>
            {expenseTotal > 0 ? (
              <div className="flex justify-between text-slate-500"><span>Internal cost</span><span className="tabular-nums">{formatPkr(expenseTotal)}</span></div>
            ) : null}
            <div className="flex justify-between pt-1 text-base font-semibold text-slate-900 dark:text-white">
              <span>Total</span>
              <span className="tabular-nums">{formatPkr(total)}</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
            <TfField label="Receive now Rs">
              <input className={fieldClass} value={receiveAmount} onChange={(e) => setReceiveAmount(e.target.value)} placeholder={String(total || 0)} />
            </TfField>
            <div className="tf-pos-pay-row">
              <button
                type="button"
                disabled={cart.length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate(true)}
                className="tf-pos-pay-primary"
              >
                {saveMutation.isPending ? "Saving…" : "Save & Receive"}
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate(false)}
                className="tf-pos-pay-secondary"
              >
                Save only
              </button>
            </div>
          </div>

          <details className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Notes, expenses, attachments</summary>
            <div className="mt-2 space-y-2 pb-2">
              <div className="grid grid-cols-[1fr_90px_auto] gap-1.5">
                <input className={fieldClass} placeholder="Expense (internal)" value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} />
                <input className={fieldClass} placeholder="Rs" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                <button type="button" onClick={addExpense} className="h-[38px] rounded-lg bg-slate-900 px-3 text-xs text-white dark:bg-white dark:text-slate-900">Add</button>
              </div>
              {expenses.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {expenses.map((e, i) => (
                    <li key={`${e.label}-${i}`} className="flex justify-between gap-2">
                      <span>{e.label} · {formatPkr(e.amount)}</span>
                      <button type="button" className="text-red-600" onClick={() => setExpenses((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <textarea className={`${fieldClass} min-h-14 text-sm`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Invoice notes" />
              <input className="block w-full text-xs" type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" multiple onChange={(e) => void onAttach(e.target.files)} />
              {files.length > 0 ? <p className="text-[11px] text-slate-500">{files.map((f) => f.fileName).join(", ")}</p> : null}
            </div>
          </details>

          {saved ? (
            <section ref={savedRef} className="border-t border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{saved.invoiceNo}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {saved.customerName} · {formatPkr(saved.totalPkr)} · received {formatPkr(saved.receivedPkr)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["a4", "a5", "thermal"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`rounded-md px-2.5 py-1 text-xs ${printSize === size ? "tf-primary-btn" : "border border-slate-300 dark:border-slate-700"}`}
                    onClick={() => setPrintSize(size)}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
                <button type="button" className="rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white dark:bg-white dark:text-slate-900" onClick={() => printTradeFlowInvoice(saved, printSize, branch?.code)}>
                  Print
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs text-white"
                  onClick={async () => {
                    try {
                      const wa = await fetchTradeFlowWhatsapp({
                        branchCode: branch!.code,
                        kind: "invoice",
                        partyType: "customer",
                        partyId: saved.customerId ?? undefined,
                        invoiceId: saved.id,
                      });
                      await sendTradeFlowWhatsapp({ waUrl: wa.waUrl, phone: wa.phone, invoice: saved });
                      setError(null);
                      setNotice("Invoice image downloaded. WhatsApp opened.");
                    } catch (err) {
                      setNotice(null);
                      setError(err instanceof Error ? err.message : "Could not send WhatsApp");
                    }
                  }}
                >
                  WhatsApp
                </button>
                <Link className="rounded-md border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700" to="/pops/tradeflow/invoices">
                  Invoices
                </Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
