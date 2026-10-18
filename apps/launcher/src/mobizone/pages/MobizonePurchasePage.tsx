import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, recordPurchase } from "../lib/mobizoneStore";
import {
  MzField,
  MzInput,
  MzPage,
  MzPhotoUpload,
  MzPrimaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
} from "../ui/MobizoneUi";

export function MobizonePurchasePage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [sellerName, setSellerName] = useState("");
  const [sellerCnic, setSellerCnic] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [shopkeeperId, setShopkeeperId] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cnicFront, setCnicFront] = useState<string | null>(null);
  const [cnicBack, setCnicBack] = useState<string | null>(null);
  const [imei, setImei] = useState("");
  const [imei2, setImei2] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [colour, setColour] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<"new" | "used">("used");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [verified, setVerified] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const priceN = Number(price) || 0;
  const paid = (Number(cash) || 0) + (Number(bank) || 0);
  const remaining = Math.max(0, priceN - paid);

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) {
      setErr("Select a branch first.");
      return;
    }
    if (!sellerName.trim() || !imei.trim() || !brand.trim() || !model.trim() || !(priceN > 0)) {
      setErr("Seller name, IMEI, brand, model, and purchase price are required.");
      return;
    }
    const acc = db.bankAccounts.find((a) => a.id === bankAccountId);
    try {
      const row = recordPurchase(branchCode, {
        sellerName: sellerName.trim(),
        sellerCnic: sellerCnic.trim() || null,
        sellerPhone: sellerPhone.trim() || null,
        sellerAddress: sellerAddress.trim() || null,
        sellerPhotoDataUrl: photo,
        cnicFrontDataUrl: cnicFront,
        cnicBackDataUrl: cnicBack,
        shopkeeperId: shopkeeperId || null,
        imei: imei.trim(),
        imei2: imei2.trim() || null,
        brand,
        model,
        colour: colour.trim() || null,
        storage: storage.trim() || null,
        condition,
        purchasePricePkr: priceN,
        salePricePkr: salePrice ? Number(salePrice) : null,
        dueDate: remaining > 0 ? dueDate || null : null,
        payment: {
          cashPkr: Number(cash) || 0,
          bankPkr: Number(bank) || 0,
          bankLabel: acc ? `${acc.bankName} · ${acc.accountTitle}` : null,
          bank: {
            bankAccountId: bankAccountId || null,
            bankName: acc?.bankName ?? null,
            accountTitle: acc?.accountTitle ?? null,
            accountNumber: acc?.accountNumber ?? null,
            iban: acc?.iban ?? null,
            txnRef: txnRef.trim() || null,
            verified,
          },
        },
      });
      refresh();
      setMsg(
        `Purchase saved — ${row.brand} ${row.model}. Paid ${formatPkr(row.paidPkr)} · Udhaar ${formatPkr(row.remainingPkr)}.`,
      );
      setSellerName("");
      setSellerCnic("");
      setSellerPhone("");
      setSellerAddress("");
      setShopkeeperId("");
      setPhoto(null);
      setCnicFront(null);
      setCnicBack(null);
      setImei("");
      setImei2("");
      setBrand("");
      setModel("");
      setColour("");
      setStorage("");
      setPrice("");
      setSalePrice("");
      setCash("");
      setBank("");
      setTxnRef("");
      setDueDate("");
      setVerified(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save purchase.");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Buy phone"
        subtitle="Seller photo + CNIC, IMEI, cash/bank, aur udhaar due date."
      />
      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <MzSection title="Seller / customer">
          <div className="grid gap-3 sm:grid-cols-2">
            <MzField label="Full name *">
              <MzInput value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
            </MzField>
            <MzField label="CNIC / ID number">
              <MzInput value={sellerCnic} onChange={(e) => setSellerCnic(e.target.value)} placeholder="xxxxx-xxxxxxx-x" />
            </MzField>
            <MzField label="Mobile number">
              <MzInput value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} />
            </MzField>
            <MzField label="Address">
              <MzInput value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} />
            </MzField>
            <MzField label="Shopkeeper (optional)">
              <MzSelect value={shopkeeperId} onChange={(e) => setShopkeeperId(e.target.value)}>
                <option value="">Walk-in / customer</option>
                {db.shopkeepers.map((s) => (
                  <option key={s.id} value={s.id}>
                    Shop {s.shopNo} — {s.name}
                  </option>
                ))}
              </MzSelect>
            </MzField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MzPhotoUpload label="Seller photo" value={photo} onChange={setPhoto} />
            <MzPhotoUpload label="CNIC front" value={cnicFront} onChange={setCnicFront} />
            <MzPhotoUpload label="CNIC back" value={cnicBack} onChange={setCnicBack} />
          </div>
        </MzSection>

        <MzSection title="Device">
          <div className="grid gap-3 sm:grid-cols-2">
            <MzField label="IMEI *">
              <MzInput value={imei} onChange={(e) => setImei(e.target.value)} className="font-mono" />
            </MzField>
            <MzField label="IMEI 2">
              <MzInput value={imei2} onChange={(e) => setImei2(e.target.value)} className="font-mono" />
            </MzField>
            <MzField label="Brand *">
              <MzInput value={brand} onChange={(e) => setBrand(e.target.value)} />
            </MzField>
            <MzField label="Model *">
              <MzInput value={model} onChange={(e) => setModel(e.target.value)} />
            </MzField>
            <MzField label="Colour">
              <MzInput value={colour} onChange={(e) => setColour(e.target.value)} />
            </MzField>
            <MzField label="Storage">
              <MzInput value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="128GB" />
            </MzField>
            <MzField label="Condition">
              <MzSelect value={condition} onChange={(e) => setCondition(e.target.value as "new" | "used")}>
                <option value="used">Used</option>
                <option value="new">New</option>
              </MzSelect>
            </MzField>
            <MzField label="Purchase price (PKR) *">
              <MzInput type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </MzField>
            <MzField label="Expected sale price">
              <MzInput type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </MzField>
          </div>
        </MzSection>

        <MzSection title="Payment (cash + bank + udhaar)">
          <div className="grid gap-3 sm:grid-cols-2">
            <MzField label="Cash paid">
              <MzInput type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} />
            </MzField>
            <MzField label="Bank paid">
              <MzInput type="number" min={0} value={bank} onChange={(e) => setBank(e.target.value)} />
            </MzField>
            <MzField label="Pay from bank account">
              <MzSelect value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                <option value="">Select account…</option>
                {db.bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} — {a.accountTitle}
                  </option>
                ))}
              </MzSelect>
            </MzField>
            <MzField label="Transaction reference">
              <MzInput value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
            </MzField>
            <MzField label="Udhaar due date">
              <MzInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={remaining <= 0} />
            </MzField>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              Bank payment verified
            </label>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Paid {formatPkr(paid)} · Remaining udhaar{" "}
            <strong className="text-slate-900 dark:text-white">{formatPkr(remaining)}</strong>
          </p>
          <MzStickyActions>
            <MzPrimaryButton onClick={onSave}>Save purchase & add to stock</MzPrimaryButton>
          </MzStickyActions>
        </MzSection>
      </div>
    </MzPage>
  );
}
