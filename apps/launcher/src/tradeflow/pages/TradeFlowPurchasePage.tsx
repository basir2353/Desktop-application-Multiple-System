import { useMutation, useQuery } from "@tanstack/react-query";
import type { TradeFlowItem, TradeFlowPurchase } from "@platform/contracts";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createTradeFlowPurchase,
  createTradeFlowSupplier,
  fetchTradeFlowItems,
  fetchTradeFlowPurchases,
  fetchTradeFlowSuppliers,
  fetchTradeFlowWhatsapp,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, tfPrimaryBtn, tfSecondaryBtn, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { sendTradeFlowWhatsapp } from "../lib/whatsappTradeFlow";

type Line = { itemId: string; name: string; unit: string; altUnit: string; qty: number; rate: number; unitKind: "primary" | "alt" };

export function TradeFlowPurchasePage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("");
  const [unitKind, setUnitKind] = useState<"primary" | "alt">("primary");
  const [paid, setPaid] = useState("0");
  const [lines, setLines] = useState<Line[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<TradeFlowPurchase | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const suppliers = useQuery({ queryKey: ["tradeflow", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowSuppliers(branch!.code) });
  const items = useQuery({ queryKey: ["tradeflow", "items", branch?.code, "purchase"], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowItems(branch!.code) });
  const purchases = useQuery({ queryKey: ["tradeflow", "purchases", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTradeFlowPurchases(branch!.code) });
  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId);
  const picked = (items.data ?? []).find((i) => i.id === itemId);
  const total = lines.reduce((s, l) => s + (l.unitKind === "alt" ? l.qty : l.qty * l.rate), 0);

  const save = useMutation({
    mutationFn: () =>
      createTradeFlowPurchase({
        branchCode: branch!.code,
        supplierId,
        paidPkr: Number(paid || 0),
        lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, ratePkr: l.rate, unitKind: l.unitKind })),
      }),
    onSuccess: (row) => {
      invalidate();
      setSaved(row);
      setLines([]);
      setNotice(`Purchase ${row.invoiceNo} saved`);
    },
  });
  const addSupplier = useMutation({
    mutationFn: () => createTradeFlowSupplier({ branchCode: branch!.code, name: newName, phone: newPhone }),
    onSuccess: (row) => {
      invalidate();
      setSupplierId(row.id);
      setNewName("");
      setNewPhone("");
    },
  });

  function addLine() {
    if (!picked || !Number(qty)) return;
    setLines((prev) => [
      ...prev,
      {
        itemId: picked.id,
        name: picked.name,
        unit: picked.unit,
        altUnit: picked.altUnit,
        qty: Number(qty),
        rate: Number(rate || picked.defaultRatePkr),
        unitKind,
      },
    ]);
  }

  return (
    <div className="tf-app space-y-5">
      <PageHeader title="Purchase invoices" subtitle="Supplier balance, dual units, and WhatsApp to the supplier." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error || save.error ? <div className={noticeErrorClass}>{error ?? (save.error as Error).message}</div> : null}
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-4">
        <TfField label="Supplier">
          <select className={tfInputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </TfField>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-xs font-medium text-slate-500">Current balance</p>
          <p className="mt-1 font-semibold">{supplier ? formatPkr(supplier.closingBalancePkr) : "—"}</p>
        </div>
        <TfField label="New supplier name">
          <input className={tfInputClass} placeholder="e.g. Lucky Cement" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </TfField>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <TfField label="WhatsApp phone">
            <input className={tfInputClass} placeholder="03xx-xxxxxxx" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </TfField>
          <div className="flex items-end">
            <button type="button" disabled={!newName} onClick={() => addSupplier.mutate()} className={tfSecondaryBtn}>Add</button>
          </div>
        </div>
      </section>
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-6">
        <TfField label="Item">
          <select className={tfInputClass} value={itemId} onChange={(e) => { setItemId(e.target.value); const item = (items.data ?? []).find((i: TradeFlowItem) => i.id === e.target.value); if (item) setRate(String(item.defaultRatePkr)); }}>
            <option value="">Select item</option>
            {(items.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </TfField>
        <TfField label="Unit">
          <select className={tfInputClass} value={unitKind} onChange={(e) => setUnitKind(e.target.value as "primary" | "alt")}>
            <option value="primary">{picked?.unit ?? "Qty unit"}</option>
            <option value="alt">{picked?.altUnit ?? "Amount"}</option>
          </select>
        </TfField>
        <TfField label={unitKind === "alt" ? "Amount" : "Qty"}>
          <input className={tfInputClass} value={qty} onChange={(e) => setQty(e.target.value)} placeholder={unitKind === "alt" ? "e.g. 1500" : "e.g. 10"} />
        </TfField>
        <TfField label="Rate Rs">
          <input className={tfInputClass} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1500" />
        </TfField>
        <div className="flex items-end lg:col-span-2">
          <button type="button" onClick={addLine} className={tfPrimaryBtn}>Add line</button>
        </div>
      </section>
      {picked ? <p className="text-sm text-slate-500">Stock: {picked.onHandQty} {picked.unit} · {formatPkr(picked.onHandAlt)} {picked.altUnit}</p> : null}
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty / unit</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">Amount</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.itemId}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{l.name}</td>
              <td className="px-3 py-2">{l.qty} {l.unitKind === "alt" ? l.altUnit : l.unit}</td>
              <td className="px-3 py-2">{formatPkr(l.rate)}</td>
              <td className="px-3 py-2">{formatPkr(l.unitKind === "alt" ? l.qty : l.qty * l.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-xl font-semibold">{formatPkr(total)}</p>
        <TfField label="Paid now Rs">
          <input className={`${tfInputClass} w-40`} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
        </TfField>
        <button type="button" disabled={!supplierId || lines.length === 0 || save.isPending} onClick={() => save.mutate()} className="h-[42px] rounded-lg bg-violet-600 px-4 text-white disabled:opacity-50">Save purchase</button>
      </div>
      {saved ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="font-semibold">{saved.invoiceNo} · {saved.supplierName}</p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
            onClick={async () => {
              try {
                const wa = await fetchTradeFlowWhatsapp({ branchCode: branch!.code, kind: "purchase", partyType: "supplier", partyId: saved.supplierId, purchaseId: saved.id });
                await sendTradeFlowWhatsapp({ waUrl: wa.waUrl, phone: wa.phone, purchase: saved });
                setError(null);
                setNotice("WhatsApp opened for the supplier.");
              } catch (err) {
                setNotice(null);
                setError(err instanceof Error ? err.message : "Could not send WhatsApp");
              }
            }}
          >
            WhatsApp supplier
          </button>
        </div>
      ) : null}
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Paid</th></tr></thead>
        <tbody>
          {(purchases.data ?? []).map((p) => (
            <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{p.invoiceNo}</td>
              <td className="px-3 py-2">{p.supplierName}</td>
              <td className="px-3 py-2">{formatPkr(p.totalPkr)}</td>
              <td className="px-3 py-2">{formatPkr(p.paidPkr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
