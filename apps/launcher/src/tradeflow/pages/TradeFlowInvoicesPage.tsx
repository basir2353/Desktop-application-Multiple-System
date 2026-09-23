import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { fetchTradeFlowInvoices, fetchTradeFlowWhatsapp } from "../api/tradeflow";
import { formatPkr, useTradeFlowAccess } from "../hooks/useTradeFlow";
import { printTradeFlowInvoice, type TradeFlowPrintSize } from "../lib/printTradeFlowInvoice";
import { sendTradeFlowWhatsapp } from "../lib/whatsappTradeFlow";

export function TradeFlowInvoicesPage(): JSX.Element {
  const { branch } = useTradeFlowAccess();
  const [size, setSize] = useState<TradeFlowPrintSize>("a4");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["tradeflow", "invoices", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTradeFlowInvoices(branch!.code),
  });

  return (
    <div className="tf-app space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Saved bills. Print A4, A5, or thermal, or send the invoice on WhatsApp."
        actions={
          <Link className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700" to="/pops/tradeflow/settings">
            WhatsApp hub
          </Link>
        }
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      <div className="flex gap-2">
        {(["a4", "a5", "thermal"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSize(s)} className={`rounded-lg px-3 py-1.5 text-sm ${size === s ? "bg-violet-600 text-white" : "border border-slate-300 dark:border-slate-700"}`}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>
      <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900/40">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2">Party</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Received</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {(query.data ?? []).length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-slate-500">No invoices yet. Save a bill from POS.</td>
            </tr>
          ) : null}
          {(query.data ?? []).map((inv) => (
            <tr key={inv.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{inv.invoiceNo}</td>
              <td className="px-3 py-2">{inv.customerName}</td>
              <td className="px-3 py-2">{formatPkr(inv.totalPkr)}</td>
              <td className="px-3 py-2">{formatPkr(inv.receivedPkr)}</td>
              <td className="px-3 py-2 capitalize">{inv.status}</td>
              <td className="px-3 py-2">
                <button type="button" className="text-violet-700" onClick={() => printTradeFlowInvoice(inv, size, branch?.code)}>
                  Print
                </button>
                <button
                  type="button"
                  className="ml-3 text-emerald-700"
                  onClick={async () => {
                    try {
                      const wa = await fetchTradeFlowWhatsapp({
                        branchCode: branch!.code,
                        kind: "invoice",
                        partyType: "customer",
                        partyId: inv.customerId ?? undefined,
                        invoiceId: inv.id,
                      });
                      await sendTradeFlowWhatsapp({ waUrl: wa.waUrl, phone: wa.phone, invoice: inv });
                      setError(null);
                      setNotice(`${inv.invoiceNo} image downloaded. WhatsApp opened.`);
                    } catch (err) {
                      setNotice(null);
                      setError(err instanceof Error ? err.message : "Could not send WhatsApp");
                    }
                  }}
                >
                  WhatsApp
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
