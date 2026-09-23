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
    <div className="tf-pos space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-amber-400/90">{isAdmin ? "Admin counter" : "Counter"}</p>
          <h1 className="text-xl font-semibold">MaterialFlow POS</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 ${paymentMode === "cash" ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-950"}`}>
            {paymentMode === "cash" ? "Cash" : "Credit"}
          </span>
          <Link className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" to="/pops/tradeflow/bookings">Bookings</Link>
          <Link className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" to="/pops/tradeflow/stock">Stock</Link>
          <Link className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" to={customerId ? `/pops/tradeflow/ledger?customerId=${customerId}` : "/pops/tradeflow/ledger"}>Ledger</Link>
          <Link className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" to="/pops/printer">Printer</Link>
        </div>
      </header>

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-500">Customer</span>
                <select className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Cash (default)</option>
                  {partyCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {formatPkr(c.closingBalancePkr)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Sales person</span>
                <select className={fieldClass} value={salesPersonId} onChange={(e) => setSalesPersonId(e.target.value)}>
                  <option value="">Select</option>
                  {(personsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Due date</span>
                <input className={fieldClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={paymentMode === "cash"} />
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <TfField label="New party name">
                <input className={fieldClass} placeholder="e.g. Ahmed Traders" value={newParty} onChange={(e) => setNewParty(e.target.value)} />
              </TfField>
              <TfField label="WhatsApp phone">
                <input className={fieldClass} placeholder="03xx-xxxxxxx" value={newPartyPhone} onChange={(e) => setNewPartyPhone(e.target.value)} />
              </TfField>
              <div className="flex items-end">
                <button type="button" disabled={!newParty.trim() || addParty.isPending} onClick={() => addParty.mutate()} className="h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50 dark:border-slate-700">
                  {addParty.isPending ? "Adding..." : "Add party"}
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <TfField label="New sales person">
                <input className={fieldClass} placeholder="Full name" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} />
              </TfField>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!newPerson.trim() || addPerson.isPending}
                  onClick={() => addPerson.mutate()}
                  className="h-[42px] min-w-[160px] rounded-lg bg-slate-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  {addPerson.isPending ? "Adding..." : "Add sales person"}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                <p className="text-xs text-slate-500">Closing balance</p>
                <p className="text-lg font-medium">{selectedCustomer ? formatPkr(selectedCustomer.closingBalancePkr) : "Cash — no balance"}</p>
              </div>
              {ledgerQuery.data ? (
                <div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                  <p className="text-xs text-amber-800">Booking</p>
                  <p className="text-sm">
                    Booked {formatPkr(ledgerQuery.data.summary.bookingValuePkr)} · delivered {formatPkr(ledgerQuery.data.summary.deliveredValuePkr)} · remaining {formatPkr(ledgerQuery.data.summary.remainingValuePkr)}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                  <p className="text-xs text-emerald-800">Payment</p>
                  <p className="text-lg font-medium">{paymentMode === "cash" ? "Cash sale" : "Credit / party"}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <TfField label="Search item">
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
                  placeholder="Name or SKU"
                />
              </TfField>
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
              <TfField label="Discount type">
                <select className={fieldClass} value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)}>
                  <option value="none">None</option>
                  <option value="percent">Percent %</option>
                  <option value="amount">Amount Rs</option>
                </select>
              </TfField>
              <TfField label={discountType === "percent" ? "Discount %" : discountType === "amount" ? "Discount Rs" : "Discount value"}>
                <input
                  className={fieldClass}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  disabled={discountType === "none"}
                  placeholder={discountType === "percent" ? "e.g. 5" : discountType === "amount" ? "e.g. 100" : "0"}
                />
              </TfField>
            </div>
            <button type="button" onClick={() => addLine()} className="mt-3 h-12 w-full rounded-xl bg-amber-700 text-base font-medium text-white hover:bg-amber-50 dark:bg-amber-500/100">
              Add item to bill
            </button>
            {picked ? (
              <p className="mt-2 text-xs text-slate-500">
                {picked.name}: {picked.onHandQty} {picked.unit} on hand · {picked.bookedQty} booked · {picked.freeQty} free
                {picked.lastRatePkr != null ? ` · last rate ${formatPkr(picked.lastRatePkr)}` : ""}
                {picked.openBookingRemaining > 0 ? ` · booking left ${picked.openBookingRemaining}` : ""}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseItem(item)}
                  onDoubleClick={() => addLine(item)}
                  className={`rounded-xl border p-3 text-left transition ${picked?.id === item.id ? "border-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:bg-amber-950/40" : "border-slate-200 bg-slate-50 hover:border-amber-500/50 dark:border-slate-700 dark:bg-slate-800/50"}`}
                >
                  <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.onHandQty} {item.unit} · {formatPkr(item.lastRatePkr ?? item.defaultRatePkr)}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Click to select. Double-click or Enter to add to bill.</p>
          </section>

          {isAdmin ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Stock snapshot</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {items.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                    <span>{item.name}</span>
                    <span className="text-slate-500">{item.onHandQty} / {item.bookedQty} booked</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="font-medium">Bill</h2>
              <span className="text-xs text-slate-500">{cart.length} lines</span>
            </div>
            <div className="max-h-[320px] overflow-auto">
              {cart.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No items yet. Search or click a product.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800/70">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line) => (
                      <tr key={line.key} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <div className="font-medium">{line.name}</div>
                          <div className="text-xs text-slate-500">
                            {formatPkr(line.rate)}
                            {line.discountType === "percent" ? ` · ${line.discountValue}% off` : ""}
                            {line.discountType === "amount" ? ` · ${formatPkr(line.discountValue)} off` : ""}
                            {line.bookingRemaining > 0 ? " · booking" : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2">{line.qty} {line.unitKind === "alt" ? line.altUnit : line.unit}</td>
                        <td className="px-3 py-2 font-medium">{formatPkr(lineTotal(line))}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="text-red-600" onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}>x</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="space-y-1 border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatPkr(subtotal)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Discount</span><span>{formatPkr(discount)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Internal expenses</span><span>{formatPkr(expenseTotal)}</span></div>
              <div className="flex justify-between text-lg font-medium"><span>Total</span><span>{formatPkr(total)}</span></div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="text-sm font-medium">Invoice expenses</h3>
            <p className="mt-1 text-xs text-slate-500">Internal cost only. Not added to the party bill.</p>
            <div className="mt-2 grid grid-cols-[1fr_110px_auto] gap-2">
              <TfField label="Expense name">
                <input className={fieldClass} placeholder="Labor / loading" value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} />
              </TfField>
              <TfField label="Amount Rs">
                <input className={fieldClass} placeholder="e.g. 500" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
              </TfField>
              <div className="flex items-end">
                <button type="button" onClick={addExpense} className="h-[42px] rounded-lg bg-slate-900 px-3 text-sm text-white dark:bg-white dark:text-slate-900">Add</button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {expenses.map((e, i) => (
                <li key={`${e.label}-${i}`} className="flex justify-between">
                  <span>{e.label} · {formatPkr(e.amount)}</span>
                  <button type="button" className="text-red-600" onClick={() => setExpenses((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                </li>
              ))}
            </ul>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-500">Notes</span>
              <textarea className={`${fieldClass} min-h-16`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
            </label>
            <label className="mt-3 block text-xs text-slate-500">
              Attach bill / photo
              <input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" multiple onChange={(e) => void onAttach(e.target.files)} />
            </label>
            {files.length > 0 ? <p className="mt-1 text-xs text-slate-500">{files.map((f) => f.fileName).join(", ")}</p> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <TfField label="Receive now Rs">
              <input className={fieldClass} value={receiveAmount} onChange={(e) => setReceiveAmount(e.target.value)} placeholder={String(total)} />
            </TfField>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={cart.length === 0 || saveMutation.isPending} onClick={() => saveMutation.mutate(true)} className="rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white disabled:opacity-50">
                Save & Receive
              </button>
              <button type="button" disabled={cart.length === 0 || saveMutation.isPending} onClick={() => saveMutation.mutate(false)} className="rounded-xl border border-slate-300 py-3 text-sm font-medium dark:border-slate-700">
                Save & View
              </button>
            </div>
          </section>

          {saved ? (
            <section ref={savedRef} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <h3 className="font-medium">{saved.invoiceNo}</h3>
              <p className="text-sm text-slate-600">{saved.customerName} · {formatPkr(saved.totalPkr)} · received {formatPkr(saved.receivedPkr)}</p>
              {saved.expensePkr > 0 ? <p className="text-xs text-slate-500">Internal expenses {formatPkr(saved.expensePkr)}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {(["a4", "a5", "thermal"] as const).map((size) => (
                  <button key={size} type="button" className={`rounded-lg px-3 py-1.5 text-sm ${printSize === size ? "bg-amber-700 text-white" : "border border-slate-300 dark:border-slate-700"}`} onClick={() => setPrintSize(size)}>
                    {size.toUpperCase()}
                  </button>
                ))}
                <button type="button" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => printTradeFlowInvoice(saved, printSize, branch?.code)}>
                  Print
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
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
                <Link className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700" to="/pops/tradeflow/invoices">Invoices</Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
