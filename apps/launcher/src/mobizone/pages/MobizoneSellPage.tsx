import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { MobizoneSale } from "@platform/contracts";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { useSessionStore } from "../../stores/sessionStore";
import { canEditMobizoneBillDate } from "../lib/mobizoneAccess";
import { listSuggestions, rememberSuggestions } from "../lib/mobizoneSuggestions";
import {
  buildWhatsAppSaleText,
  findDeviceByImei,
  formatPkr,
  normalizeImeiScan,
  openWhatsApp,
  printSaleReceipt,
  recordSale,
  todayDateInput,
} from "../lib/mobizoneStore";
import { MzOptionalCameraImeiScan } from "../components/MzOptionalCameraImeiScan";
import {
  MzField,
  MzInput,
  MzPage,
  MzPhotoUpload,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
  MzSuggestInput,
  MzTextArea,
} from "../ui/MobizoneUi";

export function MobizoneSellPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [params] = useSearchParams();
  const claims = useSessionStore((s) => s.claims);
  const canSetBillDate = canEditMobizoneBillDate(claims);
  const inStock = useMemo(() => db.devices.filter((d) => d.status === "in_stock"), [db.devices]);
  const [scan, setScan] = useState(() => normalizeImeiScan(params.get("imei") ?? ""));
  const [deviceId, setDeviceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCnic, setCustomerCnic] = useState("");
  const [shopkeeperId, setShopkeeperId] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cnicFront, setCnicFront] = useState<string | null>(null);
  const [cnicBack, setCnicBack] = useState<string | null>(null);
  const [otherPhoto, setOtherPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [price, setPrice] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [verified, setVerified] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [billDate, setBillDate] = useState(todayDateInput);
  const [warrantyDays, setWarrantyDays] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<MobizoneSale | null>(null);

  useEffect(() => {
    if (!bankAccountId && db.bankAccounts.length === 1) {
      setBankAccountId(db.bankAccounts[0]!.id);
    }
  }, [db.bankAccounts, bankAccountId]);

  // Deep-link / barcode scan: ?imei=… selects that in-stock phone.
  useEffect(() => {
    if (!branchCode) return;
    const code = normalizeImeiScan(params.get("imei") ?? "");
    if (!code) return;
    const found = findDeviceByImei(branchCode, code);
    if (!found || found.status !== "in_stock") return;
    setScan(found.imei);
    setDeviceId(found.id);
    setPrice(String(found.salePricePkr ?? found.purchasePricePkr));
    setBatteryHealth(found.batteryHealth ?? "");
    setErr(null);
  }, [branchCode, params, db.devices]);

  const suggest = useMemo(
    () => ({
      personName: listSuggestions(branchCode, db, "personName"),
      phone: listSuggestions(branchCode, db, "phone"),
      address: listSuggestions(branchCode, db, "address"),
      cnic: listSuggestions(branchCode, db, "cnic"),
    }),
    [branchCode, db],
  );

  function applyKnownCustomer(nameOrPhone: string): void {
    const q = nameOrPhone.trim().toLowerCase();
    if (!q) return;
    const hit =
      db.customers.find((c) => c.name.trim().toLowerCase() === q) ||
      db.customers.find((c) => (c.phone ?? "").trim().toLowerCase() === q) ||
      db.sales.find((s) => s.customerName.trim().toLowerCase() === q || (s.customerPhone ?? "").trim().toLowerCase() === q);
    if (!hit) return;
    if ("name" in hit) {
      setCustomerName(hit.name);
      if (hit.phone) setCustomerPhone(hit.phone);
      if (hit.address) setCustomerAddress(hit.address);
      if (hit.cnic) setCustomerCnic(hit.cnic);
      if (hit.photoDataUrl) setPhoto(hit.photoDataUrl);
      if (hit.cnicFrontDataUrl) setCnicFront(hit.cnicFrontDataUrl);
      if (hit.cnicBackDataUrl) setCnicBack(hit.cnicBackDataUrl);
      return;
    }
    setCustomerName(hit.customerName);
    if (hit.customerPhone) setCustomerPhone(hit.customerPhone);
    if (hit.customerAddress) setCustomerAddress(hit.customerAddress);
    if (hit.customerCnic) setCustomerCnic(hit.customerCnic);
  }

  const selected = inStock.find((d) => d.id === deviceId) ?? null;
  const priceN = Number(price) || 0;
  const cashN = Number(cash) || 0;
  const bankN = Number(bank) || 0;
  const received = cashN + bankN;
  const remaining = Math.max(0, priceN - received);

  function applyScan(raw = scan): void {
    if (!branchCode) return;
    const code = normalizeImeiScan(raw);
    if (!code) return;
    setScan(code);
    const found = findDeviceByImei(branchCode, code);
    if (!found || found.status !== "in_stock") {
      setErr("No in-stock device matched that IMEI / barcode.");
      return;
    }
    setErr(null);
    setDeviceId(found.id);
    setPrice(String(found.salePricePkr ?? found.purchasePricePkr));
    setBatteryHealth(found.batteryHealth ?? "");
  }

  function onDeviceChange(id: string): void {
    setDeviceId(id);
    const d = inStock.find((x) => x.id === id);
    if (d) {
      setPrice(String(d.salePricePkr ?? d.purchasePricePkr));
      setBatteryHealth(d.batteryHealth ?? "");
    } else {
      setBatteryHealth("");
    }
  }

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) {
      setErr("Select a branch first.");
      return;
    }
    if (!deviceId || !customerName.trim() || !(priceN > 0)) {
      setErr("Select a phone, enter customer name, and sale price.");
      return;
    }
    if (!customerPhone.trim()) {
      setErr("Customer phone is required for the bill / WhatsApp.");
      return;
    }
    const resolvedBillDate = canSetBillDate ? billDate || todayDateInput() : todayDateInput();
    const resolvedBankId =
      bankAccountId || (bankN > 0 && db.bankAccounts.length === 1 ? db.bankAccounts[0]!.id : "");
    if (bankN > 0 && !resolvedBankId) {
      setErr("Bank amount entered — add/select an account on the Banks page first.");
      return;
    }
    const acc = db.bankAccounts.find((a) => a.id === resolvedBankId);
    try {
      const sale = recordSale(branchCode, {
        deviceId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerAddress: customerAddress.trim() || null,
        customerCnic: customerCnic.trim() || null,
        customerPhotoDataUrl: photo,
        cnicFrontDataUrl: cnicFront,
        cnicBackDataUrl: cnicBack,
        otherPhotoDataUrl: otherPhoto,
        note: note.trim() || null,
        batteryHealth: batteryHealth.trim() || null,
        billDate: resolvedBillDate,
        shopkeeperId: shopkeeperId || null,
        pricePkr: priceN,
        dueDate: remaining > 0 ? dueDate || null : null,
        warrantyDays: Number(warrantyDays) || 0,
        payment: {
          cashPkr: cashN,
          bankPkr: bankN,
          bankLabel: acc ? `${acc.bankName} · ${acc.accountTitle}` : null,
          bank: {
            bankAccountId: resolvedBankId || null,
            bankName: acc?.bankName ?? null,
            accountTitle: acc?.accountTitle ?? null,
            accountNumber: acc?.accountNumber ?? null,
            iban: acc?.iban ?? null,
            txnRef: txnRef.trim() || null,
            verified,
          },
        },
      });
      rememberSuggestions(branchCode, {
        personName: customerName,
        phone: customerPhone,
        address: customerAddress,
        cnic: customerCnic,
      });
      refresh();
      setLastSale(sale);
      setMsg(`Sale saved — profit ${formatPkr(sale.profitPkr)}. Remaining ${formatPkr(sale.remainingPkr)}.`);
      // Bill turant open — customer name/phone/CNIC/address receipt par.
      printSaleReceipt(sale, branchCode);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerCnic("");
      setShopkeeperId("");
      setPhoto(null);
      setCnicFront(null);
      setCnicBack(null);
      setOtherPhoto(null);
      setNote("");
      setBatteryHealth("");
      setCash("");
      setBank("");
      setTxnRef("");
      setDueDate("");
      setBillDate(todayDateInput());
      setDeviceId("");
      setScan("");
      setPrice("");
      setVerified(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save sale.");
    }
  }

  function whatsappLast(): void {
    const last = lastSale ?? db.sales[0];
    if (!last) return;
    openWhatsApp(last.customerPhone, buildWhatsAppSaleText(last));
  }

  function printLast(): void {
    const last = lastSale ?? db.sales[0];
    if (!last || !branchCode) return;
    printSaleReceipt(last, branchCode);
  }

  return (
    <MzPage>
      <PageHeader
        title="Sell phone"
        subtitle="Customer details + print/WhatsApp receipt — scan barcode/IMEI to open the phone."
      />
      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {msg ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>
          <MzSecondaryButton onClick={printLast}>Print bill</MzSecondaryButton>
          <MzSecondaryButton onClick={whatsappLast}>Send WhatsApp receipt</MzSecondaryButton>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <MzSection title="Find phone (scanner / IMEI)">
          <div className="flex gap-2">
            <MzInput
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyScan();
              }}
              placeholder="Scan barcode / type IMEI"
              className="font-mono"
              autoFocus
            />
            <MzSecondaryButton onClick={applyScan}>Open</MzSecondaryButton>
          </div>
          <MzOptionalCameraImeiScan onDetected={(code) => applyScan(code)} />
          <MzField label="In-stock devices">
            <MzSelect value={deviceId} onChange={(e) => onDeviceChange(e.target.value)}>
              <option value="">Select phone…</option>
              {inStock.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.brand} {d.model} — {d.imei}
                </option>
              ))}
            </MzSelect>
          </MzField>
          {selected ? (
            <div className={`space-y-1 text-sm ${mutedClass}`}>
              <p>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  Purchase price: {formatPkr(selected.purchasePricePkr)}
                </span>
                {" · "}
                {[selected.colour, selected.storage, selected.batteryHealth ? `Battery ${selected.batteryHealth}` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {selected.notes ? <p>Notes: {selected.notes}</p> : null}
            </div>
          ) : null}
          {selected ? (
            <MzField label="Battery health">
              <MzInput
                value={batteryHealth}
                onChange={(e) => setBatteryHealth(e.target.value)}
                placeholder="e.g. 92% / Excellent"
              />
            </MzField>
          ) : null}
        </MzSection>

        <MzSection title="Customer / shopkeeper">
          <div className="grid gap-3 sm:grid-cols-2">
            {canSetBillDate ? (
              <MzField label="Bill date * (admin)">
                <MzInput
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="mz-date-input"
                />
              </MzField>
            ) : null}
            <MzField label="Customer name * (on bill)">
              <MzSuggestInput
                listId="mz-sell-name"
                suggestions={suggest.personName}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onBlur={(e) => applyKnownCustomer(e.target.value)}
              />
            </MzField>
            <MzField label="CNIC / ID (on bill)">
              <MzSuggestInput
                listId="mz-sell-cnic"
                suggestions={suggest.cnic}
                value={customerCnic}
                onChange={(e) => setCustomerCnic(e.target.value)}
              />
            </MzField>
            <MzField label="Mobile * (bill + WhatsApp)">
              <MzSuggestInput
                listId="mz-sell-phone"
                suggestions={suggest.phone}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                onBlur={(e) => applyKnownCustomer(e.target.value)}
              />
            </MzField>
            <MzField label="Address (on bill)">
              <MzSuggestInput
                listId="mz-sell-address"
                suggestions={suggest.address}
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </MzField>
            <MzField label="Shopkeeper account (optional)">
              <MzSelect value={shopkeeperId} onChange={(e) => setShopkeeperId(e.target.value)}>
                <option value="">Walk-in customer</option>
                {db.shopkeepers.map((s) => (
                  <option key={s.id} value={s.id}>
                    Shop {s.shopNo} — {s.name}
                  </option>
                ))}
              </MzSelect>
            </MzField>
          </div>
          <div className="mz-photo-grid">
            <MzPhotoUpload label="Customer picture" value={photo} onChange={setPhoto} />
            <MzPhotoUpload label="CNIC front" value={cnicFront} onChange={setCnicFront} />
            <MzPhotoUpload label="CNIC back" value={cnicBack} onChange={setCnicBack} />
            <MzPhotoUpload label="Other (any photo)" value={otherPhoto} onChange={setOtherPhoto} />
          </div>
        </MzSection>

        <MzSection title="Price & payment">
          <div className="grid gap-3 sm:grid-cols-2">
            <MzField label="Sale price (PKR) *">
              <MzInput type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </MzField>
            <MzField label="Receive into bank account">
              <MzSelect value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                <option value="">Select account…</option>
                {db.bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} — {a.accountTitle}
                  </option>
                ))}
              </MzSelect>
            </MzField>
            <MzField label="Cash received">
              <MzInput type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} />
            </MzField>
            <MzField label="Bank received">
              <MzInput type="number" min={0} value={bank} onChange={(e) => setBank(e.target.value)} />
            </MzField>
            <MzField label="Transaction reference">
              <MzInput value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
            </MzField>
            <MzField label="Credit due date">
              <MzInput
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mz-date-input"
              />
              {remaining <= 0 ? (
                <span className="mt-1 block text-[11px] text-slate-500">
                  Used when cash + bank is less than sale price (credit).
                </span>
              ) : null}
            </MzField>
            <MzField label="Warranty (days)">
              <MzInput type="number" min={0} value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} />
            </MzField>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              Bank payment verified
            </label>
            <div className="sm:col-span-2">
              <MzField label="Note (prints on bill)">
                <MzTextArea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any note / remarks…"
                  maxLength={800}
                  rows={3}
                />
              </MzField>
            </div>
          </div>
          <div className={`flex flex-wrap gap-4 text-sm ${mutedClass}`}>
            <span>
              Received: <strong className="text-slate-900 dark:text-white">{formatPkr(received)}</strong>
            </span>
            <span>
              Remaining: <strong className="text-slate-900 dark:text-white">{formatPkr(remaining)}</strong>
            </span>
            {selected ? (
              <span>
                Est. profit:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {formatPkr(priceN - selected.purchasePricePkr)}
                </strong>
              </span>
            ) : null}
          </div>
          <MzStickyActions>
            <MzPrimaryButton onClick={onSave}>Complete sale</MzPrimaryButton>
          </MzStickyActions>
        </MzSection>
      </div>
    </MzPage>
  );
}
