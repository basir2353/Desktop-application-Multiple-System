import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createTradeFlowCustomer,
  createTradeFlowSupplier,
  fetchTradeFlowCustomers,
  fetchTradeFlowSuppliers,
  fetchTradeFlowWhatsapp,
  updateTradeFlowCustomer,
  updateTradeFlowSupplier,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { sendTradeFlowWhatsapp } from "../lib/whatsappTradeFlow";

export function TradeFlowCustomersPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["tradeflow", "customers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowCustomers(branch!.code) });
  const suppliers = useQuery({ queryKey: ["tradeflow", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowSuppliers(branch!.code) });

  const save = useMutation({
    mutationFn: async () => {
      if (tab === "customers") {
        if (editId) return updateTradeFlowCustomer(editId, { name, phone, address });
        return createTradeFlowCustomer({ branchCode: branch!.code, name, phone, address });
      }
      if (editId) return updateTradeFlowSupplier(editId, { name, phone, address });
      return createTradeFlowSupplier({ branchCode: branch!.code, name, phone, address });
    },
    onSuccess: () => {
      invalidate();
      setName("");
      setPhone("");
      setAddress("");
      setEditId(null);
      setError(null);
      setNotice(editId ? "Party updated" : "Party saved");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save party"),
  });

  function startEdit(row: { id: string; name: string; phone: string | null; address?: string | null }) {
    setEditId(row.id);
    setName(row.name);
    setPhone(row.phone ?? "");
    setAddress(row.address ?? "");
  }

  async function sendWa(partyType: "customer" | "supplier", partyId: string, label: string) {
    try {
      const wa = await fetchTradeFlowWhatsapp({ branchCode: branch!.code, kind: "reminder", partyType, partyId });
      await sendTradeFlowWhatsapp({ waUrl: wa.waUrl, phone: wa.phone });
      setError(null);
      setNotice(`WhatsApp reminder opened for ${label}.`);
    } catch (err) {
      setNotice(null);
      setError(err instanceof Error ? err.message : "Could not send WhatsApp");
    }
  }

  const rows = tab === "customers" ? customers.data ?? [] : suppliers.data ?? [];

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Parties" subtitle="Customers and suppliers with phone, address, closing balance, ledger, and WhatsApp." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      <div className="flex gap-2">
        {(["customers", "suppliers"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setEditId(null); setName(""); setPhone(""); setAddress(""); }}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${tab === id ? "bg-violet-600 text-white" : "border border-slate-300 dark:border-slate-700"}`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-4">
        <TfField label="Name">
          <input className={tfInputClass} placeholder="e.g. Kashif" value={name} onChange={(e) => setName(e.target.value)} />
        </TfField>
        <TfField label="WhatsApp phone">
          <input className={tfInputClass} placeholder="03xx-xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </TfField>
        <TfField label="Address">
          <input className={tfInputClass} placeholder="Optional" value={address} onChange={(e) => setAddress(e.target.value)} />
        </TfField>
        <div className="flex items-end">
          <button type="button" disabled={!name || save.isPending} onClick={() => save.mutate()} className={tfPrimaryBtn}>
            {editId ? "Update party" : `Add ${tab === "customers" ? "customer" : "supplier"}`}
          </button>
        </div>
      </div>
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Address</th>
            <th className="px-3 py-2">Closing balance</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{row.name}{"isCash" in row && row.isCash ? " (Cash)" : ""}</td>
              <td className="px-3 py-2">{row.phone ?? "—"}</td>
              <td className="px-3 py-2">{row.address ?? "—"}</td>
              <td className="px-3 py-2">{formatPkr(row.closingBalancePkr)}</td>
              <td className="px-3 py-2">
                {"isCash" in row && row.isCash ? null : (
                  <span className="flex flex-wrap gap-3">
                    {tab === "customers" ? <Link className="text-violet-700" to={`/pops/tradeflow/ledger?customerId=${row.id}`}>Ledger</Link> : null}
                    <Link className="text-violet-700" to={`/pops/tradeflow/payments`}>{tab === "customers" ? "Receive" : "Pay"}</Link>
                    <button type="button" className="text-slate-700" onClick={() => startEdit(row)}>Edit</button>
                    <button type="button" className="text-emerald-700" onClick={() => void sendWa(tab === "customers" ? "customer" : "supplier", row.id, row.name)}>WhatsApp</button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
