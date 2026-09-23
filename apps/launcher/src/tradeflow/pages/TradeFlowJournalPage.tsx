import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";
import { createTradeFlowJournal, fetchTradeFlowAccounts, fetchTradeFlowJournal } from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { printTradeFlowSlip } from "../lib/printTradeFlowSlip";

function printJournal(entry: { entryNo: string; debitAccountName: string; creditAccountName: string; amountPkr: number; narration: string | null; createdAt: string }) {
  printTradeFlowSlip(`Journal ${entry.entryNo}`, [
    ["Date", new Date(entry.createdAt).toLocaleString()],
    ["Debit", entry.debitAccountName],
    ["Credit", entry.creditAccountName],
    ["Amount", `Rs ${entry.amountPkr.toLocaleString()}`],
    ["Narration", entry.narration ?? ""],
  ]);
}

export function TradeFlowJournalPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [debitAccountId, setDebit] = useState("");
  const [creditAccountId, setCredit] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const accounts = useQuery({ queryKey: ["tradeflow", "accounts", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowAccounts(branch!.code) });
  const rows = useQuery({ queryKey: ["tradeflow", "journal", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowJournal(branch!.code) });
  const create = useMutation({
    mutationFn: () => createTradeFlowJournal({ branchCode: branch!.code, debitAccountId, creditAccountId, amountPkr: Number(amount), narration }),
    onSuccess: (row) => {
      invalidate();
      setNotice("Journal entry saved");
      printJournal(row);
    },
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Journal" subtitle="Debit one account and credit another, then save or print." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-5">
        <TfField label="Debit account">
          <select className={tfInputClass} value={debitAccountId} onChange={(e) => setDebit(e.target.value)}>
            <option value="">Select debit</option>
            {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </TfField>
        <TfField label="Credit account">
          <select className={tfInputClass} value={creditAccountId} onChange={(e) => setCredit(e.target.value)}>
            <option value="">Select credit</option>
            {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </TfField>
        <TfField label="Amount Rs">
          <input className={tfInputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000" />
        </TfField>
        <TfField label="Narration">
          <input className={tfInputClass} value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Reason" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!debitAccountId || !creditAccountId || !Number(amount) || create.isPending} onClick={() => create.mutate()} className={tfPrimaryBtn}>Save & print</button>
        </div>
      </div>
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Entry</th><th className="px-3 py-2">Debit</th><th className="px-3 py-2">Credit</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2" /></tr></thead>
        <tbody>
          {(rows.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{r.entryNo}</td>
              <td className="px-3 py-2">{r.debitAccountName}</td>
              <td className="px-3 py-2">{r.creditAccountName}</td>
              <td className="px-3 py-2">{formatPkr(r.amountPkr)}</td>
              <td className="px-3 py-2"><button type="button" className="text-violet-700" onClick={() => printJournal(r)}>Print</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
