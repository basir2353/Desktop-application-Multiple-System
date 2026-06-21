import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EXPENSE_CATEGORIES } from "@platform/contracts";
import { approveExpense, createExpense, fetchExpenses } from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
  useInvalidateAccounting,
} from "../../../hooks/useAccounting";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function ExpensesPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const invalidateAccounting = useInvalidateAccounting();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");

  const expensesQuery = useQuery({
    queryKey: ["accounting", "expenses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchExpenses(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      invalidateAccounting();
      setAmount("");
      setVendor("");
      setDescription("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveExpense,
    onSuccess: () => invalidateAccounting(),
  });

  if (expensesQuery.isLoading) return <AccountingLoading />;
  if (expensesQuery.isError) return <AccountingError message={(expensesQuery.error as Error).message} />;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <PageHeader title="Expense management" subtitle="Add expenses, approve, and post to the ledger." />

      {canManage ? (
        <AccountingFormPanel
          title="Add expense"
          submitLabel="Submit for approval"
          disabled={createMutation.isPending || !amount}
          onSubmit={() => {
            if (!branch?.code || !amount) return;
            createMutation.mutate({
              branchCode: branch.code,
              category: category as (typeof EXPENSE_CATEGORIES)[number],
              amount: Number(amount),
              expenseDate: today,
              vendor: vendor || undefined,
              description: description || undefined,
              recurring: false,
            });
          }}
        >
          <select className={accountingInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className={accountingInputClass} placeholder="Amount (PKR)" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
          <input className={accountingInputClass} placeholder="Vendor (optional)" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <input className={accountingInputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </AccountingFormPanel>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.expenseRef)}
          columns={[
            { key: "expenseRef", header: "Ref" },
            { key: "expenseDate", header: "Date" },
            { key: "category", header: "Category" },
            { key: "amount", header: "Amount", render: (r) => formatPkr(Number(r.amount)) },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "Approved" ? "success" : r.status === "Pending" ? "warning" : "info"}>
                  {String(r.status)}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage && r.status === "Pending" ? (
                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                    onClick={() => approveMutation.mutate(String(r.id))}
                  >
                    Approve
                  </button>
                ) : null,
            },
          ]}
          rows={expensesQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
