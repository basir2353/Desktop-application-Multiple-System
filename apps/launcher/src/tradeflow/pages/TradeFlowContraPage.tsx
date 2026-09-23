import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";
import { createTradeFlowContra, fetchTradeFlowAccounts, fetchTradeFlowContra } from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { printTradeFlowSlip } from "../lib/printTradeFlowSlip";

export function TradeFlowContraPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [fromAccountId, setFrom] = useState("");
  const [toAccountId, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("Cash to bank transfer");
  const [notice, setNotice] = useState<string | null>(null);
  const accounts = useQuery({ queryKey: ["tradeflow", "accounts", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowAccounts(branch!.code) });
  const rows = useQuery({ queryKey: ["tradeflow", "contra", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowContra(branch!.code) });
  const create = useMutation({
    mutationFn: () => createTradeFlowContra({ branchCode: branch!.code, fromAccountId, toAccountId, amountPkr: Number(amount), narration }),
    onSuccess: () => {
      invalidate();
      setNotice("Contra entry saved");
    },
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Contra" subtitle="Move money cash to bank, or from one bank to another." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-5">
        <TfField label="From account">
          <select className={tfInputClass} value={fromAccountId} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Select from</option>
            {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </TfField>
        <TfField label="To account">
          <select className={tfInputClass} value={toAccountId} onChange={(e) => setTo(e.target.value)}>
            <option value="">Select to</option>
            {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </TfField>
        <TfField label="Amount Rs">
          <input className={tfInputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" />
        </TfField>
        <TfField label="Narration">
          <input className={tfInputClass} value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Cash to bank transfer" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!fromAccountId || !toAccountId || !Number(amount) || create.isPending} onClick={() => create.mutate()} className={tfPrimaryBtn}>Transfer</button>
        </div>
      </div>
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Entry</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2" /></tr></thead>
        <tbody>
          {(rows.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{r.entryNo}</td>
              <td className="px-3 py-2">{r.fromAccountName}</td>
              <td className="px-3 py-2">{r.toAccountName}</td>
              <td className="px-3 py-2">{formatPkr(r.amountPkr)}</td>
              <td className="px-3 py-2">
                <button type="button" className="text-violet-700" onClick={() => printTradeFlowSlip(`Contra ${r.entryNo}`, [["From", r.fromAccountName], ["To", r.toAccountName], ["Amount", formatPkr(r.amountPkr)], ["Narration", r.narration ?? ""], ["Date", new Date(r.createdAt).toLocaleString()]])}>Print</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
