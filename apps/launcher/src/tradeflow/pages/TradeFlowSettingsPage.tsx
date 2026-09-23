import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  fetchTradeFlowCustomers,
  fetchTradeFlowInvoices,
  fetchTradeFlowPurchases,
  fetchTradeFlowSettings,
  fetchTradeFlowSuppliers,
  fetchTradeFlowWhatsapp,
  updateTradeFlowSettings,
} from "../api/tradeflow";
import { formatPkr, tfInputClass, TfField, useInvalidateTradeFlow, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { sendTradeFlowWhatsapp } from "../lib/whatsappTradeFlow";

const TABS = [
  { id: "invoice", label: "Invoice" },
  { id: "reminder", label: "Payment reminder" },
  { id: "supplier", label: "Supplier" },
  { id: "settings", label: "Default message" },
] as const;

export function TradeFlowSettingsPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const invalidate = useInvalidateTradeFlow();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("invoice");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [preview, setPreview] = useState<{ phone: string | null; message: string; waUrl: string | null } | null>(null);

  const settings = useQuery({
    queryKey: ["tradeflow", "settings", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowSettings(branch!.code),
  });
  const customers = useQuery({
    queryKey: ["tradeflow", "customers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowCustomers(branch!.code),
  });
  const invoices = useQuery({
    queryKey: ["tradeflow", "invoices", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowInvoices(branch!.code),
  });
  const suppliers = useQuery({
    queryKey: ["tradeflow", "suppliers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowSuppliers(branch!.code),
  });
  const purchases = useQuery({
    queryKey: ["tradeflow", "purchases", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowPurchases(branch!.code),
  });

  useEffect(() => {
    if (settings.data) setMessage(settings.data.whatsappTaxMessage);
  }, [settings.data]);

  const parties = (customers.data ?? []).filter((c) => !c.isCash);
  const partyInvoices = (invoices.data ?? []).filter((inv) => !customerId || inv.customerId === customerId);
  const supplierPurchases = (purchases.data ?? []).filter((p) => !supplierId || p.supplierId === supplierId);
  const selectedInvoice = (invoices.data ?? []).find((inv) => inv.id === invoiceId) ?? null;
  const selectedPurchase = (purchases.data ?? []).find((p) => p.id === purchaseId) ?? null;

  const save = useMutation({
    mutationFn: () => updateTradeFlowSettings({ branchCode: branch!.code, whatsappTaxMessage: message }),
    onSuccess: () => {
      invalidate();
      setError(null);
      setNotice("Default WhatsApp message saved. It is attached to invoices and reminders.");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save message"),
  });

  async function prepare() {
    setError(null);
    setNotice(null);
    if (tab === "invoice") {
      if (!invoiceId) throw new Error("Select an invoice to send.");
      return fetchTradeFlowWhatsapp({
        branchCode: branch!.code,
        kind: "invoice",
        partyType: "customer",
        partyId: customerId || selectedInvoice?.customerId || undefined,
        invoiceId,
      });
    }
    if (tab === "reminder") {
      if (!customerId) throw new Error("Select a customer for the reminder.");
      return fetchTradeFlowWhatsapp({
        branchCode: branch!.code,
        kind: "reminder",
        partyType: "customer",
        partyId: customerId,
      });
    }
    if (!supplierId && !purchaseId) throw new Error("Select a supplier or purchase invoice.");
    return fetchTradeFlowWhatsapp({
      branchCode: branch!.code,
      kind: purchaseId ? "purchase" : "reminder",
      partyType: "supplier",
      partyId: supplierId || selectedPurchase?.supplierId,
      purchaseId: purchaseId || undefined,
    });
  }

  async function previewMessage() {
    try {
      setPreview(await prepare());
      setError(null);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not prepare WhatsApp");
    }
  }

  async function send() {
    try {
      const payload = preview ?? (await prepare());
      await sendTradeFlowWhatsapp({
        waUrl: payload.waUrl,
        phone: payload.phone,
        invoice: tab === "invoice" ? selectedInvoice ?? undefined : undefined,
        purchase: tab === "supplier" ? selectedPurchase ?? undefined : undefined,
      });
      setPreview(payload);
      setNotice(
        tab === "invoice"
          ? "Invoice image downloaded. WhatsApp opened with the tax message."
          : "WhatsApp opened with the prepared message.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send WhatsApp");
    }
  }

  return (
    <div className="tf-app space-y-5">
      <PageHeader
        title="WhatsApp"
        subtitle="Send invoices, payment reminders, and supplier messages with the default tax text."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setPreview(null);
              setError(null);
              setNotice(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === item.id ? "bg-amber-700 text-white" : "border border-slate-300 dark:border-slate-700"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm text-slate-500">This text is appended to every customer and supplier WhatsApp.</p>
          <TfField label="Default WhatsApp message">
            <textarea className={`${tfInputClass} min-h-32`} value={message} onChange={(e) => setMessage(e.target.value)} />
          </TfField>
          <button type="button" disabled={!message.trim() || save.isPending} onClick={() => save.mutate()} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50">
            Save default message
          </button>
        </section>
      ) : null}

      {tab === "invoice" ? (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2">
          <TfField label="Customer">
            <select className={tfInputClass} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setInvoiceId(""); setPreview(null); }}>
              <option value="">All customers</option>
              {parties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : " · no phone"}</option>
              ))}
            </select>
          </TfField>
          <TfField label="Invoice">
            <select className={tfInputClass} value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setPreview(null); }}>
              <option value="">Select invoice</option>
              {partyInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNo} · {inv.customerName} · {formatPkr(inv.totalPkr)}</option>
              ))}
            </select>
          </TfField>
        </section>
      ) : null}

      {tab === "reminder" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <TfField label="Customer">
            <select className={tfInputClass} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPreview(null); }}>
              <option value="">Select customer</option>
              {parties.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · due {formatPkr(c.closingBalancePkr)}{c.phone ? ` · ${c.phone}` : " · no phone"}</option>
              ))}
            </select>
          </TfField>
        </section>
      ) : null}

      {tab === "supplier" ? (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2">
          <TfField label="Supplier">
            <select className={tfInputClass} value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPurchaseId(""); setPreview(null); }}>
              <option value="">Select supplier</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {formatPkr(s.closingBalancePkr)}{s.phone ? ` · ${s.phone}` : " · no phone"}</option>
              ))}
            </select>
          </TfField>
          <TfField label="Purchase invoice">
            <select className={tfInputClass} value={purchaseId} onChange={(e) => { setPurchaseId(e.target.value); setPreview(null); }}>
              <option value="">Payment update (no invoice)</option>
              {supplierPurchases.map((p) => (
                <option key={p.id} value={p.id}>{p.invoiceNo} · {p.supplierName} · {formatPkr(p.totalPkr)}</option>
              ))}
            </select>
          </TfField>
        </section>
      ) : null}

      {tab !== "settings" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void previewMessage()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
            Preview
          </button>
          <button type="button" onClick={() => void send()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Send on WhatsApp
          </button>
        </div>
      ) : null}

      {preview ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
          <p className="mt-1 text-sm font-medium">{preview.phone ?? "No phone on this party"}</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{preview.message}</pre>
        </section>
      ) : null}
    </div>
  );
}
