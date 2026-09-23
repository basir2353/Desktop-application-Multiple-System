import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createTradeFlowPayment,
  fetchTradeFlowCustomers,
  fetchTradeFlowPayments,
  fetchTradeFlowSuppliers,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";

export function TradeFlowPaymentsPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [partyId, setPartyId] = useState("");
  const [kind, setKind] = useState<"receive" | "pay">("receive");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["tradeflow", "customers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowCustomers(branch!.code) });
  const suppliers = useQuery({ queryKey: ["tradeflow", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowSuppliers(branch!.code) });
  const rows = useQuery({ queryKey: ["tradeflow", "payments", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowPayments(branch!.code) });
  const parties = partyType === "customer" ? (customers.data ?? []).filter((c) => !c.isCash) : (suppliers.data ?? []);
  const selected = parties.find((p) => p.id === partyId);
  const create = useMutation({
    mutationFn: () =>
      createTradeFlowPayment({
        branchCode: branch!.code,
        partyType,
        partyId,
        kind: partyType === "customer" ? "receive" : kind,
        amountPkr: Number(amount),
        notes,
      }),
    onSuccess: (row) => {
      invalidate();
      setAmount("");
      setNotes("");
      setNotice(`${row.kind === "pay" ? "Payment" : "Receipt"} ${formatPkr(row.amountPkr)} saved for ${row.partyName}`);
    },
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Payments" subtitle="Receive from a customer or pay a supplier. Closing balance updates immediately." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {create.error ? <div className={noticeErrorClass}>{(create.error as Error).message}</div> : null}
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-6">
        <TfField label="Payment type">
          <select className={tfInputClass} value={partyType} onChange={(e) => { setPartyType(e.target.value as "customer" | "supplier"); setPartyId(""); setKind(e.target.value === "supplier" ? "pay" : "receive"); }}>
            <option value="customer">Customer receipt</option>
            <option value="supplier">Supplier payment</option>
          </select>
        </TfField>
        <div className="lg:col-span-2">
          <TfField label="Party">
            <select className={tfInputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">Select party</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatPkr(p.closingBalancePkr)}</option>)}
            </select>
          </TfField>
        </div>
        {partyType === "supplier" ? (
          <TfField label="Action">
            <select className={tfInputClass} value={kind} onChange={(e) => setKind(e.target.value as "receive" | "pay")}>
              <option value="pay">Pay supplier</option>
              <option value="receive">Adjust receive</option>
            </select>
          </TfField>
        ) : (
          <TfField label="Action">
            <div className="flex h-[42px] items-center rounded-lg bg-slate-50 px-3 text-sm dark:bg-slate-800/60">Receive</div>
          </TfField>
        )}
        <TfField label="Amount Rs">
          <input className={tfInputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!partyId || !Number(amount) || create.isPending} onClick={() => create.mutate()} className={tfPrimaryBtn}>
            Save
          </button>
        </div>
        <div className="sm:col-span-2 lg:col-span-6">
          <TfField label="Narration / reference">
            <input className={tfInputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
          </TfField>
        </div>
      </section>
      {selected ? <p className="text-sm text-slate-500">Current closing balance {formatPkr(selected.closingBalancePkr)}</p> : null}
      <table className="min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Party</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {(rows.data ?? []).length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No payments yet.</td></tr>
          ) : null}
          {(rows.data ?? []).map((p) => (
            <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{new Date(p.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">{p.partyName} · {p.partyType}</td>
              <td className="px-3 py-2 capitalize">{p.kind}</td>
              <td className="px-3 py-2">{formatPkr(p.amountPkr)}</td>
              <td className="px-3 py-2">{p.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
