import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomerInvoice,
  fetchCustomerInvoices,
  payCustomerInvoice,
} from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function AccountsReceivablePage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const invoicesQuery = useQuery({
    queryKey: ["accounting", "receivable", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCustomerInvoices(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createCustomerInvoice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setCustomerName("");
      setAmount("");
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ invoiceId, amount: amt }: { invoiceId: string; amount: number }) =>
      payCustomerInvoice(invoiceId, {
        amount: amt,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: "cash",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setPayInvoiceId("");
      setPayAmount("");
    },
  });

  if (invoicesQuery.isLoading) return <AccountingLoading />;
  if (invoicesQuery.isError) return <AccountingError message={(invoicesQuery.error as Error).message} />;

  const openInvoices = invoicesQuery.data!.filter((i) => i.balance > 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Accounts receivable" subtitle="Corporate orders and pending customer payments." />

      {canManage ? (
        <AccountingFormPanel
          title="Create invoice"
          submitLabel="Generate invoice"
          disabled={createMutation.isPending || !customerName || !amount}
          onSubmit={() => {
            if (!branch?.code) return;
            createMutation.mutate({
              branchCode: branch.code,
              customerName,
              amount: Number(amount),
            });
          }}
        >
          <input className={accountingInputClass} placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className={accountingInputClass} placeholder="Amount (PKR)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </AccountingFormPanel>
      ) : null}

      {canManage && openInvoices.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Record payment</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select className={accountingInputClass} value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)}>
              <option value="">Select invoice…</option>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceRef} — {i.customerName} ({formatPkr(i.balance)})
                </option>
              ))}
            </select>
            <input className={accountingInputClass} placeholder="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <button
              type="button"
              disabled={!payInvoiceId || !payAmount || payMutation.isPending}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => payMutation.mutate({ invoiceId: payInvoiceId, amount: Number(payAmount) })}
            >
              Receive payment
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.invoiceRef)}
          columns={[
            { key: "invoiceRef", header: "Invoice" },
            { key: "customerName", header: "Customer" },
            { key: "amount", header: "Amount", render: (r) => formatPkr(Number(r.amount)) },
            { key: "balance", header: "Balance", render: (r) => formatPkr(Number(r.balance)) },
            { key: "status", header: "Status" },
            { key: "dueDate", header: "Due", render: (r) => String(r.dueDate ?? "—") },
          ]}
          rows={invoicesQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
