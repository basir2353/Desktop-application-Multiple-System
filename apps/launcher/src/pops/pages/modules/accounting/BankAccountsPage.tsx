import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBankAccount,
  createBankTransaction,
  fetchBankAccounts,
  fetchBankTransactions,
} from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function BankAccountsPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [txnAccountId, setTxnAccountId] = useState("");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnType, setTxnType] = useState<"deposit" | "withdrawal">("deposit");

  const accountsQuery = useQuery({
    queryKey: ["accounting", "bank-accounts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBankAccounts(branch!.code),
  });

  const txnsQuery = useQuery({
    queryKey: ["accounting", "bank-transactions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBankTransactions(branch!.code),
  });

  const createAccountMutation = useMutation({
    mutationFn: createBankAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setName("");
      setBankName("");
      setOpeningBalance("0");
    },
  });

  const createTxnMutation = useMutation({
    mutationFn: createBankTransaction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setTxnAmount("");
    },
  });

  if (accountsQuery.isLoading) return <AccountingLoading />;
  if (accountsQuery.isError) return <AccountingError message={(accountsQuery.error as Error).message} />;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <PageHeader title="Bank accounts" subtitle="Multiple accounts, deposits, withdrawals, and transfers." />

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <AccountingFormPanel
            title="Add bank account"
            submitLabel="Create account"
            disabled={createAccountMutation.isPending || !name || !bankName}
            onSubmit={() => {
              if (!branch?.code) return;
              createAccountMutation.mutate({
                branchCode: branch.code,
                name,
                bankName,
                openingBalance: Number(openingBalance) || 0,
              });
            }}
          >
            <input className={accountingInputClass} placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={accountingInputClass} placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <input className={accountingInputClass} placeholder="Opening balance" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </AccountingFormPanel>

          <AccountingFormPanel
            title="Bank transaction"
            submitLabel="Post transaction"
            disabled={createTxnMutation.isPending || !txnAccountId || !txnAmount}
            onSubmit={() => {
              if (!branch?.code) return;
              createTxnMutation.mutate({
                branchCode: branch.code,
                bankAccountId: txnAccountId,
                type: txnType,
                amount: Number(txnAmount),
                txnDate: today,
              });
            }}
          >
            <select className={accountingInputClass} value={txnAccountId} onChange={(e) => setTxnAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {accountsQuery.data!.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select className={accountingInputClass} value={txnType} onChange={(e) => setTxnType(e.target.value as "deposit" | "withdrawal")}>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
            <input className={accountingInputClass} placeholder="Amount" type="number" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} />
          </AccountingFormPanel>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="mb-3 text-sm font-medium text-white">Accounts</div>
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "name", header: "Name" },
            { key: "bankName", header: "Bank" },
            { key: "balance", header: "Balance", render: (r) => formatPkr(Number(r.balance)) },
          ]}
          rows={accountsQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>

      {txnsQuery.data ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <div className="mb-3 text-sm font-medium text-white">Recent transactions</div>
          <SimpleTable
            rowKey={(r) => String(r.txnRef)}
            columns={[
              { key: "txnRef", header: "Ref" },
              { key: "txnDate", header: "Date" },
              { key: "bankAccountName", header: "Account" },
              { key: "type", header: "Type" },
              { key: "amount", header: "Amount", render: (r) => formatPkr(Number(r.amount)) },
            ]}
            rows={txnsQuery.data as unknown as Record<string, unknown>[]}
          />
        </div>
      ) : null}
    </div>
  );
}
