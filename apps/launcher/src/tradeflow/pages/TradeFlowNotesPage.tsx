import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";
import { createTradeFlowNote, fetchTradeFlowCustomers, fetchTradeFlowNotes, fetchTradeFlowSuppliers } from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { printTradeFlowSlip } from "../lib/printTradeFlowSlip";

export function TradeFlowNotesPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [kind, setKind] = useState<"credit" | "debit">("credit");
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["tradeflow", "customers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowCustomers(branch!.code) });
  const suppliers = useQuery({ queryKey: ["tradeflow", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowSuppliers(branch!.code) });
  const rows = useQuery({ queryKey: ["tradeflow", "notes", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowNotes(branch!.code) });
  const parties = partyType === "customer" ? (customers.data ?? []).filter((c) => !c.isCash) : (suppliers.data ?? []);
  const create = useMutation({
    mutationFn: () => createTradeFlowNote({ branchCode: branch!.code, kind, partyType, partyId, amountPkr: Number(amount), notes }),
    onSuccess: () => {
      invalidate();
      setNotice(`${kind === "credit" ? "Credit" : "Debit"} note saved`);
    },
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Credit / Debit" subtitle="Adjust a customer or supplier balance without a full invoice." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-5">
        <TfField label="Note type">
          <select className={tfInputClass} value={kind} onChange={(e) => setKind(e.target.value as "credit" | "debit")}>
            <option value="credit">Credit note</option>
            <option value="debit">Debit note</option>
          </select>
        </TfField>
        <TfField label="Party type">
          <select className={tfInputClass} value={partyType} onChange={(e) => { setPartyType(e.target.value as "customer" | "supplier"); setPartyId(""); }}>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
          </select>
        </TfField>
        <TfField label="Party">
          <select className={tfInputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Select party</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </TfField>
        <TfField label="Amount Rs">
          <input className={tfInputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!partyId || !Number(amount) || create.isPending} onClick={() => create.mutate()} className={tfPrimaryBtn}>Save note</button>
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <TfField label="Narration">
            <input className={tfInputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for this note" />
          </TfField>
        </div>
      </div>
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Notes</th><th className="px-3 py-2" /></tr></thead>
        <tbody>
          {(rows.data ?? []).map((n) => (
            <tr key={n.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2 capitalize">{n.kind} note</td>
              <td className="px-3 py-2">{n.partyName}</td>
              <td className="px-3 py-2">{formatPkr(n.amountPkr)}</td>
              <td className="px-3 py-2">{n.notes ?? "—"}</td>
              <td className="px-3 py-2">
                <button type="button" className="text-violet-700" onClick={() => printTradeFlowSlip(`${n.kind === "credit" ? "Credit" : "Debit"} note`, [["Party", n.partyName], ["Amount", formatPkr(n.amountPkr)], ["Notes", n.notes ?? ""], ["Date", new Date(n.createdAt).toLocaleString()]])}>Print</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
