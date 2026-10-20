import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useSessionStore } from "../../stores/sessionStore";
import { useMobizoneDb } from "../hooks/useMobizone";
import { canEditMobizoneBillDate } from "../lib/mobizoneAccess";
import {
  filterByDateRange,
  formatPkr,
  monthStartDateInput,
  recordLedgerPayment,
  todayDateInput,
} from "../lib/mobizoneStore";
import {
  MzDateRangeFilter,
  MzField,
  MzInput,
  MzPrimaryButton,
  MzSection,
  MzSelect,
  MzTextArea,
} from "../ui/MobizoneUi";

export function MobizoneLedgerPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const claims = useSessionStore((s) => s.claims);
  const canSetEntryDate = canEditMobizoneBillDate(claims);
  const [partyKind, setPartyKind] = useState<"customer" | "shopkeeper">("customer");
  const [partyId, setPartyId] = useState("");
  const [direction, setDirection] = useState<"receive" | "pay">("receive");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [note, setNote] = useState("");
  const [applySaleId, setApplySaleId] = useState("");
  const [applyPurchaseId, setApplyPurchaseId] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateInput);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const parties = partyKind === "customer" ? db.customers : db.shopkeepers;
  const ledgerRows = useMemo(
    () => filterByDateRange(db.ledger, fromDate || null, toDate || null),
    [db.ledger, fromDate, toDate],
  );
  const openSales = useMemo(
    () => db.sales.filter((s) => s.remainingPkr > 0 && (!partyId || s.customerId === partyId || s.shopkeeperId === partyId)),
    [db.sales, partyId],
  );
  const openPurchases = useMemo(
    () =>
      db.purchases.filter(
        (p) => (p.remainingPkr || 0) > 0 && (!partyId || p.customerId === partyId || p.shopkeeperId === partyId),
      ),
    [db.purchases, partyId],
  );

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) return;
    try {
      const resolvedDate = canSetEntryDate ? entryDate || todayDateInput() : todayDateInput();
      recordLedgerPayment(branchCode, {
        partyKind,
        partyId,
        direction,
        amountPkr: Number(amount),
        method,
        bankAccountId: method === "bank" ? bankAccountId || null : null,
        txnRef: txnRef || null,
        note: note || null,
        applyToSaleId: direction === "receive" ? applySaleId || null : null,
        applyToPurchaseId: direction === "pay" ? applyPurchaseId || null : null,
        entryDate: resolvedDate,
      });
      refresh();
      setMsg("Ledger payment saved.");
      setAmount("");
      setTxnRef("");
      setNote("");
      setEntryDate(todayDateInput());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit & ledger"
        subtitle="Record partial payments, cash/bank, and clear remaining balances on sales or purchases."
      />
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <MzSection title="New payment">
          <div className="grid gap-3 sm:grid-cols-2">
            {canSetEntryDate ? (
              <MzField label="Date * (admin)">
                <MzInput
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="mz-date-input"
                />
              </MzField>
            ) : null}
            <MzField label="Party type">
              <MzSelect
                value={partyKind}
                onChange={(e) => {
                  setPartyKind(e.target.value as "customer" | "shopkeeper");
                  setPartyId("");
                }}
              >
                <option value="customer">Customer</option>
                <option value="shopkeeper">Shopkeeper</option>
              </MzSelect>
            </MzField>
            <MzField label="Party">
              <MzSelect value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">Select…</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {"shopNo" in p ? `Shop ${p.shopNo} — ${p.name}` : p.name}
                  </option>
                ))}
              </MzSelect>
            </MzField>
            <MzField label="Direction">
              <MzSelect value={direction} onChange={(e) => setDirection(e.target.value as "receive" | "pay")}>
                <option value="receive">Receive</option>
                <option value="pay">Pay</option>
              </MzSelect>
            </MzField>
            <MzField label="Amount (PKR)">
              <MzInput type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </MzField>
            <MzField label="Method">
              <MzSelect value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bank")}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </MzSelect>
            </MzField>
            <MzField label="Bank account">
              <MzSelect
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                disabled={method !== "bank"}
              >
                <option value="">Select…</option>
                {db.bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} — {a.accountTitle}
                  </option>
                ))}
              </MzSelect>
            </MzField>
            <MzField label="Txn reference">
              <MzInput value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
            </MzField>
            {direction === "receive" ? (
              <MzField label="Apply to open sale (optional)">
                <MzSelect value={applySaleId} onChange={(e) => setApplySaleId(e.target.value)}>
                  <option value="">—</option>
                  {openSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.customerName} · {s.imei} · due {formatPkr(s.remainingPkr)}
                    </option>
                  ))}
                </MzSelect>
              </MzField>
            ) : (
              <MzField label="Apply to open purchase (optional)">
                <MzSelect value={applyPurchaseId} onChange={(e) => setApplyPurchaseId(e.target.value)}>
                  <option value="">—</option>
                  {openPurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sellerName} · {p.imei} · due {formatPkr(p.remainingPkr || 0)}
                    </option>
                  ))}
                </MzSelect>
              </MzField>
            )}
          </div>
          <MzField label="Note">
            <MzTextArea value={note} onChange={(e) => setNote(e.target.value)} />
          </MzField>
          <MzPrimaryButton onClick={onSave} disabled={!partyId || !(Number(amount) > 0)}>
            Save ledger entry
          </MzPrimaryButton>
        </MzSection>

        <MzSection title={`Ledger history · ${ledgerRows.length}`}>
          <MzDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
            }}
          />
          <ul className="mt-3 max-h-[480px] space-y-2 overflow-y-auto text-sm">
            {ledgerRows.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <p className="font-medium text-slate-900 dark:text-white">
                  {e.direction === "receive" ? "+" : "−"}
                  {formatPkr(e.amountPkr)} · {e.partyName}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {e.method}
                  {e.bankName ? ` · ${e.bankName}` : ""} · {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
            {ledgerRows.length === 0 ? (
              <li className={mutedClass}>No ledger entries in this date range.</li>
            ) : null}
          </ul>
        </MzSection>
      </div>
    </div>
  );
}
