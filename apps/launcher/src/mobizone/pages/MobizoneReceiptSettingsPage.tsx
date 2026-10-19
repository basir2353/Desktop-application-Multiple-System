import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneBranchCode, useMobizoneDb } from "../hooks/useMobizone";
import {
  DEFAULT_MOBIZONE_RECEIPT_SETTINGS,
  MOBIZONE_RECEIPT_FIELD_LABELS,
  loadMobizoneReceiptSettings,
  saveMobizoneReceiptSettings,
  type MobizoneReceiptFields,
  type MobizoneReceiptSettings,
} from "../lib/mobizoneReceiptSettings";
import { buildSaleReceiptHtml, formatPkr, printHtmlPage } from "../lib/mobizoneStore";
import {
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
} from "../ui/MobizoneUi";

const FIELD_GROUPS: { title: string; keys: (keyof MobizoneReceiptFields)[] }[] = [
  {
    title: "Shop header",
    keys: ["shopName", "shopPhone", "shopAddress", "documentTitle", "timestamp"],
  },
  // Customer name/phone/CNIC/address hamesha bill par print hote hain (toggle nahi).
  {
    title: "Device",
    keys: ["device", "imei", "warranty"],
  },
  {
    title: "Payment",
    keys: ["salePrice", "cash", "bank", "bankDetails", "remaining", "dueDate"],
  },
  {
    title: "Footer",
    keys: ["footer"],
  },
];

export function MobizoneReceiptSettingsPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const { db } = useMobizoneDb();
  const [settings, setSettings] = useState<MobizoneReceiptSettings>(DEFAULT_MOBIZONE_RECEIPT_SETTINGS);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!branchCode) return;
    setSettings(loadMobizoneReceiptSettings(branchCode));
  }, [branchCode]);

  const sampleSale = useMemo(() => {
    const last = db.sales.find((s) => !s.returnedAt);
    if (last) return last;
    return {
      id: "00000000-0000-4000-8000-000000000001",
      deviceId: "00000000-0000-4000-8000-000000000002",
      customerId: null,
      shopkeeperId: null,
      customerName: "Ali Khan",
      customerPhone: "03001234567",
      customerAddress: "Main Bazaar, Lahore",
      customerCnic: "35202-1234567-1",
      customerPhotoDataUrl: null,
      cnicFrontDataUrl: null,
      cnicBackDataUrl: null,
      imei: "359999999999999",
      brand: "Samsung",
      model: "A15",
      pricePkr: 45000,
      receivedPkr: 40000,
      remainingPkr: 5000,
      dueDate: "2026-11-01",
      warrantyDays: 30,
      returnedAt: null,
      payment: {
        cashPkr: 20000,
        bankPkr: 20000,
        bankLabel: "HBL",
        bank: {
          bankAccountId: null,
          bankName: "HBL",
          accountTitle: "Shop",
          accountNumber: null,
          iban: null,
          txnRef: "TXN-123",
          verified: true,
        },
      },
      costPkr: 38000,
      profitPkr: 7000,
      createdAt: new Date().toISOString(),
    };
  }, [db.sales]);

  const previewHtml = useMemo(
    () => buildSaleReceiptHtml(sampleSale, branchCode ?? "MAIN", settings),
    [sampleSale, branchCode, settings],
  );

  function patchField(key: keyof MobizoneReceiptFields, value: boolean): void {
    setSettings((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));
    setMsg(null);
  }

  function onSave(): void {
    if (!branchCode) return;
    saveMobizoneReceiptSettings(branchCode, settings);
    setMsg("Receipt settings saved — next Print bill yeh layout use karega.");
  }

  function onReset(): void {
    setSettings(DEFAULT_MOBIZONE_RECEIPT_SETTINGS);
    setMsg(null);
  }

  function onPreviewPrint(): void {
    printHtmlPage("Receipt preview", previewHtml);
  }

  return (
    <MzPage>
      <PageHeader
        title="Receipt print settings"
        subtitle="Restaurant-style thermal bill — customer Name, Phone, CNIC, Address hamesha print. Shop header/footer yahan."
      />
      <p className={`text-sm ${mutedClass}`}>
        Bill layout restaurant POS jaisa: dashed lines, Items, Cash/Bank/Remaining, TOTAL. Customer block hamesha ON.
      </p>
      {msg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p> : null}
      <p className={`text-sm ${mutedClass}`}>
        Thermal / OS printer assign karne ke liye{" "}
        <Link className="text-violet-600 underline dark:text-violet-400" to="/pops/printer">
          Receipt printer
        </Link>{" "}
        page use karein. Yeh page bill par kya dikhega control karta hai.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <MzSection title="Shop details (bill header)">
            <div className="grid gap-3 sm:grid-cols-2">
              <MzField label="Shop name">
                <MzInput
                  value={settings.shopName}
                  onChange={(e) => setSettings((s) => ({ ...s, shopName: e.target.value }))}
                />
              </MzField>
              <MzField label="Shop phone">
                <MzInput
                  value={settings.shopPhone}
                  onChange={(e) => setSettings((s) => ({ ...s, shopPhone: e.target.value }))}
                  placeholder="03XXXXXXXXX"
                />
              </MzField>
              <div className="sm:col-span-2">
                <MzField label="Shop address">
                  <MzInput
                    value={settings.shopAddress}
                    onChange={(e) => setSettings((s) => ({ ...s, shopAddress: e.target.value }))}
                  />
                </MzField>
              </div>
              <MzField label="Document title">
                <MzInput
                  value={settings.documentTitle}
                  onChange={(e) => setSettings((s) => ({ ...s, documentTitle: e.target.value }))}
                />
              </MzField>
              <MzField label="Paper width">
                <MzSelect
                  value={String(settings.paperWidthMm)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      paperWidthMm: e.target.value === "58" ? 58 : 80,
                    }))
                  }
                >
                  <option value="80">80mm thermal</option>
                  <option value="58">58mm thermal</option>
                </MzSelect>
              </MzField>
              <div className="sm:col-span-2">
                <MzField label="Footer message">
                  <MzInput
                    value={settings.footerText}
                    onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))}
                  />
                </MzField>
              </div>
            </div>
          </MzSection>

          {FIELD_GROUPS.map((group) => (
            <MzSection key={group.title} title={group.title}>
              <ul className="space-y-2">
                {group.keys.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-3 text-sm">
                    <label className="flex cursor-pointer items-center gap-2 text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={settings.fields[key]}
                        onChange={(e) => patchField(key, e.target.checked)}
                      />
                      {MOBIZONE_RECEIPT_FIELD_LABELS[key]}
                    </label>
                  </li>
                ))}
              </ul>
            </MzSection>
          ))}

          <MzStickyActions>
            <MzPrimaryButton onClick={onSave} disabled={!branchCode}>
              Save settings
            </MzPrimaryButton>
            <MzSecondaryButton onClick={onPreviewPrint}>Print preview</MzSecondaryButton>
            <MzSecondaryButton onClick={onReset}>Reset defaults</MzSecondaryButton>
          </MzStickyActions>
        </div>

        <MzSection title="Live preview">
          <p className={`mb-2 text-xs ${mutedClass}`}>
            Sample / last sale · total {formatPkr(sampleSale.pricePkr)}
          </p>
          <div
            className="overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700"
            style={{ maxWidth: settings.paperWidthMm === 58 ? 260 : 340 }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </MzSection>
      </div>
    </MzPage>
  );
}
