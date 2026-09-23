import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createTradeFlowExpense,
  createTradeFlowInvoice,
  createTradeFlowPayment,
  createTradeFlowPurchase,
  createTradeFlowReturn,
  fetchTradeFlowCustomers,
  fetchTradeFlowItems,
  fetchTradeFlowSuppliers,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";

const TABS = ["sales", "purchase", "payments", "expenses", "returns"] as const;

export function TradeFlowMobilePage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [tab, setTab] = useState<(typeof TABS)[number]>("sales");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("Expense");
  const customers = useQuery({ queryKey: ["tradeflow", "customers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowCustomers(branch!.code) });
  const suppliers = useQuery({ queryKey: ["tradeflow", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowSuppliers(branch!.code) });
  const items = useQuery({ queryKey: ["tradeflow", "items", branch?.code, "mobile"], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowItems(branch!.code) });
  const item = (items.data ?? []).find((i) => i.id === itemId);

  const run = useMutation({
    mutationFn: async () => {
      if (tab === "sales") {
        return createTradeFlowInvoice({
          branchCode: branch!.code,
          customerId: customerId || null,
          receiveNow: true,
          receivedPkr: Number(amount || 0),
          lines: [{ itemId, qty: Number(qty), ratePkr: Number(rate || item?.defaultRatePkr || 0) }],
        });
      }
      if (tab === "purchase") {
        return createTradeFlowPurchase({
          branchCode: branch!.code,
          supplierId,
          paidPkr: Number(amount || 0),
          lines: [{ itemId, qty: Number(qty), ratePkr: Number(rate || item?.defaultRatePkr || 0) }],
        });
      }
      if (tab === "payments") {
        return createTradeFlowPayment({
          branchCode: branch!.code,
          partyType: customerId ? "customer" : "supplier",
          partyId: customerId || supplierId,
          kind: customerId ? "receive" : "pay",
          amountPkr: Number(amount),
        });
      }
      if (tab === "expenses") {
        return createTradeFlowExpense({ branchCode: branch!.code, label, amountPkr: Number(amount) });
      }
      return createTradeFlowReturn({
        branchCode: branch!.code,
        kind: customerId ? "sales" : "purchase",
        partyType: customerId ? "customer" : "supplier",
        partyId: customerId || supplierId,
        itemId: itemId || undefined,
        qty: Number(qty || 0),
        amountPkr: Number(amount),
      });
    },
    onSuccess: () => {
      invalidate();
      setError(null);
      setNotice("Mobile entry saved");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
  });

  return (
    <div className="tf-app mx-auto max-w-md space-y-5">
      <PageHeader title="Mobile" subtitle="Phone-sized sales, purchase, payment, expense, and return entries." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-violet-600 text-white" : "border border-slate-300 dark:border-slate-700"}`}>{t}</button>
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        {tab !== "purchase" && tab !== "expenses" ? (
          <TfField label="Customer">
            <select className={tfInputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Customer / cash</option>
              {(customers.data ?? []).filter((c) => !c.isCash).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </TfField>
        ) : null}
        {tab === "purchase" || tab === "payments" || tab === "returns" ? (
          <TfField label="Supplier">
            <select className={tfInputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier</option>
              {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} · {formatPkr(s.closingBalancePkr)}</option>)}
            </select>
          </TfField>
        ) : null}
        {tab === "sales" || tab === "purchase" || tab === "returns" ? (
          <>
            <TfField label="Item">
              <select className={tfInputClass} value={itemId} onChange={(e) => { setItemId(e.target.value); const next = (items.data ?? []).find((i) => i.id === e.target.value); if (next) setRate(String(next.defaultRatePkr)); }}>
                <option value="">Select item</option>
                {(items.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name} · {i.onHandQty} {i.unit} / {formatPkr(i.onHandAlt)}</option>)}
              </select>
            </TfField>
            <TfField label="Qty">
              <input className={tfInputClass} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" />
            </TfField>
            {tab !== "returns" ? (
              <TfField label="Rate Rs">
                <input className={tfInputClass} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1500" />
              </TfField>
            ) : null}
          </>
        ) : null}
        {tab === "expenses" ? (
          <TfField label="Expense name">
            <input className={tfInputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Labor / loading" />
          </TfField>
        ) : null}
        <TfField label={tab === "sales" ? "Receive now Rs" : "Amount Rs"}>
          <input className={tfInputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tab === "sales" ? "Cash received" : "e.g. 5000"} />
        </TfField>
        <button type="button" disabled={run.isPending} onClick={() => run.mutate()} className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white disabled:opacity-50">Save {tab}</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Link className="rounded-xl border border-slate-200 p-3 dark:border-slate-800" to="/pops/tradeflow/pos">Full POS</Link>
        <Link className="rounded-xl border border-slate-200 p-3 dark:border-slate-800" to="/pops/tradeflow/ledger">Ledger</Link>
      </div>
    </div>
  );
}
