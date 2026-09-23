import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { createTradeFlowBooking, createTradeFlowCustomer, fetchTradeFlowBookings, fetchTradeFlowCustomers, fetchTradeFlowItems } from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, tfSecondaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";

export function TradeFlowBookingsPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [customerId, setCustomerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("100");
  const [rate, setRate] = useState("1500");
  const [advance, setAdvance] = useState("0");
  const [newParty, setNewParty] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const customers = useQuery({
    queryKey: ["tradeflow", "customers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowCustomers(branch!.code),
  });
  const items = useQuery({
    queryKey: ["tradeflow", "items", branch?.code, customerId || "none"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowItems(branch!.code, customerId || undefined),
  });
  const bookings = useQuery({
    queryKey: ["tradeflow", "bookings", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowBookings(branch!.code),
  });
  const create = useMutation({
    mutationFn: () =>
      createTradeFlowBooking({
        branchCode: branch!.code,
        customerId,
        itemId,
        qtyBooked: Number(qty),
        bookedRatePkr: Number(rate),
        advancePkr: Number(advance || 0),
      }),
    onSuccess: (row) => {
      invalidate();
      setError(null);
      setNotice(`Booked ${row.qtyBooked} ${row.unit} for ${row.customerName}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save booking"),
  });
  const addParty = useMutation({
    mutationFn: () => createTradeFlowCustomer({ branchCode: branch!.code, name: newParty, phone: newPhone }),
    onSuccess: (row) => {
      invalidate();
      setCustomerId(row.id);
      setNewParty("");
      setNewPhone("");
      setError(null);
      setNotice(`${row.name} added. Select item to book.`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not add party"),
  });
  const selected = (items.data ?? []).find((i) => i.id === itemId);
  const parties = (customers.data ?? []).filter((c) => !c.isCash);

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Bookings" subtitle="Reserve quantity for a party. Stock still shows on-hand versus booked." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error || create.error ? <div className={noticeErrorClass}>{error ?? (create.error as Error).message}</div> : null}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-4">
        <TfField label="New party name">
          <input className={tfInputClass} value={newParty} onChange={(e) => setNewParty(e.target.value)} placeholder="e.g. Ahmed Traders" />
        </TfField>
        <TfField label="WhatsApp phone">
          <input className={tfInputClass} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!newParty.trim() || addParty.isPending} onClick={() => addParty.mutate()} className={tfSecondaryBtn}>
            {addParty.isPending ? "Adding..." : "Add party"}
          </button>
        </div>
        <p className="self-end text-sm text-slate-500">
          Kashif and Rehan are sample parties. Add more here or on <Link className="text-amber-800 dark:text-amber-300" to="/pops/tradeflow/customers">Parties</Link>.
        </p>
      </section>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-6">
        <TfField label="Party">
          <select className={tfInputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select party</option>
            {parties.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </TfField>
        <TfField label="Item">
          <select
            className={tfInputClass}
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              const item = (items.data ?? []).find((i) => i.id === e.target.value);
              if (item) setRate(String(item.lastRatePkr ?? item.defaultRatePkr));
            }}
          >
            <option value="">Select item</option>
            {(items.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </TfField>
        <TfField label="Qty">
          <input className={tfInputClass} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 100" />
        </TfField>
        <TfField label="Rate Rs">
          <input className={tfInputClass} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1500" />
        </TfField>
        <TfField label="Advance Rs">
          <input className={tfInputClass} value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!customerId || !itemId || create.isPending} onClick={() => create.mutate()} className={tfPrimaryBtn}>
            {create.isPending ? "Booking..." : "Book"}
          </button>
        </div>
      </div>
      {selected ? (
        <p className="text-sm text-slate-500">
          {selected.name}: {selected.onHandQty} on hand, {selected.bookedQty} booked, {selected.freeQty} free
          {selected.lastRatePkr != null ? ` · last party rate ${formatPkr(selected.lastRatePkr)}` : ""}
        </p>
      ) : null}
      <table className="min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Party</th>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Booked</th>
            <th className="px-3 py-2">Issued</th>
            <th className="px-3 py-2">Remaining</th>
            <th className="px-3 py-2">Remaining Rs</th>
            <th className="px-3 py-2">Advance</th>
            <th className="px-3 py-2">Rate</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(bookings.data ?? []).length === 0 ? (
            <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No bookings yet.</td></tr>
          ) : null}
          {(bookings.data ?? []).map((b) => (
            <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{b.customerName}</td>
              <td className="px-3 py-2">{b.itemName}</td>
              <td className="px-3 py-2">{b.qtyBooked} {b.unit}</td>
              <td className="px-3 py-2">{b.qtyIssued}</td>
              <td className="px-3 py-2 font-semibold">{b.qtyRemaining}</td>
              <td className="px-3 py-2">{formatPkr(b.remainingValuePkr)}</td>
              <td className="px-3 py-2">{formatPkr(b.advancePkr)}</td>
              <td className="px-3 py-2">{formatPkr(b.bookedRatePkr)}</td>
              <td className="px-3 py-2 capitalize">{b.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
