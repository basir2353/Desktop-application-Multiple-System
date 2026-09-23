import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createTradeFlowReturn,
  fetchTradeFlowCustomers,
  fetchTradeFlowItems,
  fetchTradeFlowReturns,
  fetchTradeFlowSuppliers,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";

export function TradeFlowReturnsPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [kind, setKind] = useState<"sales" | "purchase">("sales");
  const [partyId, setPartyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["tradeflow", "customers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowCustomers(branch!.code) });
  const suppliers = useQuery({ queryKey: ["tradeflow", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowSuppliers(branch!.code) });
  const items = useQuery({ queryKey: ["tradeflow", "items", branch?.code, "returns"], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowItems(branch!.code) });
  const rows = useQuery({ queryKey: ["tradeflow", "returns", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowReturns(branch!.code) });
  const parties = kind === "sales" ? (customers.data ?? []).filter((c) => !c.isCash) : (suppliers.data ?? []);
  const create = useMutation({
    mutationFn: () =>
      createTradeFlowReturn({
        branchCode: branch!.code,
        kind,
        partyType: kind === "sales" ? "customer" : "supplier",
        partyId,
        itemId: itemId || undefined,
        qty: Number(qty || 0),
        amountPkr: Number(amount || 0),
        notes,
      }),
    onSuccess: () => {
      invalidate();
      setNotice(`${kind === "sales" ? "Sales" : "Purchase"} return saved`);
    },
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Returns" subtitle="Sales return or purchase return, with item quantity when needed." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {create.error ? <div className={noticeErrorClass}>{(create.error as Error).message}</div> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-6">
        <TfField label="Return type">
          <select className={tfInputClass} value={kind} onChange={(e) => { setKind(e.target.value as "sales" | "purchase"); setPartyId(""); }}>
            <option value="sales">Sales return</option>
            <option value="purchase">Purchase return</option>
          </select>
        </TfField>
        <TfField label={kind === "sales" ? "Customer" : "Supplier"}>
          <select className={tfInputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">{kind === "sales" ? "Select customer" : "Select supplier"}</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </TfField>
        <TfField label="Item (optional)">
          <select className={tfInputClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">No item</option>
            {(items.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </TfField>
        <TfField label="Qty">
          <input className={tfInputClass} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 1" />
        </TfField>
        <TfField label="Amount Rs">
          <input className={tfInputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1500" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!partyId || !Number(amount) || create.isPending} onClick={() => create.mutate()} className={tfPrimaryBtn}>Save return</button>
        </div>
        <div className="sm:col-span-2 lg:col-span-6">
          <TfField label="Notes">
            <input className={tfInputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional narration" />
          </TfField>
        </div>
      </div>
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Amount</th></tr></thead>
        <tbody>
          {(rows.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2 capitalize">{r.kind}</td>
              <td className="px-3 py-2">{r.partyName}</td>
              <td className="px-3 py-2">{r.itemName ?? "—"}</td>
              <td className="px-3 py-2">{r.qty}</td>
              <td className="px-3 py-2">{formatPkr(r.amountPkr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
