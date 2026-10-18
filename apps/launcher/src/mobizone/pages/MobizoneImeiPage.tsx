import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { findDeviceByImei, formatPkr } from "../lib/mobizoneStore";
import { MzField, MzInput, MzPrimaryButton, MzSecondaryButton, MzSection } from "../ui/MobizoneUi";

export function MobizoneImeiPage(): JSX.Element {
  const navigate = useNavigate();
  const { branchCode, db } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const found = branchCode && q.trim() ? findDeviceByImei(branchCode, q.trim()) : undefined;

  function onSearch(): void {
    if (!found) {
      setErr("No device found for that IMEI / barcode.");
      return;
    }
    setErr(null);
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
    const html = `<!doctype html><html><head><title>IMEI sticker</title>
<style>
  body{font-family:ui-monospace,monospace;padding:12px}
  .box{border:1px dashed #333;padding:12px;width:280px}
  .brand{font-size:14px;font-weight:700}
  .imei{font-size:16px;letter-spacing:.04em;margin-top:8px}
  .meta{font-size:11px;color:#444;margin-top:6px}
</style></head><body>
<div class="box">
  <div class="brand">${device.brand} ${device.model}</div>
  <div class="imei">IMEI ${device.imei}</div>
  <div class="meta">${[device.colour, device.storage, device.condition].filter(Boolean).join(" · ")}</div>
  <svg id="bc"></svg>
</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>JsBarcode("#bc", ${JSON.stringify(device.barcode || device.imei)}, {format:"CODE128",width:1.4,height:40,displayValue:false});
setTimeout(()=>window.print(),400);<\/script>
</body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer,width=400,height=320");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IMEI & barcode"
        subtitle="Scan to open a phone record, or print IMEI stickers for stock."
      />
      <MzSection title="Scanner">
        <div className="flex flex-wrap gap-2">
          <MzField label="IMEI / barcode">
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
              placeholder="Scan here…"
              autoFocus
            />
          </MzField>
          <div className="flex items-end gap-2">
            <MzPrimaryButton onClick={onSearch}>Find</MzPrimaryButton>
            <MzSecondaryButton onClick={() => printSticker()}>Print sticker</MzSecondaryButton>
          </div>
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        {found ? (
          <div className={`${cardClass} mt-2 p-4`}>
            <p className="font-semibold text-slate-900 dark:text-white">
              {found.brand} {found.model}
            </p>
            <p className={`mt-1 font-mono text-sm ${mutedClass}`}>{found.imei}</p>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              {found.status.replace("_", " ")} · Cost {formatPkr(found.purchasePricePkr)}
            </p>
            {found.status === "in_stock" ? (
              <MzPrimaryButton className="mt-3" onClick={() => navigate("/pops/mobizone/sell")}>
                Sell this phone
              </MzPrimaryButton>
            ) : null}
          </div>
        ) : null}
      </MzSection>

      <MzSection title="Recent stock (print any)">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {db.devices.filter((d) => d.status === "in_stock").slice(0, 12).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {d.brand} {d.model}
                </p>
                <p className={`font-mono text-xs ${mutedClass}`}>{d.imei}</p>
              </div>
              <MzSecondaryButton onClick={() => printSticker(d.id)}>Print</MzSecondaryButton>
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
