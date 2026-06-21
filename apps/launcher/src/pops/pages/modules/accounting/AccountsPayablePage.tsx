import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVendorBills, payVendorBill } from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading } from "./AccountingUi";

export function AccountsPayablePage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [payBillId, setPayBillId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const billsQuery = useQuery({
    queryKey: ["accounting", "payable", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchVendorBills(branch!.code),
  });

  const payMutation = useMutation({
    mutationFn: ({ billId, amount }: { billId: string; amount: number }) =>
      payVendorBill(billId, {
        amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: "bank",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setPayBillId("");
      setPayAmount("");
    },
  });

  if (billsQuery.isLoading) return <AccountingLoading />;
  if (billsQuery.isError) return <AccountingError message={(billsQuery.error as Error).message} />;

  const openBills = billsQuery.data!.filter((b) => b.balance > 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Accounts payable" subtitle="Money the restaurant owes to suppliers." />

      {canManage && openBills.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Record payment</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select className={accountingInputClass} value={payBillId} onChange={(e) => setPayBillId(e.target.value)}>
              <option value="">Select bill…</option>
              {openBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.billRef} — {b.supplierName} ({formatPkr(b.balance)})
                </option>
              ))}
            </select>
            <input className={accountingInputClass} placeholder="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <button
              type="button"
              disabled={!payBillId || !payAmount || payMutation.isPending}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => payMutation.mutate({ billId: payBillId, amount: Number(payAmount) })}
            >
              Pay
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.billRef)}
          columns={[
            { key: "billRef", header: "Bill" },
            { key: "supplierName", header: "Supplier" },
            { key: "dueDate", header: "Due", render: (r) => String(r.dueDate ?? "—") },
            { key: "amount", header: "Amount", render: (r) => formatPkr(Number(r.amount)) },
            { key: "balance", header: "Balance", render: (r) => formatPkr(Number(r.balance)) },
            { key: "status", header: "Status" },
          ]}
          rows={billsQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
