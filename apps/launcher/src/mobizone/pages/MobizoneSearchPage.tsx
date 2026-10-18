import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  buildWhatsAppAccountStatement,
  customerHistory,
  formatPkr,
  imeiHistory,
  openWhatsApp,
  searchByCnic,
} from "../lib/mobizoneStore";
import { MzField, MzInput, MzPrimaryButton, MzSecondaryButton, MzSection } from "../ui/MobizoneUi";

export function MobizoneSearchPage(): JSX.Element {
  const { branchCode, refresh } = useMobizoneDb();
  const [mode, setMode] = useState<"imei" | "cnic">("imei");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const imeiResult = branchCode && mode === "imei" && q.trim() ? imeiHistory(branchCode, q.trim()) : null;
  const customer =
    branchCode && mode === "cnic" && q.trim() ? searchByCnic(branchCode, q.trim()) : undefined;
  const cnicResult =
    branchCode && customer ? customerHistory(branchCode, customer.id) : null;

  function onSearch(): void {
    refresh();
    setErr(null);
    if (!q.trim()) {
      setErr("Enter IMEI or CNIC.");
      return;
    }
    if (mode === "imei" && !imeiHistory(branchCode!, q.trim()).device && imeiHistory(branchCode!, q.trim()).purchases.length === 0) {
      setErr("No device / history for this IMEI.");
    }
    if (mode === "cnic" && !searchByCnic(branchCode!, q.trim())) {
      setErr("No customer found for this CNIC.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CNIC / IMEI search"
        subtitle="Find a phone’s buy/sell history by IMEI, or a customer’s photos, deals, and payments by CNIC."
      />
      <MzSection title="Lookup">
        <div className="flex flex-wrap gap-2">
          <MzSecondaryButton
            className={mode === "imei" ? "ring-2 ring-violet-500" : ""}
            onClick={() => {
              setMode("imei");
              setErr(null);
            }}
          >
            IMEI
          </MzSecondaryButton>
          <MzSecondaryButton
            className={mode === "cnic" ? "ring-2 ring-violet-500" : ""}
            onClick={() => {
              setMode("cnic");
              setErr(null);
            }}
          >
            CNIC
          </MzSecondaryButton>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <MzField label={mode === "imei" ? "IMEI / barcode" : "CNIC number"}>
            <MzInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              className="min-w-[260px] font-mono"
              placeholder={mode === "imei" ? "Scan or type IMEI…" : "xxxxx-xxxxxxx-x"}
              autoFocus
            />
          </MzField>
          <div className="flex items-end">
            <MzPrimaryButton onClick={onSearch}>Search</MzPrimaryButton>
          </div>
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
      </MzSection>

      {mode === "imei" && imeiResult && (imeiResult.device || imeiResult.purchases.length || imeiResult.sales.length) ? (
        <div className="space-y-4">
          {imeiResult.device ? (
            <div className={`${cardClass} p-4`}>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {imeiResult.device.brand} {imeiResult.device.model}
              </h3>
              <p className={`font-mono text-sm ${mutedClass}`}>{imeiResult.device.imei}</p>
              <p className={`text-sm ${mutedClass}`}>
                Status: {imeiResult.device.status.replace("_", " ")} · Cost{" "}
                {formatPkr(imeiResult.device.purchasePricePkr)}
              </p>
            </div>
          ) : null}
          <HistoryBlock
            title="Purchase history"
            rows={imeiResult.purchases.map((p) => ({
              id: p.id,
              line: `${p.sellerName} · ${formatPkr(p.purchasePricePkr)} · ${new Date(p.createdAt).toLocaleString()}`,
            }))}
          />
          <HistoryBlock
            title="Sale history"
            rows={imeiResult.sales.map((s) => ({
              id: s.id,
              line: `${s.customerName} · ${formatPkr(s.pricePkr)} · profit ${formatPkr(s.profitPkr)} · ${new Date(s.createdAt).toLocaleString()}`,
            }))}
          />
        </div>
      ) : null}

      {mode === "cnic" && cnicResult?.customer ? (
        <div className="space-y-4">
          <div className={`${cardClass} flex flex-wrap gap-4 p-4`}>
            {cnicResult.customer.photoDataUrl ? (
              <img src={cnicResult.customer.photoDataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ) : null}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{cnicResult.customer.name}</h3>
              <p className={`text-sm ${mutedClass}`}>
                {cnicResult.customer.cnic} · {cnicResult.customer.phone || "no phone"}
              </p>
              <p className={`text-sm ${mutedClass}`}>{cnicResult.customer.address || "—"}</p>
              <MzSecondaryButton
                className="mt-2"
                onClick={() =>
                  branchCode &&
                  openWhatsApp(
                    cnicResult.customer!.phone,
                    buildWhatsAppAccountStatement(branchCode, "customer", cnicResult.customer!.id),
                  )
                }
              >
                WhatsApp statement
              </MzSecondaryButton>
            </div>
            <div className="flex gap-2">
              {cnicResult.customer.cnicFrontDataUrl ? (
                <img src={cnicResult.customer.cnicFrontDataUrl} alt="CNIC front" className="h-20 w-32 rounded object-cover" />
              ) : null}
              {cnicResult.customer.cnicBackDataUrl ? (
                <img src={cnicResult.customer.cnicBackDataUrl} alt="CNIC back" className="h-20 w-32 rounded object-cover" />
              ) : null}
            </div>
          </div>
          <HistoryBlock
            title="Purchases from this person"
            rows={cnicResult.purchases.map((p) => ({
              id: p.id,
              line: `${p.brand} ${p.model} (${p.imei}) · ${formatPkr(p.purchasePricePkr)}`,
            }))}
          />
          <HistoryBlock
            title="Sales to this person"
            rows={cnicResult.sales.map((s) => ({
              id: s.id,
              line: `${s.brand} ${s.model} (${s.imei}) · ${formatPkr(s.pricePkr)} · due ${formatPkr(s.remainingPkr)}`,
            }))}
          />
          <HistoryBlock
            title="Payment / ledger"
            rows={cnicResult.ledger.map((e) => ({
              id: e.id,
              line: `${e.direction} ${formatPkr(e.amountPkr)} (${e.method}) · ${new Date(e.createdAt).toLocaleString()}`,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function HistoryBlock({ title, rows }: { title: string; rows: { id: string; line: string }[] }): JSX.Element {
  return (
    <MzSection title={title}>
      {rows.length === 0 ? (
        <p className={`text-sm ${mutedClass}`}>None</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-200">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-slate-100 px-3 py-2 dark:border-slate-800">
              {r.line}
            </li>
          ))}
        </ul>
      )}
    </MzSection>
  );
}
