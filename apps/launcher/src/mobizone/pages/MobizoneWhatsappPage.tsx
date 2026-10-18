import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  buildWhatsAppAccountStatement,
  buildWhatsAppPurchaseText,
  buildWhatsAppSaleText,
  openWhatsApp,
} from "../lib/mobizoneStore";
import { MzField, MzInput, MzPrimaryButton, MzSection, MzSelect, MzTextArea } from "../ui/MobizoneUi";

export function MobizoneWhatsappPage(): JSX.Element {
  const { branchCode, db } = useMobizoneDb();
  const [kind, setKind] = useState<"sale" | "purchase" | "statement" | "letter">("sale");
  const [id, setId] = useState("");
  const [partyKind, setPartyKind] = useState<"customer" | "shopkeeper">("customer");
  const [partyId, setPartyId] = useState("");
  const [phone, setPhone] = useState("");
  const [letter, setLetter] = useState(
    "Assalam o Alaikum,\n\nPlease find your account details from MobiZone.\n\nJazakAllah.",
  );

  const sale = db.sales.find((s) => s.id === id);
  const purchase = db.purchases.find((p) => p.id === id);
  const parties = partyKind === "customer" ? db.customers : db.shopkeepers;

  function onSend(): void {
    if (!branchCode) return;
    if (kind === "sale" && sale) {
      openWhatsApp(phone || sale.customerPhone, buildWhatsAppSaleText(sale));
      return;
    }
    if (kind === "purchase" && purchase) {
      openWhatsApp(phone || purchase.sellerPhone, buildWhatsAppPurchaseText(purchase));
      return;
    }
    if (kind === "statement" && partyId) {
      const p = parties.find((x) => x.id === partyId);
      const ph = phone || ("phone" in (p ?? {}) ? (p as { phone?: string | null }).phone : null);
      openWhatsApp(ph, buildWhatsAppAccountStatement(branchCode, partyKind, partyId));
      return;
    }
    if (kind === "letter") {
      openWhatsApp(phone, letter);
    }
  }

  const canSend =
    (kind === "sale" && Boolean(id)) ||
    (kind === "purchase" && Boolean(id)) ||
    (kind === "statement" && Boolean(partyId)) ||
    (kind === "letter" && Boolean(phone.trim() || letter.trim()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        subtitle="Send receipts, account statements, payment letters, and transaction details to customers or shopkeepers."
      />
      <MzSection title="Compose & send">
        <div className="grid gap-3 sm:grid-cols-2">
          <MzField label="Document type">
            <MzSelect
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setId("");
              }}
            >
              <option value="sale">Sale receipt</option>
              <option value="purchase">Purchase receipt</option>
              <option value="statement">Account statement / total details</option>
              <option value="letter">Custom letter / payment note</option>
            </MzSelect>
          </MzField>

          {kind === "sale" || kind === "purchase" ? (
            <MzField label="Record">
              <MzSelect value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">Select…</option>
                {kind === "sale"
                  ? db.sales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.customerName} — {s.brand} {s.model}
                      </option>
                    ))
                  : db.purchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sellerName} — {p.brand} {p.model}
                      </option>
                    ))}
              </MzSelect>
            </MzField>
          ) : null}

          {kind === "statement" ? (
            <>
              <MzField label="Party type">
                <MzSelect
                  value={partyKind}
                  onChange={(e) => {
                    setPartyKind(e.target.value as "customer" | "shopkeeper");
                    setPartyId("");
                  }}
                >
                  <option value="customer">Customer</option>
                  <option value="shopkeeper">Shopkeeper</option>
                </MzSelect>
              </MzField>
              <MzField label="Account">
                <MzSelect value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                  <option value="">Select…</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {"shopNo" in p ? `Shop ${p.shopNo} — ${p.name}` : p.name}
                    </option>
                  ))}
                </MzSelect>
              </MzField>
            </>
          ) : null}

          <MzField label="Phone (optional override)">
            <MzInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xxxxxxxxx" />
          </MzField>
        </div>

        {kind === "letter" ? (
          <MzField label="Letter / message">
            <MzTextArea value={letter} onChange={(e) => setLetter(e.target.value)} className="min-h-[140px]" />
          </MzField>
        ) : null}

        <MzPrimaryButton onClick={onSend} disabled={!canSend}>
          Open WhatsApp
        </MzPrimaryButton>
        <p className={`text-sm ${mutedClass}`}>
          Works on Android, iPhone, and laptop (WhatsApp app or WhatsApp Web). Thermal printing stays under Receipt
          printer.
        </p>
      </MzSection>
    </div>
  );
}
