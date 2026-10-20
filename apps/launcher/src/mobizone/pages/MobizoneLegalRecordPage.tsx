import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  findLegalPurchaseRecords,
  formatPkr,
  normalizeImeiScan,
  printLegalPurchaseDossier,
  printPurchaseReceipt,
  type LegalPurchaseRecord,
} from "../lib/mobizoneStore";
import { MzOptionalCameraImeiScan } from "../components/MzOptionalCameraImeiScan";
import {
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
} from "../ui/MobizoneUi";

export function MobizoneLegalRecordPage(): JSX.Element {
  const { branchCode, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [liveQ, setLiveQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!branchCode || !liveQ.trim()) return [] as LegalPurchaseRecord[];
    return findLegalPurchaseRecords(branchCode, liveQ.trim());
  }, [branchCode, liveQ]);

  const selected = rows.find((r) => r.purchase.id === selectedId) ?? rows[0] ?? null;

  function runSearch(next = q): void {
    refresh();
    setErr(null);
    setMsg(null);
    const trimmed = next.trim();
    if (!trimmed) {
      setErr("Enter an IMEI, seller name, phone, or CNIC.");
      setLiveQ("");
      setSelectedId(null);
      return;
    }
    if (!branchCode) return;
    const found = findLegalPurchaseRecords(branchCode, trimmed);
    setLiveQ(trimmed);
    setQ(trimmed);
    setSelectedId(found[0]?.purchase.id ?? null);
    if (found.length === 0) {
      setErr("No purchase invoice or seller record was found for this query.");
    } else {
      setMsg(`${found.length} purchase record(s) found — seller identity below.`);
    }
  }

  function printLegalPack(): void {
    if (!branchCode || !selected) return;
    try {
      printLegalPurchaseDossier(branchCode, selected.purchase.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Print failed.");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Legal record"
        subtitle="For legal checks — retrieve the purchase invoice and the seller’s full identity (phone, CNIC, photo, CNIC front/back) from here."
      />

      <MzSection title="Lookup phone or seller">
        <p className={`mb-2 text-sm ${mutedClass}`}>
          When a customer sells a phone to the shop, their details are saved. Use this page to open that
          purchase invoice and seller proof record.
        </p>
        <div className="flex flex-wrap gap-2">
          <MzField label="IMEI / name / phone / CNIC">
            <div className="space-y-2">
              <MzInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                className="min-w-[280px] font-mono sm:min-w-[360px]"
                placeholder="Scan IMEI or type seller CNIC / phone…"
                autoFocus
              />
              <MzOptionalCameraImeiScan
                label="Camera scan IMEI"
                onDetected={(code) => {
                  const n = normalizeImeiScan(code);
                  setQ(n);
                  runSearch(n);
                }}
              />
            </div>
          </MzField>
          <div className="flex items-end">
            <MzPrimaryButton onClick={() => runSearch()}>Find legal record</MzPrimaryButton>
          </div>
        </div>
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
        {msg ? <p className="mt-2 text-sm text-emerald-600">{msg}</p> : null}
      </MzSection>

      {rows.length > 1 ? (
        <MzSection title={`Matching invoices (${rows.length})`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.purchase.id}>
                <button
                  type="button"
                  className={`${cardClass} w-full p-3 text-left ${
                    selected?.purchase.id === r.purchase.id ? "ring-2 ring-[var(--mz-accent)]" : ""
                  }`}
                  onClick={() => setSelectedId(r.purchase.id)}
                >
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {r.purchase.brand} {r.purchase.model}
                  </p>
                  <p className={`font-mono text-xs ${mutedClass}`}>{r.purchase.imei}</p>
                  <p className={`text-xs ${mutedClass}`}>
                    Seller {r.purchase.sellerName} · {new Date(r.purchase.createdAt).toLocaleDateString()} ·
                    KYC {r.completeness.score}/5
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </MzSection>
      ) : null}

      {selected ? (
        <LegalRecordDetail record={selected} branchCode={branchCode!} onPrintPack={printLegalPack} />
      ) : null}
    </MzPage>
  );
}

function LegalRecordDetail({
  record,
  branchCode,
  onPrintPack,
}: {
  record: LegalPurchaseRecord;
  branchCode: string;
  onPrintPack: () => void;
}): JSX.Element {
  const { purchase, device, sale, completeness } = record;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <MzPrimaryButton onClick={onPrintPack}>Print legal pack</MzPrimaryButton>
        <MzSecondaryButton onClick={() => printPurchaseReceipt(purchase, branchCode)}>
          Print purchase invoice
        </MzSecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <KycChip ok={completeness.hasPhone} label="Phone" />
        <KycChip ok={completeness.hasCnic} label="CNIC no." />
        <KycChip ok={completeness.hasSellerPhoto} label="Seller photo" />
        <KycChip ok={completeness.hasCnicFront} label="CNIC front" />
        <KycChip ok={completeness.hasCnicBack} label="CNIC back" />
      </div>

      <MzSection title="1. Purchase invoice">
        <div className={`${cardClass} space-y-2 p-4 text-sm`}>
          <p className="font-semibold text-slate-900 dark:text-white">
            {purchase.brand} {purchase.model}
            {purchase.etc ? ` · ${purchase.etc}` : ""}
          </p>
          <p className={`font-mono text-xs ${mutedClass}`}>
            IMEI 1: {purchase.imei}
            {device?.imei2 ? ` · IMEI 2: ${device.imei2}` : ""}
          </p>
          <p className={mutedClass}>
            Bill #{purchase.id.slice(0, 8).toUpperCase()} ·{" "}
            {new Date(purchase.createdAt).toLocaleString()}
          </p>
          <p>
            Price {formatPkr(purchase.purchasePricePkr)} · Paid {formatPkr(purchase.paidPkr || 0)} ·
            Credit {formatPkr(purchase.remainingPkr || 0)}
          </p>
          <p className={mutedClass}>
            Status: {device?.status?.replace("_", " ") || "—"}
            {sale
              ? ` · Later sold to ${sale.customerName} (${new Date(sale.createdAt).toLocaleDateString()})`
              : ""}
          </p>
          {purchase.note ? <p className={mutedClass}>Note: {purchase.note}</p> : null}
        </div>
      </MzSection>

      <MzSection title="2. Seller complete details">
        <div className={`${cardClass} grid gap-2 p-4 text-sm sm:grid-cols-2`}>
          <Field label="Full name" value={purchase.sellerName} />
          <Field label="Mobile number" value={purchase.sellerPhone || "— NOT ON FILE —"} warn={!purchase.sellerPhone} />
          <Field label="CNIC / ID" value={purchase.sellerCnic || "— NOT ON FILE —"} warn={!purchase.sellerCnic} />
          <Field label="Address" value={purchase.sellerAddress || "—"} />
        </div>
      </MzSection>

      <MzSection title="3. Seller photo & CNIC pictures">
        <div className="grid gap-3 sm:grid-cols-3">
          <PhotoCard src={purchase.sellerPhotoDataUrl} label="Seller photo" />
          <PhotoCard src={purchase.cnicFrontDataUrl} label="CNIC front" />
          <PhotoCard src={purchase.cnicBackDataUrl} label="CNIC back" />
        </div>
        <p className={`mt-3 text-xs ${mutedClass}`}>
          Print legal pack combines the invoice and these images into one document for verification.
        </p>
      </MzSection>
    </div>
  );
}

function KycChip({ ok, label }: { ok: boolean; label: string }): JSX.Element {
  return (
    <div
      className={`${cardClass} px-3 py-2 text-center text-xs font-semibold ${
        ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </div>
  );
}

function Field({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}): JSX.Element {
  return (
    <div>
      <p className={`text-xs uppercase ${mutedClass}`}>{label}</p>
      <p className={`font-medium ${warn ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function PhotoCard({ src, label }: { src?: string | null; label: string }): JSX.Element {
  return (
    <div className={`${cardClass} overflow-hidden p-2`}>
      {src ? (
        <img src={src} alt={label} className="h-44 w-full rounded object-cover" />
      ) : (
        <div className="flex h-44 items-center justify-center rounded border border-dashed border-rose-300 bg-rose-50 text-center text-xs font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          {label}
          <br />
          NOT ON FILE
        </div>
      )}
      <p className="mt-2 text-center text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</p>
    </div>
  );
}
