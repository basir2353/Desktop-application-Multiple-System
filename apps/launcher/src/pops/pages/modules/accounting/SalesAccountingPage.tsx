import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createJournalEntry, fetchAccounts, fetchSalesAccounting } from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading, StatCard } from "./AccountingUi";
import { AccountingFlowBanner } from "./AccountingFlowBanner";

export function SalesAccountingPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [returnAmount, setReturnAmount] = useState("");
  const [returnBillRef, setReturnBillRef] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [refundVia, setRefundVia] = useState<"cash" | "bank">("cash");

  const salesQuery = useQuery({
    queryKey: ["accounting", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchSalesAccounting(branch!.code),
  });

  const accountsQuery = useQuery({
    queryKey: ["accounting", "accounts", branch?.code],
    enabled: Boolean(branch?.code) && canManage,
    queryFn: () => fetchAccounts(branch!.code),
  });

  const returnMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setReturnAmount("");
      setReturnBillRef("");
      setReturnNote("");
    },
  });

  const accountIds = useMemo(() => {
    const rows = accountsQuery.data ?? [];
    const byCode = (code: string) => rows.find((a) => a.code === code)?.id ?? "";
    return {
      salesReturns: byCode("4106") || byCode("4105"),
      cash: byCode("1101"),
      bank: byCode("1102"),
    };
  }, [accountsQuery.data]);

  if (salesQuery.isLoading) return <AccountingLoading />;
  if (salesQuery.isError) return <AccountingError message={(salesQuery.error as Error).message} />;

  const s = salesQuery.data!;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales accounting"
        subtitle="POS sales automatically create journal vouchers when bills are completed. Sales returns create a contra voucher."
      />
      <AccountingFlowBanner />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dine-in" value={formatPkr(s.dineIn)} />
        <StatCard label="Takeaway" value={formatPkr(s.takeaway)} />
        <StatCard label="Delivery" value={formatPkr(s.delivery)} />
        <StatCard label="Total sales" value={formatPkr(s.totalSales)} />
        <StatCard label="Discounts" value={formatPkr(s.discounts)} />
        <StatCard label="Service charges" value={formatPkr(s.serviceCharges)} />
        <StatCard label="Tax collected" value={formatPkr(s.taxCollected)} />
        <StatCard label="Void orders" value={String(s.voids)} />
      </div>

      {canManage ? (
        <AccountingFormPanel
          title="Sales return voucher"
          submitLabel="Post return voucher"
          disabled={
            returnMutation.isPending ||
            !returnAmount ||
            !accountIds.salesReturns ||
            !(refundVia === "cash" ? accountIds.cash : accountIds.bank)
          }
          onSubmit={() => {
            if (!branch?.code) return;
            const amt = Number(returnAmount);
            if (!(amt > 0)) return;
            const creditId = refundVia === "cash" ? accountIds.cash : accountIds.bank;
            const billBit = returnBillRef.trim() ? ` · Bill ${returnBillRef.trim()}` : "";
            const noteBit = returnNote.trim() ? ` — ${returnNote.trim()}` : "";
            returnMutation.mutate({
              branchCode: branch.code,
              entryDate: today,
              description: `Sales return${billBit}${noteBit}`,
              lines: [
                {
                  accountId: accountIds.salesReturns,
                  debit: amt,
                  credit: 0,
                  memo: "Sales return",
                },
                {
                  accountId: creditId,
                  debit: 0,
                  credit: amt,
                  memo: refundVia === "cash" ? "Cash refund" : "Bank refund",
                },
              ],
            });
          }}
        >
          <input
            className={accountingInputClass}
            placeholder="Return amount (PKR)"
            type="number"
            value={returnAmount}
            onChange={(e) => setReturnAmount(e.target.value)}
          />
          <input
            className={accountingInputClass}
            placeholder="Original bill ref (optional)"
            value={returnBillRef}
            onChange={(e) => setReturnBillRef(e.target.value)}
          />
          <input
            className={accountingInputClass}
            placeholder="Reason / note (optional)"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
          />
          <select
            className={accountingInputClass}
            value={refundVia}
            onChange={(e) => setRefundVia(e.target.value as "cash" | "bank")}
          >
            <option value="cash">Refund via Cash Register (1101)</option>
            <option value="bank">Refund via Bank (1102)</option>
          </select>
          <p className="text-[11px] text-slate-500">
            Posts Dr Sales Returns (4106) / Cr Cash or Bank. Expense &amp; purchase vouchers are created
            from Expenses and Goods Receiving; admin can also add heads under Chart of accounts.
          </p>
          {returnMutation.isError ? (
            <p className="text-xs text-red-400">{(returnMutation.error as Error).message}</p>
          ) : null}
          {returnMutation.isSuccess ? (
            <p className="text-xs text-emerald-400">Sales return voucher posted.</p>
          ) : null}
        </AccountingFormPanel>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="text-sm font-medium text-white">Recent POS bills</div>
        <SimpleTable
          rowKey={(r) => String(r.billRef)}
          columns={[
            { key: "billRef", header: "Bill" },
            { key: "tableLabel", header: "Table / type" },
            { key: "total", header: "Total", render: (r) => formatPkr(Number(r.total)) },
            { key: "status", header: "Status" },
            { key: "createdAt", header: "Date", render: (r) => new Date(String(r.createdAt)).toLocaleString() },
          ]}
          rows={s.recentSales as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
