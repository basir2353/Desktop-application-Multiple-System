import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { MobizonePurchase, MobizoneSale } from "@platform/contracts";
import type { UpdatePurchaseInput, UpdateSaleInput } from "../lib/mobizoneStore";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  buildWhatsAppPurchaseText,
  buildWhatsAppSaleText,
  filterByDateRange,
  formatPkr,
  monthStartDateInput,
  openWhatsApp,
  printPurchaseReceipt,
  printSaleReceipt,
  returnPurchase,
  returnSale,
  todayDateInput,
  updatePurchase,
  updateSale,
} from "../lib/mobizoneStore";
import {
  MzDateRangeFilter,
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
  MzSelect,
  MzTextArea,
} from "../ui/MobizoneUi";

function UniversalHistoryLink({
  imei,
  customerHint,
}: {
  imei: string;
  customerHint?: string | null;
}): JSX.Element {
  const q = imei || customerHint || "";
  return (
    <Link to={`/pops/mobizone/search?q=${encodeURIComponent(q)}&focus=${imei ? "imei" : "customer"}`}>
      <MzSecondaryButton>History</MzSecondaryButton>
    </Link>
  );
}

function EditModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className={`${cardClass} max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4 shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <MzSecondaryButton onClick={onClose}>Close</MzSecondaryButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaleEditForm({
  sale,
  bankAccounts,
  onCancel,
  onSaved,
}: {
  sale: MobizoneSale;
  bankAccounts: Array<{ id: string; bankName: string; accountTitle: string }>;
  onCancel: () => void;
  onSaved: (input: UpdateSaleInput) => void;
}): JSX.Element {
  const [customerName, setCustomerName] = useState(sale.customerName);
  const [customerPhone, setCustomerPhone] = useState(sale.customerPhone ?? "");
  const [customerCnic, setCustomerCnic] = useState(sale.customerCnic ?? "");
  const [customerAddress, setCustomerAddress] = useState(sale.customerAddress ?? "");
  const [brand, setBrand] = useState(sale.brand);
  const [model, setModel] = useState(sale.model);
  const [price, setPrice] = useState(String(sale.pricePkr));
  const [cash, setCash] = useState(String(sale.payment.cashPkr || 0));
  const [bank, setBank] = useState(String(sale.payment.bankPkr || 0));
  const [bankAccountId, setBankAccountId] = useState(sale.payment.bank?.bankAccountId ?? "");
  const [txnRef, setTxnRef] = useState(sale.payment.bank?.txnRef ?? "");
  const [dueDate, setDueDate] = useState(sale.dueDate ?? "");
  const [warrantyDays, setWarrantyDays] = useState(String(sale.warrantyDays || 0));
  const [note, setNote] = useState(sale.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!bankAccountId && bankAccounts.length === 1) setBankAccountId(bankAccounts[0]!.id);
  }, [bankAccountId, bankAccounts]);

  function save(): void {
    setErr(null);
    const priceN = Number(price) || 0;
    const cashN = Number(cash) || 0;
    const bankN = Number(bank) || 0;
    const resolvedBankId =
      bankAccountId || (bankN > 0 && bankAccounts.length === 1 ? bankAccounts[0]!.id : "");
    if (bankN > 0 && !resolvedBankId) {
      setErr("Select a bank account when bank amount is greater than zero.");
      return;
    }
    const acc = bankAccounts.find((a) => a.id === resolvedBankId);
    onSaved({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      customerCnic: customerCnic.trim() || null,
      customerAddress: customerAddress.trim() || null,
      brand,
      model,
      note: note.trim() || null,
      pricePkr: priceN,
      dueDate: dueDate || null,
      warrantyDays: Number(warrantyDays) || 0,
      payment: {
        cashPkr: cashN,
        bankPkr: bankN,
        bankLabel: acc ? `${acc.bankName} · ${acc.accountTitle}` : null,
        bank: {
          bankAccountId: resolvedBankId || null,
          bankName: acc?.bankName ?? null,
          accountTitle: acc?.accountTitle ?? null,
          accountNumber: null,
          iban: null,
          txnRef: txnRef.trim() || null,
          verified: Boolean(sale.payment.bank?.verified),
        },
      },
    });
  }

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <p className={`text-xs ${mutedClass}`}>IMEI: {sale.imei} · Bill #{sale.id.slice(0, 8).toUpperCase()}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <MzField label="Customer name *">
          <MzInput value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </MzField>
        <MzField label="Mobile">
          <MzInput value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </MzField>
        <MzField label="CNIC">
          <MzInput value={customerCnic} onChange={(e) => setCustomerCnic(e.target.value)} />
        </MzField>
        <MzField label="Address">
          <MzInput value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
        </MzField>
        <MzField label="Brand">
          <MzInput value={brand} onChange={(e) => setBrand(e.target.value)} />
        </MzField>
        <MzField label="Model">
          <MzInput value={model} onChange={(e) => setModel(e.target.value)} />
        </MzField>
        <MzField label="Sale price *">
          <MzInput type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </MzField>
        <MzField label="Warranty (days)">
          <MzInput type="number" min={0} value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} />
        </MzField>
        <MzField label="Cash received">
          <MzInput type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} />
        </MzField>
        <MzField label="Bank received">
          <MzInput type="number" min={0} value={bank} onChange={(e) => setBank(e.target.value)} />
        </MzField>
        <MzField label="Bank account">
          <MzSelect value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">Select…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} — {a.accountTitle}
              </option>
            ))}
          </MzSelect>
        </MzField>
        <MzField label="Txn ref">
          <MzInput value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
        </MzField>
        <MzField label="Credit due date">
          <MzInput
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mz-date-input"
          />
        </MzField>
        <div className="sm:col-span-2">
          <MzField label="Note (prints on bill)">
            <MzTextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any note / remarks…"
              rows={3}
              maxLength={800}
            />
          </MzField>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <MzPrimaryButton onClick={save}>Save changes</MzPrimaryButton>
        <MzSecondaryButton onClick={onCancel}>Cancel</MzSecondaryButton>
      </div>
    </div>
  );
}

function PurchaseEditForm({
  purchase,
  bankAccounts,
  onCancel,
  onSaved,
}: {
  purchase: MobizonePurchase;
  bankAccounts: Array<{ id: string; bankName: string; accountTitle: string }>;
  onCancel: () => void;
  onSaved: (input: UpdatePurchaseInput) => void;
}): JSX.Element {
  const [sellerName, setSellerName] = useState(purchase.sellerName);
  const [sellerPhone, setSellerPhone] = useState(purchase.sellerPhone ?? "");
  const [sellerCnic, setSellerCnic] = useState(purchase.sellerCnic ?? "");
  const [sellerAddress, setSellerAddress] = useState(purchase.sellerAddress ?? "");
  const [brand, setBrand] = useState(purchase.brand);
  const [model, setModel] = useState(purchase.model);
  const [colour, setColour] = useState(purchase.colour ?? "");
  const [storage, setStorage] = useState(purchase.storage ?? "");
  const [imei, setImei] = useState(purchase.imei);
  const [price, setPrice] = useState(String(purchase.purchasePricePkr));
  const [cash, setCash] = useState(String(purchase.payment.cashPkr || 0));
  const [bank, setBank] = useState(String(purchase.payment.bankPkr || 0));
  const [bankAccountId, setBankAccountId] = useState(purchase.payment.bank?.bankAccountId ?? "");
  const [txnRef, setTxnRef] = useState(purchase.payment.bank?.txnRef ?? "");
  const [dueDate, setDueDate] = useState(purchase.dueDate ?? "");
  const [note, setNote] = useState(purchase.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!bankAccountId && bankAccounts.length === 1) setBankAccountId(bankAccounts[0]!.id);
  }, [bankAccountId, bankAccounts]);

  function save(): void {
    setErr(null);
    const priceN = Number(price) || 0;
    const cashN = Number(cash) || 0;
    const bankN = Number(bank) || 0;
    const resolvedBankId =
      bankAccountId || (bankN > 0 && bankAccounts.length === 1 ? bankAccounts[0]!.id : "");
    if (bankN > 0 && !resolvedBankId) {
      setErr("Select a bank account when bank amount is greater than zero.");
      return;
    }
    const acc = bankAccounts.find((a) => a.id === resolvedBankId);
    onSaved({
      sellerName: sellerName.trim(),
      sellerPhone: sellerPhone.trim() || null,
      sellerCnic: sellerCnic.trim() || null,
      sellerAddress: sellerAddress.trim() || null,
      brand,
      model,
      colour: colour.trim() || null,
      storage: storage.trim() || null,
      imei,
      note: note.trim() || null,
      purchasePricePkr: priceN,
      dueDate: dueDate || null,
      payment: {
        cashPkr: cashN,
        bankPkr: bankN,
        bankLabel: acc ? `${acc.bankName} · ${acc.accountTitle}` : null,
        bank: {
          bankAccountId: resolvedBankId || null,
          bankName: acc?.bankName ?? null,
          accountTitle: acc?.accountTitle ?? null,
          accountNumber: null,
          iban: null,
          txnRef: txnRef.trim() || null,
          verified: Boolean(purchase.payment.bank?.verified),
        },
      },
    });
  }

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <p className={`text-xs ${mutedClass}`}>Bill #{purchase.id.slice(0, 8).toUpperCase()}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <MzField label="Seller name *">
          <MzInput value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
        </MzField>
        <MzField label="Mobile">
          <MzInput value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} />
        </MzField>
        <MzField label="CNIC">
          <MzInput value={sellerCnic} onChange={(e) => setSellerCnic(e.target.value)} />
        </MzField>
        <MzField label="Address">
          <MzInput value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} />
        </MzField>
        <MzField label="IMEI">
          <MzInput value={imei} onChange={(e) => setImei(e.target.value)} className="font-mono" />
        </MzField>
        <MzField label="Brand *">
          <MzInput value={brand} onChange={(e) => setBrand(e.target.value)} />
        </MzField>
        <MzField label="Model *">
          <MzInput value={model} onChange={(e) => setModel(e.target.value)} />
        </MzField>
        <MzField label="Colour">
          <MzInput value={colour} onChange={(e) => setColour(e.target.value)} />
        </MzField>
        <MzField label="Storage">
          <MzInput value={storage} onChange={(e) => setStorage(e.target.value)} />
        </MzField>
        <MzField label="Purchase price *">
          <MzInput type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </MzField>
        <MzField label="Cash paid">
          <MzInput type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} />
        </MzField>
        <MzField label="Bank paid">
          <MzInput type="number" min={0} value={bank} onChange={(e) => setBank(e.target.value)} />
        </MzField>
        <MzField label="Bank account">
          <MzSelect value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">Select…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} — {a.accountTitle}
              </option>
            ))}
          </MzSelect>
        </MzField>
        <MzField label="Txn ref">
          <MzInput value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
        </MzField>
        <MzField label="Credit due date">
          <MzInput
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mz-date-input"
          />
        </MzField>
        <div className="sm:col-span-2">
          <MzField label="Note (prints on bill)">
            <MzTextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any note / remarks…"
              rows={3}
              maxLength={800}
            />
          </MzField>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <MzPrimaryButton onClick={save}>Save changes</MzPrimaryButton>
        <MzSecondaryButton onClick={onCancel}>Cancel</MzSecondaryButton>
      </div>
    </div>
  );
}

export function MobizoneSalesHistoryPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [editing, setEditing] = useState<MobizoneSale | null>(null);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const sales = useMemo(
    () => filterByDateRange(db.sales, fromDate || null, toDate || null),
    [db.sales, fromDate, toDate],
  );

  function onReturn(saleId: string): void {
    if (!branchCode) return;
    if (!window.confirm("Return this phone to stock? Received amount will be logged as paid back.")) return;
    try {
      returnSale(branchCode, saleId, "Customer return");
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Return failed");
    }
  }

  function saveSaleEdit(input: UpdateSaleInput): void {
    if (!branchCode || !editing) return;
    try {
      updateSale(branchCode, editing.id, input);
      setEditing(null);
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Edit failed");
    }
  }

  return (
    <MzPage>
      <PageHeader title="Sales history" subtitle="Cash/bank split, dues, warranty — edit / return to stock." />
      <MzSection title="Date filter">
        <MzDateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />
      </MzSection>
      <div className="flex justify-end">
        <Link to="/pops/mobizone/search?focus=product">
          <MzSecondaryButton>Universal Search</MzSecondaryButton>
        </Link>
      </div>
      {editing && !editing.returnedAt ? (
        <EditModalShell title="Edit sale voucher" onClose={() => setEditing(null)}>
          <SaleEditForm
            sale={editing}
            bankAccounts={db.bankAccounts}
            onCancel={() => setEditing(null)}
            onSaved={saveSaleEdit}
          />
        </EditModalShell>
      ) : null}
      <div className="space-y-3 md:hidden">
        {sales.length === 0 ? <p className={`text-sm ${mutedClass}`}>No sales in this date range.</p> : null}
        {sales.map((s) => (
          <article key={s.id} className={`${cardClass} space-y-2 p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {s.brand} {s.model}
                  {s.returnedAt ? " · RETURNED" : ""}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {s.customerName} · {s.imei}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatPkr(s.pricePkr)}</p>
            </div>
            <p className={`text-xs ${mutedClass}`}>
              Cash {formatPkr(s.payment.cashPkr || 0)} · Bank {formatPkr(s.payment.bankPkr || 0)} · Due{" "}
              {formatPkr(s.remainingPkr)}
              {s.warrantyDays ? ` · Warranty ${s.warrantyDays}d` : ""}
              {s.batteryHealth ? ` · Battery ${s.batteryHealth}` : ""}
            </p>
            {s.note ? <p className={`text-xs ${mutedClass}`}>Note: {s.note}</p> : null}
            <div className="flex flex-wrap gap-2">
              {!s.returnedAt ? (
                <MzSecondaryButton onClick={() => setEditing(s)}>Edit</MzSecondaryButton>
              ) : null}
              <MzSecondaryButton onClick={() => branchCode && printSaleReceipt(s, branchCode)}>
                Print bill
              </MzSecondaryButton>
              <MzSecondaryButton onClick={() => openWhatsApp(s.customerPhone, buildWhatsAppSaleText(s))}>
                WhatsApp
              </MzSecondaryButton>
              <UniversalHistoryLink imei={s.imei} customerHint={s.customerName} />
              {!s.returnedAt ? (
                <MzSecondaryButton onClick={() => onReturn(s.id)}>Return to stock</MzSecondaryButton>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <div className={`hidden md:block ${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
            <tr>
              <th className="px-4 py-3">Sale</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {s.brand} {s.model}
                    {s.returnedAt ? " (returned)" : ""}
                  </div>
                  <div className={`text-xs ${mutedClass}`}>
                    {s.customerName} · {s.imei}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold">{formatPkr(s.pricePkr)}</td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>
                  Cash {formatPkr(s.payment.cashPkr || 0)} · Bank {formatPkr(s.payment.bankPkr || 0)} · Due{" "}
                  {formatPkr(s.remainingPkr)}
                  {s.warrantyDays ? ` · W ${s.warrantyDays}d` : ""}
                  {s.batteryHealth ? ` · Bat ${s.batteryHealth}` : ""}
                  {s.note ? ` · Note: ${s.note}` : ""}
                </td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>{new Date(s.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {!s.returnedAt ? (
                      <MzSecondaryButton onClick={() => setEditing(s)}>Edit</MzSecondaryButton>
                    ) : null}
                    <MzSecondaryButton onClick={() => branchCode && printSaleReceipt(s, branchCode)}>
                      Print
                    </MzSecondaryButton>
                    <MzSecondaryButton onClick={() => openWhatsApp(s.customerPhone, buildWhatsAppSaleText(s))}>
                      WhatsApp
                    </MzSecondaryButton>
                    <UniversalHistoryLink imei={s.imei} customerHint={s.customerName} />
                    {!s.returnedAt ? (
                      <MzSecondaryButton onClick={() => onReturn(s.id)}>Return</MzSecondaryButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${mutedClass}`}>
                  No sales in this date range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </MzPage>
  );
}

export function MobizonePurchasesHistoryPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [editing, setEditing] = useState<MobizonePurchase | null>(null);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const purchases = useMemo(
    () => filterByDateRange(db.purchases, fromDate || null, toDate || null),
    [db.purchases, fromDate, toDate],
  );

  function onReturn(purchaseId: string): void {
    if (!branchCode) return;
    if (!window.confirm("Return this phone to seller? Paid amount will be logged as received back.")) return;
    try {
      returnPurchase(branchCode, purchaseId, "Seller return");
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Return failed");
    }
  }

  function savePurchaseEdit(input: UpdatePurchaseInput): void {
    if (!branchCode || !editing) return;
    try {
      updatePurchase(branchCode, editing.id, input);
      setEditing(null);
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Edit failed");
    }
  }

  return (
    <MzPage>
      <PageHeader title="Purchase history" subtitle="Bought phones — edit voucher, print, or return to seller." />
      <MzSection title="Date filter">
        <MzDateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />
      </MzSection>
      <div className="flex justify-end">
        <Link to="/pops/mobizone/search?focus=product">
          <MzSecondaryButton>Universal Search</MzSecondaryButton>
        </Link>
      </div>
      {editing && !editing.returnedAt ? (
        <EditModalShell title="Edit purchase voucher" onClose={() => setEditing(null)}>
          <PurchaseEditForm
            purchase={editing}
            bankAccounts={db.bankAccounts}
            onCancel={() => setEditing(null)}
            onSaved={savePurchaseEdit}
          />
        </EditModalShell>
      ) : null}
      <div className="space-y-3 md:hidden">
        {purchases.length === 0 ? <p className={`text-sm ${mutedClass}`}>No purchases in this date range.</p> : null}
        {purchases.map((p) => {
          const device = db.devices.find((d) => d.id === p.deviceId);
          const canReturn = !p.returnedAt && device?.status === "in_stock";
          return (
          <article key={p.id} className={`${cardClass} space-y-2 p-3`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {p.brand} {p.model}
                    {p.returnedAt ? " · RETURNED" : ""}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {p.sellerName} · {p.imei}
                </p>
              </div>
              <p className="font-semibold">{formatPkr(p.purchasePricePkr)}</p>
            </div>
            <p className={`text-xs ${mutedClass}`}>
                Paid {formatPkr(p.paidPkr || 0)} · Credit {formatPkr(p.remainingPkr || 0)}
                {p.batteryHealth ? ` · Battery ${p.batteryHealth}` : ""}
            </p>
              {p.note ? <p className={`text-xs ${mutedClass}`}>Note: {p.note}</p> : null}
            <div className="flex flex-wrap gap-2">
                {!p.returnedAt ? (
                  <MzSecondaryButton onClick={() => setEditing(p)}>Edit</MzSecondaryButton>
                ) : null}
              <MzSecondaryButton onClick={() => printPurchaseReceipt(p, branchCode ?? undefined)}>
                Print bill
              </MzSecondaryButton>
              <MzSecondaryButton onClick={() => openWhatsApp(p.sellerPhone, buildWhatsAppPurchaseText(p))}>
                WhatsApp
              </MzSecondaryButton>
              <UniversalHistoryLink imei={p.imei} customerHint={p.sellerName} />
                {canReturn ? (
                  <MzSecondaryButton onClick={() => onReturn(p.id)}>Return to seller</MzSecondaryButton>
                ) : null}
            </div>
          </article>
          );
        })}
      </div>
      <div className={`hidden md:block ${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
            <tr>
              <th className="px-4 py-3">Purchase</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const device = db.devices.find((d) => d.id === p.deviceId);
              const canReturn = !p.returnedAt && device?.status === "in_stock";
              return (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {p.brand} {p.model}
                      {p.returnedAt ? " (returned)" : ""}
                  </div>
                  <div className={`text-xs ${mutedClass}`}>
                    {p.sellerName} · {p.imei}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">{formatPkr(p.purchasePricePkr)}</td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>
                    Cash {formatPkr(p.payment.cashPkr || 0)} · Bank {formatPkr(p.payment.bankPkr || 0)} · Credit{" "}
                  {formatPkr(p.remainingPkr || 0)}
                    {p.batteryHealth ? ` · Bat ${p.batteryHealth}` : ""}
                    {p.note ? ` · Note: ${p.note}` : ""}
                </td>
                <td className={`px-4 py-3 text-xs ${mutedClass}`}>{new Date(p.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                      {!p.returnedAt ? (
                        <MzSecondaryButton onClick={() => setEditing(p)}>Edit</MzSecondaryButton>
                      ) : null}
                    <MzSecondaryButton onClick={() => printPurchaseReceipt(p, branchCode ?? undefined)}>
                      Print
                    </MzSecondaryButton>
                    <MzSecondaryButton onClick={() => openWhatsApp(p.sellerPhone, buildWhatsAppPurchaseText(p))}>
                      WhatsApp
                    </MzSecondaryButton>
                    <UniversalHistoryLink imei={p.imei} customerHint={p.sellerName} />
                      {canReturn ? (
                        <MzSecondaryButton onClick={() => onReturn(p.id)}>Return</MzSecondaryButton>
                      ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${mutedClass}`}>
                  No purchases in this date range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </MzPage>
  );
}
