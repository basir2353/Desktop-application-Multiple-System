import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, recordExpense } from "../lib/mobizoneStore";
import {
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
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) return;
    try {
      recordExpense(branchCode, {
        title,
        amountPkr: Number(amount),
        method,
        bankAccountId: method === "bank" ? bankAccountId || null : null,
        note: note || null,
      });
      refresh();
      setMsg("Expense saved.");
      setTitle("");
      setAmount("");
      setNote("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save expense.");
    }
  }

  const total = (db.expenses ?? []).reduce((a, x) => a + x.amountPkr, 0);

  return (
    <MzPage>
      <PageHeader
        title="Shop expenses"
        subtitle="Rent, tea, courier, charger — shop costs so profit stays accurate."
      />
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

      <MzSection title="Add expense">
        <div className="grid gap-3 sm:grid-cols-2">
          <MzField label="Title *">
            <MzInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shop rent / tea / courier" />
          </MzField>
          <MzField label="Amount (PKR) *">
            <MzInput type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </MzField>
          <MzField label="Paid from">
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
        </div>
        <MzField label="Note">
          <MzTextArea value={note} onChange={(e) => setNote(e.target.value)} />
        </MzField>
        <MzStickyActions>
          <MzPrimaryButton onClick={onSave}>Save expense</MzPrimaryButton>
        </MzStickyActions>
      </MzSection>

      <MzSection title={`History · total ${formatPkr(total)}`}>
        <ul className="space-y-2 text-sm">
          {(db.expenses ?? []).length === 0 ? (
            <li className={mutedClass}>No expenses yet.</li>
          ) : (
            (db.expenses ?? []).map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{x.title}</p>
                  <p className={`text-xs ${mutedClass}`}>
                    {x.method} · {new Date(x.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-rose-600">{formatPkr(x.amountPkr)}</p>
              </li>
            ))
          )}
        </ul>
      </MzSection>
    </MzPage>
  );
}
