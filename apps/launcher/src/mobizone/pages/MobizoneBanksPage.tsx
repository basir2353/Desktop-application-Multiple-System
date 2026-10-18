import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, getCashBankBalances, upsertBankAccount } from "../lib/mobizoneStore";
import { MzField, MzInput, MzPrimaryButton, MzSection, MzTextArea } from "../ui/MobizoneUi";

export function MobizoneBanksPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const balances = getCashBankBalances(db);
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [opening, setOpening] = useState("0");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function onSave(): void {
    setErr(null);
    if (!branchCode) return;
    if (!bankName.trim() || !accountTitle.trim()) {
      setErr("Bank name and account title are required.");
      return;
    }
    upsertBankAccount(branchCode, {
      bankName,
      accountTitle,
      accountNumber: accountNumber || null,
      iban: iban || null,
      openingBalancePkr: Number(opening) || 0,
      notes: notes || null,
    });
    refresh();
    setBankName("");
    setAccountTitle("");
    setAccountNumber("");
    setIban("");
    setOpening("0");
    setNotes("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank accounts"
        subtitle="Add every account. Buy/Sell payments pick which account money left or entered — with IBAN and txn ref."
      />
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${cardClass} p-4`}>
          <p className={`text-xs uppercase ${mutedClass}`}>Cash on hand</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPkr(balances.cash)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={`text-xs uppercase ${mutedClass}`}>All banks total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPkr(balances.bank)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MzSection title="Add bank account">
          <div className="grid gap-3 sm:grid-cols-2">
            <MzField label="Bank name *">
              <MzInput value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HBL / JazzCash" />
            </MzField>
            <MzField label="Account title *">
              <MzInput value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} />
            </MzField>
            <MzField label="Account number">
              <MzInput value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </MzField>
            <MzField label="IBAN">
              <MzInput value={iban} onChange={(e) => setIban(e.target.value)} />
            </MzField>
            <MzField label="Opening balance (PKR)">
              <MzInput type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </MzField>
          </div>
          <MzField label="Notes">
            <MzTextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </MzField>
          <MzPrimaryButton onClick={onSave}>Save account</MzPrimaryButton>
        </MzSection>

        <MzSection title="Your accounts">
          <ul className="space-y-2">
            {db.bankAccounts.length === 0 ? (
              <li className={`text-sm ${mutedClass}`}>No bank accounts yet.</li>
            ) : (
              db.bankAccounts.map((a) => (
                <li key={a.id} className={`${cardClass} p-3`}>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {a.bankName} — {a.accountTitle}
                  </p>
                  <p className={`text-xs ${mutedClass}`}>
                    {a.accountNumber || "—"} · IBAN {a.iban || "—"}
                  </p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    Balance {formatPkr(balances.byAccount[a.id] ?? a.openingBalancePkr)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </MzSection>
      </div>
    </div>
  );
}
