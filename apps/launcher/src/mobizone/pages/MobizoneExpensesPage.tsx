import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  filterByDateRange,
  formatPkr,
  monthStartDateInput,
  recordExpense,
  seedExpenseAccounts,
  todayDateInput,
} from "../lib/mobizoneStore";
import {
  MzDateRangeFilter,
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
  MzTextArea,
} from "../ui/MobizoneUi";

export function MobizoneExpensesPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentAccount, setPaymentAccount] = useState<"cash" | string>("cash");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [note, setNote] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!branchCode) return;
    seedExpenseAccounts(branchCode);
    refresh();
  }, [branchCode, refresh]);

  const accounts = db.expenseAccounts ?? [];
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const filtered = useMemo(() => {
    let rows = filterByDateRange(db.expenses ?? [], fromDate || null, toDate || null);
    if (filterAccountId) {
      const name = (accounts.find((a) => a.id === filterAccountId)?.name ?? "").toLowerCase();
      rows = rows.filter(
        (x) => x.accountId === filterAccountId || x.title.toLowerCase() === name,
      );
    }
    return rows;
  }, [db.expenses, filterAccountId, accounts, fromDate, toDate]);

  const total = filtered.reduce((a, x) => a + x.amountPkr, 0);
  const filterLabel = filterAccountId
    ? accounts.find((a) => a.id === filterAccountId)?.name ?? "Account"
    : "All accounts";

  function onPaymentAccountChange(value: string): void {
    setPaymentAccount(value);
    if (value === "cash") setMethod("cash");
    else setMethod("bank");
  }

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) return;
    if (!accountId) {
      setErr("Select an expense account.");
      return;
    }
    if (method === "bank" && (paymentAccount === "cash" || !paymentAccount)) {
      setErr("Select the bank account money was paid from.");
      return;
    }
    try {
      recordExpense(branchCode, {
        accountId,
        amountPkr: Number(amount),
        method,
        bankAccountId: method === "bank" ? paymentAccount : null,
        note: note || null,
      });
      refresh();
      setMsg("Expense saved.");
      setAmount("");
      setNote("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save expense.");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Create Expense"
        subtitle="Record shop costs by expense account (Rent, Electricity, Food…). The account name is used as the title."
      />
      <p className={`text-sm ${mutedClass}`}>
        Manage categories on{" "}
        <Link className="font-medium text-teal-700 underline dark:text-teal-400" to="/pops/mobizone/expense-accounts">
          Account Expense
        </Link>
        .
      </p>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

      <MzSection title="New expense">
        <div className="grid gap-3 sm:grid-cols-2">
          <MzField label="Expense account *">
            <MzSelect value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </MzSelect>
            {selectedAccount ? (
              <p className={`mt-1 text-xs ${mutedClass}`}>Title will be: {selectedAccount.name}</p>
            ) : null}
          </MzField>
          <MzField label="Amount (PKR) *">
            <MzInput type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </MzField>
          <MzField label="Payment account *">
            <MzSelect value={paymentAccount} onChange={(e) => onPaymentAccountChange(e.target.value)}>
              <option value="cash">Cash on hand</option>
              {db.bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} — {a.accountTitle}
                </option>
              ))}
            </MzSelect>
          </MzField>
          <MzField label="Payment mode *">
            <MzSelect
              value={method}
              onChange={(e) => {
                const next = e.target.value as "cash" | "bank";
                setMethod(next);
                if (next === "cash") setPaymentAccount("cash");
              }}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </MzSelect>
          </MzField>
        </div>
        <MzField label="Note (optional)">
          <MzTextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bill number, month, etc." />
        </MzField>
        <MzStickyActions>
          <MzPrimaryButton onClick={onSave}>Save expense</MzPrimaryButton>
        </MzStickyActions>
      </MzSection>

      <MzSection title={`Expense history · ${filterLabel} · ${formatPkr(total)}`}>
        <MzDateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />
        <MzField label="Search by expense account">
          <MzSelect value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </MzSelect>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Choose an account (e.g. Electricity) and use This year to see all bills in the range.
          </p>
        </MzField>
        <ul className="mt-3 space-y-2 text-sm">
          {filtered.length === 0 ? (
            <li className={mutedClass}>No expenses for this filter.</li>
          ) : (
            filtered.map((x) => {
              const bank =
                x.method === "bank" && x.bankAccountId
                  ? db.bankAccounts.find((b) => b.id === x.bankAccountId)
                  : null;
              return (
                <li
                  key={x.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{x.title}</p>
                    <p className={`text-xs ${mutedClass}`}>
                      {x.method === "cash" ? "Cash" : bank ? `${bank.bankName} — ${bank.accountTitle}` : "Bank"} ·{" "}
                      {new Date(x.createdAt).toLocaleString()}
                      {x.note ? ` · ${x.note}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-rose-600">{formatPkr(x.amountPkr)}</p>
                </li>
              );
            })
          )}
        </ul>
      </MzSection>
    </MzPage>
  );
}
