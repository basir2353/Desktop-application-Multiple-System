import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVendorPayableSummaries, payVendorSupplier } from "../../../api/accounting";
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
  const [supplierId, setSupplierId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank" | "card">("bank");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const payableQuery = useQuery({
    queryKey: ["accounting", "payable", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchVendorPayableSummaries(branch!.code),
  });

  const vendors = useMemo(
    () => (payableQuery.data ?? []).filter((v) => v.balance > 0),
    [payableQuery.data],
  );

  const selected = vendors.find((v) => v.supplierId === supplierId) ?? null;
  const grandTotal = vendors.reduce((sum, v) => sum + v.balance, 0);

  const payMutation = useMutation({
    mutationFn: () => {
      if (!branch?.code || !supplierId) throw new Error("Select a vendor");
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      if (selected && amount > selected.balance) {
        throw new Error(`Amount exceeds vendor balance (${formatPkr(selected.balance)})`);
      }
      return payVendorSupplier(supplierId, {
        branchCode: branch.code,
        amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        method,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setSupplierId("");
      setPayAmount("");
      setError(null);
      setNotice(
        selected
          ? `Payment recorded for ${selected.supplierName}. Balance updated.`
          : "Payment recorded. Balance updated.",
      );
    },
    onError: (err: Error) => {
      setNotice(null);
      setError(err.message);
    },
  });

  if (payableQuery.isLoading) return <AccountingLoading />;
  if (payableQuery.isError) return <AccountingError message={(payableQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts payable"
        subtitle="Vendor-wise totals — multiple purchases from one supplier show as one balance."
      />

      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? <AccountingError message={error} /> : null}

      {canManage && vendors.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Record payment</div>
          <p className="mt-1 text-[11px] text-slate-500">
            Select vendor and pay any amount against their total balance. Oldest bills are settled first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className={accountingInputClass}
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setPayAmount("");
                setNotice(null);
              }}
            >
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.supplierId} value={v.supplierId}>
                  {v.supplierName} · Balance {formatPkr(v.balance)} ({v.billCount} bill
                  {v.billCount === 1 ? "" : "s"})
                </option>
              ))}
            </select>
            <select
              className={accountingInputClass}
              value={method}
              onChange={(e) => setMethod(e.target.value as "cash" | "bank" | "card")}
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
            <input
              className={accountingInputClass}
              placeholder={selected ? `Max ${formatPkr(selected.balance)}` : "Amount"}
              type="number"
              min={1}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <button
              type="button"
              disabled={!supplierId || !payAmount || payMutation.isPending}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => payMutation.mutate()}
            >
              {payMutation.isPending ? "Paying…" : "Pay"}
            </button>
          </div>
          {selected ? (
            <p className="mt-2 text-[11px] text-amber-200/90">
              {selected.supplierName}: total due {formatPkr(selected.balance)} across {selected.billCount}{" "}
              purchase{selected.billCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-white">Vendor balances</div>
          <div className="text-sm font-semibold text-amber-200">
            Total payable {formatPkr(grandTotal)}
          </div>
        </div>
        {vendors.length === 0 ? (
          <p className="text-xs text-slate-500">No open vendor balances.</p>
        ) : (
          <SimpleTable
            rowKey={(r) => r.supplierId}
            columns={[
              { key: "supplierName", header: "Vendor" },
              {
                key: "billCount",
                header: "Purchases",
                render: (r) => `${r.billCount} bill${r.billCount === 1 ? "" : "s"}`,
              },
              { key: "amount", header: "Total billed", render: (r) => formatPkr(r.amount) },
              { key: "paid", header: "Paid", render: (r) => formatPkr(r.paid) },
              { key: "balance", header: "Balance due", render: (r) => formatPkr(r.balance) },
              { key: "status", header: "Status" },
            ]}
            rows={vendors}
          />
        )}
      </div>
    </div>
  );
}
