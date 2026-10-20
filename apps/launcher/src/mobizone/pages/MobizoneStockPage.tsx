import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { loadMobizoneReceiptSettings } from "../lib/mobizoneReceiptSettings";
import {
  findDeviceByImei,
  formatPkr,
  normalizeImeiScan,
  printImeiBarcodeSticker,
} from "../lib/mobizoneStore";
import { MzOptionalCameraImeiScan } from "../components/MzOptionalCameraImeiScan";
import { MzField, MzInput, MzPage, MzPrimaryButton, MzSecondaryButton, MzSelect } from "../ui/MobizoneUi";

export function MobizoneStockPage(): JSX.Element {
  const navigate = useNavigate();
  const { branchCode, db } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "in_stock" | "sold">("in_stock");
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = normalizeImeiScan(q).toLowerCase() || q.trim().toLowerCase();
    return db.devices
      .filter((d) => {
        if (status !== "all" && d.status !== status) return false;
        if (!needle) return true;
        const purchase = db.purchases.find((p) => p.deviceId === d.id);
        const sale = db.sales.find((s) => s.deviceId === d.id);
        const blob = [
          d.imei,
          d.imei2,
          d.barcode,
          d.brand,
          d.model,
          d.colour,
          d.storage,
          d.batteryHealth,
          d.notes,
          purchase?.note,
          sale?.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(needle) || normalizeImeiScan(d.imei).toLowerCase() === needle;
      })
      .map((d) => {
        const purchase = db.purchases.find((p) => p.deviceId === d.id && !p.returnedAt);
        const sale = db.sales.find((s) => s.deviceId === d.id && !s.returnedAt);
        const notes = [purchase?.note, sale?.note ? `Sale: ${sale.note}` : null, d.notes]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(" · ");
        return { d, purchase, sale, notes };
      });
  }, [db.devices, db.purchases, db.sales, q, status]);

  function openFromScan(raw: string): void {
    const code = normalizeImeiScan(raw);
    setQ(code);
    setScanMsg(null);
    if (!branchCode || !code) return;
    const device = findDeviceByImei(branchCode, code);
    if (!device) {
      setScanMsg("No mobile found for this barcode / IMEI.");
      return;
    }
    if (device.status === "in_stock") {
      navigate(`/pops/mobizone/sell?imei=${encodeURIComponent(device.imei)}`);
    } else {
      navigate(`/pops/mobizone/search?q=${encodeURIComponent(device.imei)}&focus=imei`);
    }
  }

  function printBarcode(deviceId: string): void {
    const device = db.devices.find((d) => d.id === deviceId);
    if (!device) return;
    printImeiBarcodeSticker(device, { shopName: loadMobizoneReceiptSettings().shopName });
  }

  return (
    <MzPage>
      <PageHeader
        title="Phone stock"
        subtitle="Print IMEI barcodes and scan them to open the same phone."
      />
      <div className="flex flex-wrap items-end gap-3">
        <MzField label="Search / scan">
          <div className="space-y-2">
            <MzInput
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setScanMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") openFromScan(q);
              }}
              placeholder="Scan barcode or type IMEI, brand, model…"
              className="min-w-[260px] font-mono"
            />
            <MzOptionalCameraImeiScan label="Camera scan barcode" onDetected={openFromScan} />
          </div>
        </MzField>
        <MzField label="Status">
          <MzSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="in_stock">In stock</option>
            <option value="sold">Sold</option>
            <option value="all">All</option>
          </MzSelect>
        </MzField>
        <MzPrimaryButton onClick={() => openFromScan(q)}>Open scanned mobile</MzPrimaryButton>
        <Link
          to={
            q.trim()
              ? `/pops/mobizone/search?q=${encodeURIComponent(normalizeImeiScan(q) || q.trim())}&focus=product`
              : "/pops/mobizone/search?focus=product"
          }
        >
          <MzSecondaryButton>Universal Search</MzSecondaryButton>
        </Link>
      </div>
      {scanMsg ? <p className="text-sm text-red-600">{scanMsg}</p> : null}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">IMEI / barcode</th>
              <th className="px-4 py-3">Specs</th>
              <th className="px-4 py-3">Battery</th>
              <th className="px-4 py-3">Purchase price</th>
              <th className="px-4 py-3">Sale price</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className={`px-4 py-8 text-center ${mutedClass}`}>
                  No devices match.
                </td>
              </tr>
            ) : (
              rows.map(({ d, notes }) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {d.brand} {d.model}
                    {d.etc ? <div className="text-xs font-semibold text-[var(--mz-accent)]">{d.etc}</div> : null}
                    <div className={`text-xs ${mutedClass}`}>{d.condition}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">*{d.imei}*</td>
                  <td className={`px-4 py-3 ${mutedClass}`}>
                    {[d.colour, d.storage].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{d.batteryHealth || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold tabular-nums">{formatPkr(d.purchasePricePkr)}</div>
                    <div className={`text-[11px] ${mutedClass}`}>Buy cost</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold tabular-nums">
                      {d.salePricePkr != null ? formatPkr(d.salePricePkr) : "—"}
                    </div>
                    <div className={`text-[11px] ${mutedClass}`}>
                      {d.status === "sold" ? "Sold at" : "Expected"}
                    </div>
                  </td>
                  <td className={`max-w-[16rem] px-4 py-3 text-xs ${mutedClass}`}>
                    {notes || "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{d.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <MzSecondaryButton onClick={() => printBarcode(d.id)}>Print barcode</MzSecondaryButton>
                      <Link
                        className="inline-flex"
                        to={`/pops/mobizone/search?q=${encodeURIComponent(d.imei)}&focus=imei`}
                      >
                        <MzSecondaryButton>History</MzSecondaryButton>
                      </Link>
                      {d.status === "in_stock" ? (
                        <Link
                          className="inline-flex"
                          to={`/pops/mobizone/sell?imei=${encodeURIComponent(d.imei)}`}
                        >
                          <MzSecondaryButton>Sell</MzSecondaryButton>
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </MzPage>
  );
}
