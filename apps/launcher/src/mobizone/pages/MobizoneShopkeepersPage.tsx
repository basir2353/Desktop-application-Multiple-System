import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  buildWhatsAppAccountStatement,
  formatPkr,
  openWhatsApp,
  shopkeeperBalance,
  upsertShopkeeper,
} from "../lib/mobizoneStore";
import {
  MzField,
  MzInput,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
  MzTextArea,
} from "../ui/MobizoneUi";

export function MobizoneShopkeepersPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [shopNo, setShopNo] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selected = db.shopkeepers.find((s) => s.id === selectedId) ?? null;
  const ledger = useMemo(
    () => (selectedId ? db.ledger.filter((e) => e.partyKind === "shopkeeper" && e.partyId === selectedId) : []),
    [db.ledger, selectedId],
  );
  const purchases = useMemo(
    () => (selectedId ? db.purchases.filter((p) => p.shopkeeperId === selectedId) : []),
    [db.purchases, selectedId],
  );
  const sales = useMemo(
    () => (selectedId ? db.sales.filter((s) => s.shopkeeperId === selectedId) : []),
    [db.sales, selectedId],
  );

  function onSave(): void {
    setErr(null);
    if (!branchCode) return;
    if (!shopNo.trim() || !name.trim()) {
      setErr("Shop number and name are required.");
      return;
    }
    const row = upsertShopkeeper(branchCode, {
      id: selectedId ?? undefined,
      shopNo,
      name,
      phone: phone || null,
      address: address || null,
      notes: notes || null,
    });
    refresh();
    setSelectedId(row.id);
    setShopNo("");
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
  }

  function loadEdit(id: string): void {
    const s = db.shopkeepers.find((x) => x.id === id);
    if (!s) return;
    setSelectedId(s.id);
    setShopNo(s.shopNo);
    setName(s.name);
    setPhone(s.phone ?? "");
    setAddress(s.address ?? "");
    setNotes(s.notes ?? "");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shopkeepers"
        subtitle="Separate accounts like Shop 100 — Hamza Mobile, with full buy/sell and ledger history."
      />
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <MzSection title={selectedId ? "Edit shopkeeper" : "Add shopkeeper"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <MzField label="Shop no. *">
              <MzInput value={shopNo} onChange={(e) => setShopNo(e.target.value)} placeholder="100" />
            </MzField>
            <MzField label="Name *">
              <MzInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Hamza Mobile" />
            </MzField>
            <MzField label="Phone">
              <MzInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            </MzField>
            <MzField label="Address">
              <MzInput value={address} onChange={(e) => setAddress(e.target.value)} />
            </MzField>
          </div>
          <MzField label="Notes">
            <MzTextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </MzField>
          <div className="flex flex-wrap gap-2">
            <MzPrimaryButton onClick={onSave}>{selectedId ? "Update" : "Create account"}</MzPrimaryButton>
            {selectedId ? (
              <MzSecondaryButton
                onClick={() => {
                  setSelectedId(null);
                  setShopNo("");
                  setName("");
                  setPhone("");
                  setAddress("");
                  setNotes("");
                }}
              >
                New
              </MzSecondaryButton>
            ) : null}
          </div>
        </MzSection>

        <MzSection title="All shopkeepers">
          <ul className="space-y-2">
            {db.shopkeepers.length === 0 ? (
              <li className={`text-sm ${mutedClass}`}>No shopkeepers yet — add Shop 100, Shop 64, etc.</li>
            ) : (
              db.shopkeepers.map((s) => {
                const bal = branchCode ? shopkeeperBalance(branchCode, s.id) : 0;
                return (
                  <li key={s.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-2 p-3`}>
                    <button type="button" className="text-left" onClick={() => loadEdit(s.id)}>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Shop {s.shopNo}: {s.name}
                      </p>
                      <p className={`text-xs ${mutedClass}`}>
                        Balance {formatPkr(bal)} {bal > 0 ? "(we owe)" : bal < 0 ? "(they owe)" : ""}
                      </p>
                    </button>
                    <MzSecondaryButton
                      onClick={() =>
                        branchCode &&
                        openWhatsApp(s.phone, buildWhatsAppAccountStatement(branchCode, "shopkeeper", s.id))
                      }
                    >
                      WhatsApp
                    </MzSecondaryButton>
                  </li>
                );
              })
            )}
          </ul>
        </MzSection>
      </div>

      {selected ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Ledger — Shop {selected.shopNo}: {selected.name}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`${cardClass} p-3`}>
              <p className={`text-xs ${mutedClass}`}>Purchases from them</p>
              <p className="text-lg font-semibold">{purchases.length}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className={`text-xs ${mutedClass}`}>Sales to them</p>
              <p className="text-lg font-semibold">{sales.length}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className={`text-xs ${mutedClass}`}>Current balance</p>
              <p className="text-lg font-semibold">
                {branchCode ? formatPkr(shopkeeperBalance(branchCode, selected.id)) : "—"}
              </p>
            </div>
          </div>
          <MzSection title="Transactions">
            <ul className="space-y-1 text-sm">
              {purchases.map((p) => (
                <li key={p.id} className="border-b border-slate-100 py-2 dark:border-slate-800">
                  BUY {p.brand} {p.model} ({p.imei}) · {formatPkr(p.purchasePricePkr)} · udhaar{" "}
                  {formatPkr(p.remainingPkr || 0)}
                </li>
              ))}
              {sales.map((s) => (
                <li key={s.id} className="border-b border-slate-100 py-2 dark:border-slate-800">
                  SELL {s.brand} {s.model} ({s.imei}) · {formatPkr(s.pricePkr)} · due {formatPkr(s.remainingPkr)}
                </li>
              ))}
              {ledger.map((e) => (
                <li key={e.id} className="border-b border-slate-100 py-2 dark:border-slate-800">
                  {e.direction.toUpperCase()} {formatPkr(e.amountPkr)} ({e.method}
                  {e.bankName ? ` · ${e.bankName}` : ""}) · {new Date(e.createdAt).toLocaleString()}
                </li>
              ))}
              {purchases.length + sales.length + ledger.length === 0 ? (
                <li className={mutedClass}>No transactions yet — link this shop on Buy/Sell forms.</li>
              ) : null}
            </ul>
          </MzSection>
        </div>
      ) : null}
    </div>
  );
}
