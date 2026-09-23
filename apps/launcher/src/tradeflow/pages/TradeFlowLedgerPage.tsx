import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { ModuleSegmentedControl } from "../../pops/ui/ModuleToolbar";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { createTradeFlowPayment, fetchTradeFlowCustomers, fetchTradeFlowLedger, fetchTradeFlowWhatsapp } from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { sendTradeFlowWhatsapp } from "../lib/whatsappTradeFlow";
import "../tradeflow.css";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "item", label: "Item detail" },
  { id: "bookings", label: "Bookings" },
  { id: "sales", label: "Sales / invoices" },
  { id: "payments", label: "Payments" },
  { id: "returns", label: "Returns" },
] as const;

export function TradeFlowLedgerPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [params, setParams] = useSearchParams();
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [receive, setReceive] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const customers = useQuery({
    queryKey: ["tradeflow", "customers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowCustomers(branch!.code),
  });
  const ledger = useQuery({
    queryKey: ["tradeflow", "ledger", branch?.code, customerId, filter],
    enabled: Boolean(branch?.code && customerId),
    queryFn: () => fetchTradeFlowLedger(branch!.code, customerId, filter),
  });
  const data = ledger.data;
  const parties = useMemo(() => (customers.data ?? []).filter((c) => !c.isCash), [customers.data]);
  const receivePay = useMutation({
    mutationFn: () => createTradeFlowPayment({ branchCode: branch!.code, partyType: "customer", partyId: customerId, kind: "receive", amountPkr: Number(receive) }),
    onSuccess: (row) => {
      invalidate();
      setReceive("");
      setError(null);
      setNotice(`Received ${formatPkr(row.amountPkr)}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not receive payment"),
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Ledger" subtitle="Bookings, advances, delivered items, remaining, payments, sales, and returns." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-[1fr_auto_auto_auto]">
        <TfField label="Customer">
          <select
            className={tfInputClass}
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setParams(e.target.value ? { customerId: e.target.value } : {});
            }}
          >
            <option value="">Select customer</option>
            {parties.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </TfField>
        <TfField label="Receive Rs">
          <input className={tfInputClass} value={receive} onChange={(e) => setReceive(e.target.value)} placeholder="e.g. 5000" disabled={!customerId} />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!customerId || !Number(receive) || receivePay.isPending} onClick={() => receivePay.mutate()} className={tfPrimaryBtn}>
            Receive
          </button>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!customerId}
            className="h-[42px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 disabled:opacity-50"
            onClick={async () => {
              try {
                const wa = await fetchTradeFlowWhatsapp({ branchCode: branch!.code, kind: "reminder", partyType: "customer", partyId: customerId });
                await sendTradeFlowWhatsapp({ waUrl: wa.waUrl, phone: wa.phone });
                setError(null);
                setNotice("WhatsApp reminder opened.");
              } catch (err) {
                setNotice(null);
                setError(err instanceof Error ? err.message : "Could not send WhatsApp");
              }
            }}
          >
            WhatsApp reminder
          </button>
        </div>
      </div>
      <ModuleSegmentedControl
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ id: f.id, label: f.label, accent: true }))}
      />
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Booking value" value={formatPkr(data.summary.bookingValuePkr)} />
            <Stat label="Advance" value={formatPkr(data.summary.advancePkr)} />
            <Stat label="Delivered" value={formatPkr(data.summary.deliveredValuePkr)} />
            <Stat label="Remaining booking" value={formatPkr(data.summary.remainingValuePkr)} />
            <Stat label="Sales" value={formatPkr(data.summary.salesPkr)} />
            <Stat label="Payments" value={formatPkr(data.summary.paymentsPkr)} />
            <Stat label="Returns" value={formatPkr(data.summary.returnsPkr)} />
            <Stat label="Closing" value={formatPkr(data.summary.closingBalancePkr)} />
          </div>
          {data.remainingBookings.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <h3 className="font-semibold">Remaining booking</h3>
              <ul className="mt-2 text-sm">
                {data.remainingBookings.map((b) => (
                  <li key={b.id}>{b.itemName}: {b.qtyRemaining} {b.unit} remaining · {formatPkr(b.remainingValuePkr)}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <table className="min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={`${e.type}-${e.at}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{new Date(e.at).toLocaleString()}</td>
                  <td className="px-3 py-2 capitalize">{e.type}</td>
                  <td className="px-3 py-2">{e.title}{e.itemName && e.type !== "delivered" ? ` · ${e.itemName}` : ""}</td>
                  <td className="px-3 py-2">{e.qty != null ? `${e.qty}${e.unit ? ` ${e.unit}` : ""}` : "—"}</td>
                  <td className="px-3 py-2">{formatPkr(e.amountPkr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-sm text-slate-500">Select a customer to open the complete ledger.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
