import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, seedExpenseAccounts, upsertExpenseAccount } from "../lib/mobizoneStore";
import {
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSection,
  MzStickyActions,
  MzTextArea,
} from "../ui/MobizoneUi";

export function MobizoneExpenseAccountsPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!branchCode) return;
    seedExpenseAccounts(branchCode);
    refresh();
  }, [branchCode, refresh]);

  const accounts = db.expenseAccounts ?? [];
  const expenses = db.expenses ?? [];

  function spendFor(accountId: string, accountName: string): number {
    return expenses
      .filter(
        (x) =>
          x.accountId === accountId || x.title.toLowerCase() === accountName.toLowerCase(),
      )
      .reduce((a, x) => a + x.amountPkr, 0);
  }

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) return;
    try {
      upsertExpenseAccount(branchCode, {
        id: editId ?? undefined,
        name,
        notes: notes || null,
      });
      refresh();
      setMsg(editId ? "Expense account updated." : "Expense account created.");
      setName("");
      setNotes("");
      setEditId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save account.");
    }
  }

  function startEdit(id: string): void {
    const row = accounts.find((a) => a.id === id);
    if (!row) return;
    setEditId(row.id);
    setName(row.name);
    setNotes(row.notes ?? "");
    setMsg(null);
    setErr(null);
  }

  return (
    <MzPage>
      <PageHeader
        title="Account Expense"
        subtitle="Create expense categories such as Rent, Electricity, Food, Salary, or Courier. Use them when you create expenses."
      />
      <p className={`text-sm ${mutedClass}`}>
        Record payments on{" "}
        <Link className="font-medium text-teal-700 underline dark:text-teal-400" to="/pops/mobizone/expenses">
          Create Expense
        </Link>
        .
      </p>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

      <MzSection title={editId ? "Edit expense account" : "New expense account"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <MzField label="Account name *">
            <MzInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rent, Electricity, Food"
            />
          </MzField>
          <MzField label="Notes (optional)">
            <MzTextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details" />
          </MzField>
        </div>
        <MzStickyActions>
          <MzPrimaryButton onClick={onSave}>{editId ? "Update account" : "Save account"}</MzPrimaryButton>
          {editId ? (
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
              onClick={() => {
                setEditId(null);
                setName("");
                setNotes("");
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </MzStickyActions>
      </MzSection>

      <MzSection title={`Expense accounts · ${accounts.length}`}>
        <ul className="space-y-2 text-sm">
          {accounts.length === 0 ? (
            <li className={mutedClass}>No expense accounts yet.</li>
          ) : (
            accounts.map((a) => {
              const spent = spendFor(a.id, a.name);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{a.name}</p>
                    <p className={`text-xs ${mutedClass}`}>
                      Total spent: {formatPkr(spent)}
                      {a.notes ? ` · ${a.notes}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-teal-700 dark:text-teal-400"
                    onClick={() => startEdit(a.id)}
                  >
                    Edit
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </MzSection>
    </MzPage>
  );
}
