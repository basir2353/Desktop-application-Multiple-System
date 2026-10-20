import { useState } from "react";
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
import { MzField, MzInput, MzPrimaryButton, MzSecondaryButton, MzSection } from "../ui/MobizoneUi";

export function MobizoneImeiPage(): JSX.Element {
  const navigate = useNavigate();
  const { branchCode, db } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const found = branchCode && q.trim() ? findDeviceByImei(branchCode, q.trim()) : undefined;

  function applyScan(raw: string): void {
    const code = normalizeImeiScan(raw);
    setQ(code);
    setErr(null);
    if (!branchCode || !code) return;
    const device = findDeviceByImei(branchCode, code);
    if (!device) {
      setErr("No mobile found for this barcode / IMEI.");
      return;
    }
    // Scan = open that phone (sell if in stock, else history).
    if (device.status === "in_stock") {
      navigate(`/pops/mobizone/sell?imei=${encodeURIComponent(device.imei)}`);
    } else {
      navigate(`/pops/mobizone/search?q=${encodeURIComponent(device.imei)}&focus=imei`);
    }
  }

  function onSearch(): void {
    if (!q.trim()) {
      setErr("Scan barcode or type IMEI.");
      return;
    }
    applyScan(q);
  }

  function printSticker(deviceId?: string): void {
    const device =
      (deviceId ? db.devices.find((d) => d.id === deviceId) : undefined) ??
      found ??
      db.devices.find((d) => d.status === "in_stock");
    if (!device) {
      setErr("Nothing to print — add stock or search an IMEI first.");
      return;
    }
    setErr(null);
    const shopName = loadMobizoneReceiptSettings().shopName;
    printImeiBarcodeSticker(device, { shopName });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IMEI & barcode"
        subtitle="Print a barcode for each IMEI — scan it to open the same phone. Sticker: shop + model + barcode + *IMEI*."
      />
      <MzSection title="Scan barcode → open mobile">
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          A USB/Bluetooth scanner fills this field. The barcode value is the IMEI, so the same phone opens.
        </p>
        <div className="flex flex-wrap gap-2">
          <MzField label="IMEI / barcode">
            <div className="space-y-2">
              <MzInput
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearch();
                }}
                className="min-w-[260px] font-mono"
                placeholder="Scan barcode / type IMEI…"
                autoFocus
              />
              <MzOptionalCameraImeiScan
                label="Camera scan (optional)"
                onDetected={(code) => applyScan(code)}
              />
            </div>
          </MzField>
          <div className="flex items-end gap-2">
            <MzPrimaryButton onClick={onSearch}>Open mobile</MzPrimaryButton>
            <MzSecondaryButton onClick={() => printSticker()}>Print barcode</MzSecondaryButton>
          </div>
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        {found ? (
          <div className={`${cardClass} mt-2 p-4`}>
            <p className="font-semibold text-slate-900 dark:text-white">
              {found.brand} {found.model}
            </p>
            <p className={`mt-1 font-mono text-sm ${mutedClass}`}>*{found.imei}*</p>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              {found.status.replace("_", " ")} · Cost {formatPkr(found.purchasePricePkr)}
              {found.batteryHealth ? ` · Bat ${found.batteryHealth}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MzPrimaryButton onClick={() => printSticker(found.id)}>Print barcode sticker</MzPrimaryButton>
              {found.status === "in_stock" ? (
                <MzSecondaryButton
                  onClick={() => navigate(`/pops/mobizone/sell?imei=${encodeURIComponent(found.imei)}`)}
                >
                  Sell this phone
                </MzSecondaryButton>
              ) : null}
              <Link to={`/pops/mobizone/search?q=${encodeURIComponent(found.imei)}&focus=imei`}>
                <MzSecondaryButton>Full history</MzSecondaryButton>
              </Link>
            </div>
          </div>
        ) : null}
      </MzSection>

      <MzSection title="In-stock — print barcode">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {db.devices
            .filter((d) => d.status === "in_stock")
            .slice(0, 30)
            .map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {d.brand} {d.model}
                    {d.storage ? ` · ${d.storage}` : ""}
                    {d.batteryHealth ? ` · ${d.batteryHealth}` : ""}
                  </p>
                  <p className={`font-mono text-xs ${mutedClass}`}>*{d.imei}*</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MzSecondaryButton onClick={() => printSticker(d.id)}>Print barcode</MzSecondaryButton>
                  <MzSecondaryButton
                    onClick={() => navigate(`/pops/mobizone/sell?imei=${encodeURIComponent(d.imei)}`)}
                  >
                    Sell
                  </MzSecondaryButton>
                </div>
              </li>
            ))}
          {db.devices.filter((d) => d.status === "in_stock").length === 0 ? (
            <li className={`py-4 text-sm ${mutedClass}`}>No in-stock phones yet.</li>
          ) : null}
        </ul>
      </MzSection>
    </div>
  );
}
