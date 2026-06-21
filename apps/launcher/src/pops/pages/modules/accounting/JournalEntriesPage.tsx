import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createJournalEntry, fetchAccounts, fetchJournal } from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function JournalEntriesPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [amount, setAmount] = useState("");

  const journalQuery = useQuery({
    queryKey: ["accounting", "journal", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchJournal(branch!.code),
  });

  const accountsQuery = useQuery({
    queryKey: ["accounting", "accounts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccounts(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setDescription("");
      setAmount("");
    },
  });

  if (journalQuery.isLoading) return <AccountingLoading />;
  if (journalQuery.isError) return <AccountingError message={(journalQuery.error as Error).message} />;

  const today = new Date().toISOString().slice(0, 10);
  const flatLines = journalQuery.data!.flatMap((e) =>
    e.lines.map((l) => ({
      entryRef: e.entryRef,
      entryDate: e.entryDate,
      account: `${l.accountCode} ${l.accountName}`,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo ?? e.description,
    })),
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Journal entries" subtitle="Manual entries, adjustments, and corrections." />

      {canManage && accountsQuery.data ? (
        <AccountingFormPanel
          title="Manual journal entry"
          submitLabel="Post entry"
          disabled={createMutation.isPending || !description || !amount || !debitAccountId || !creditAccountId}
          onSubmit={() => {
            if (!branch?.code) return;
            const amt = Number(amount);
            createMutation.mutate({
              branchCode: branch.code,
              entryDate: today,
              description,
              lines: [
                { accountId: debitAccountId, debit: amt, credit: 0 },
                { accountId: creditAccountId, debit: 0, credit: amt },
              ],
            });
          }}
        >
          <input className={accountingInputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className={accountingInputClass} placeholder="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select className={accountingInputClass} value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}>
            <option value="">Debit account…</option>
            {accountsQuery.data.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          <select className={accountingInputClass} value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)}>
            <option value="">Credit account…</option>
            {accountsQuery.data.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </AccountingFormPanel>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => `${String(r.entryRef)}-${String(r.account)}-${String(r.debit)}-${String(r.credit)}`}
          columns={[
            { key: "entryRef", header: "Ref" },
            { key: "entryDate", header: "Date" },
            { key: "account", header: "Account" },
            { key: "debit", header: "Debit", render: (r) => (Number(r.debit) ? formatPkr(Number(r.debit)) : "—") },
            { key: "credit", header: "Credit", render: (r) => (Number(r.credit) ? formatPkr(Number(r.credit)) : "—") },
            { key: "memo", header: "Memo" },
          ]}
          rows={flatLines as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
