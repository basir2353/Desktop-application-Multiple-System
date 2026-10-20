import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { MobizoneCustomer, MobizoneShopkeeper } from "@platform/contracts";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import {
  buildWhatsAppAccountStatement,
  customerHistory,
  formatPkr,
  openWhatsApp,
  shopkeeperHistory,
  universalSearch,
} from "../lib/mobizoneStore";
import { MzOptionalCameraImeiScan } from "../components/MzOptionalCameraImeiScan";
import {
  MzField,
  MzInput,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
} from "../ui/MobizoneUi";

export function MobizoneSearchPage(): JSX.Element {
  const { branchCode, refresh } = useMobizoneDb();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [liveQ, setLiveQ] = useState(() => (params.get("q") ?? "").trim());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(params.get("customerId"));
  const [selectedShopkeeperId, setSelectedShopkeeperId] = useState<string | null>(
    params.get("shopkeeperId"),
  );
  const [err, setErr] = useState<string | null>(null);

  // Live search: type name / mobile → report updates (short debounce).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = q.trim();
      setLiveQ(next);
      setSelectedCustomerId(null);
      setSelectedShopkeeperId(null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const result = useMemo(() => {
    if (!branchCode || !liveQ) return null;
    return universalSearch(branchCode, liveQ);
  }, [branchCode, liveQ]);

  // Auto-pick best person match so report shows without extra click.
  useEffect(() => {
    if (!result) return;
    const paramCustomer = params.get("customerId");
    const paramShop = params.get("shopkeeperId");
    if (paramCustomer && result.customers.some((c) => c.id === paramCustomer)) {
      setSelectedCustomerId(paramCustomer);
    } else if (result.customers.length > 0) {
      const exact = result.customers.find((c) => c.name.toLowerCase() === liveQ.toLowerCase());
      setSelectedCustomerId((exact ?? result.customers[0])!.id);
    }
    if (paramShop && result.shopkeepers.some((s) => s.id === paramShop)) {
      setSelectedShopkeeperId(paramShop);
    } else if (result.shopkeepers.length === 1) {
      setSelectedShopkeeperId(result.shopkeepers[0]!.id);
    }
  }, [result, liveQ, params]);

  const customerDetail =
    branchCode && selectedCustomerId ? customerHistory(branchCode, selectedCustomerId) : null;
  const shopkeeperDetail =
    branchCode && selectedShopkeeperId ? shopkeeperHistory(branchCode, selectedShopkeeperId) : null;

  function runSearch(nextQ = q): void {
    refresh();
    setErr(null);
    const trimmed = nextQ.trim();
    if (!trimmed) {
      setErr("Type a person name or mobile name (brand / model / IMEI).");
      setLiveQ("");
      return;
    }
    if (!branchCode) return;
    const found = universalSearch(branchCode, trimmed);
    if (!found.hasPersonHits && !found.hasProductHits) {
      setErr("No report found for this name / mobile.");
    }
    setLiveQ(trimmed);
    setQ(trimmed);
    const next = new URLSearchParams();
    next.set("q", trimmed);
    if (found.customers[0]) {
      next.set("customerId", found.customers[0].id);
      setSelectedCustomerId(found.customers[0].id);
    } else {
      setSelectedCustomerId(null);
    }
    if (found.shopkeepers[0]) {
      next.set("shopkeeperId", found.shopkeepers[0].id);
      setSelectedShopkeeperId(found.shopkeepers[0].id);
    } else {
      setSelectedShopkeeperId(null);
    }
    setParams(next, { replace: true });
  }

  const imeiBlock = result?.imeiExact;
  const productBlock = result?.products;
  const purchaseRows = imeiBlock?.purchases.length
    ? imeiBlock.purchases
    : productBlock?.purchases ?? [];
  const saleRows = imeiBlock?.sales.length ? imeiBlock.sales : productBlock?.sales ?? [];
  const showPersonReport = Boolean(result?.hasPersonHits);
  const showProductReport = Boolean(result?.hasProductHits);
  const showNameFallback =
    showPersonReport &&
    !customerDetail?.customer &&
    !shopkeeperDetail?.shopkeeper &&
    result &&
    (result.personByName.purchases.length > 0 ||
      result.personByName.sales.length > 0 ||
      result.personByName.ledger.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universal Search"
        subtitle="Type a person name → their full report. Type a mobile name → that phone’s buy/sell report."
      />

      <MzSection title="Search">
        <MzField label="Name or mobile">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <MzInput
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                className="min-w-[280px] flex-1 sm:min-w-[360px]"
                placeholder="Person: Kashif · Mobile: Samsung A54 / IMEI"
                autoFocus
              />
              <MzPrimaryButton onClick={() => runSearch()}>Show report</MzPrimaryButton>
            </div>
            <MzOptionalCameraImeiScan
              label="Camera scan IMEI (optional)"
              onDetected={(code) => {
                setQ(code);
                runSearch(code);
              }}
            />
          </div>
        </MzField>
        <p className={`text-xs ${mutedClass}`}>
          Example: write <strong>Kashif</strong> for customer report, or <strong>iPhone 13</strong> for
          mobile report.
        </p>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
      </MzSection>

      {liveQ && result && !showPersonReport && !showProductReport ? (
        <p className={`text-sm ${mutedClass}`}>No report for “{liveQ}”.</p>
      ) : null}

      {/* —— PERSON REPORT —— */}
      {showPersonReport ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Person report — {liveQ}</h2>

          {result!.customers.length > 1 ? (
            <MzSection title={`Matching people (${result!.customers.length})`}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {result!.customers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`${cardClass} w-full p-3 text-left transition hover:ring-2 hover:ring-[var(--mz-accent)] ${
                        selectedCustomerId === c.id ? "ring-2 ring-[var(--mz-accent)]" : ""
                      }`}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        const next = new URLSearchParams(params);
                        next.set("q", liveQ);
                        next.set("customerId", c.id);
                        setParams(next, { replace: true });
                      }}
                    >
                      <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                      <p className={`text-xs ${mutedClass}`}>
                        {c.phone || "No phone"} · {c.cnic || "No CNIC"}
                        {(c.pendingPkr || 0) > 0 ? ` · due ${formatPkr(c.pendingPkr)}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </MzSection>
          ) : null}

          {customerDetail?.customer ? (
            <CustomerHistoryPanel
              branchCode={branchCode!}
              customer={customerDetail.customer}
              hist={customerDetail}
            />
          ) : null}

          {result!.shopkeepers.length > 0 ? (
            <MzSection title="Shopkeepers">
              <ul className="grid gap-2 sm:grid-cols-2">
                {result!.shopkeepers.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`${cardClass} w-full p-3 text-left ${
                        selectedShopkeeperId === s.id ? "ring-2 ring-[var(--mz-accent)]" : ""
                      }`}
                      onClick={() => setSelectedShopkeeperId(s.id)}
                    >
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Shop {s.shopNo} — {s.name}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </MzSection>
          ) : null}

          {shopkeeperDetail?.shopkeeper ? (
            <ShopkeeperHistoryPanel shopkeeper={shopkeeperDetail.shopkeeper} hist={shopkeeperDetail} />
          ) : null}

          {showNameFallback ? (
            <div className="space-y-4">
              <div className={`${cardClass} p-4`}>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {result!.personByName.label}
                </h3>
                <p className={`text-sm ${mutedClass}`}>
                  Deals found by name on bills
                  {result!.personByName.pendingPkr > 0
                    ? ` · due ${formatPkr(result!.personByName.pendingPkr)}`
                    : ""}
                </p>
              </div>
              <HistoryBlock
                title="Purchases (from this person)"
                rows={result!.personByName.purchases.map((p) => ({
                  id: p.id,
                  line: `${p.brand} ${p.model} (${p.imei}) · ${formatPkr(p.purchasePricePkr)} · ${new Date(p.createdAt).toLocaleString()}`,
                }))}
              />
              <HistoryBlock
                title="Sales (to this person)"
                rows={result!.personByName.sales.map((s) => ({
                  id: s.id,
                  line: `${s.brand} ${s.model} (${s.imei}) · ${formatPkr(s.pricePkr)} · due ${formatPkr(s.remainingPkr)} · ${new Date(s.createdAt).toLocaleString()}`,
                }))}
              />
              <HistoryBlock
                title="Payments / ledger"
                rows={result!.personByName.ledger.map((e) => ({
                  id: e.id,
                  line: `${e.direction} ${formatPkr(e.amountPkr)} (${e.method}) · ${new Date(e.createdAt).toLocaleString()}`,
                }))}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* —— MOBILE / PRODUCT REPORT —— */}
      {showProductReport ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mobile report — {liveQ}</h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`${cardClass} p-4`}>
              <p className={`text-xs uppercase ${mutedClass}`}>Bought</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatPkr(
                  imeiBlock
                    ? imeiBlock.purchases.reduce((n, p) => n + p.purchasePricePkr, 0)
                    : productBlock?.boughtPkr ?? 0,
                )}
              </p>
              <p className={`text-xs ${mutedClass}`}>{purchaseRows.length} purchase(s)</p>
            </div>
            <div className={`${cardClass} p-4`}>
              <p className={`text-xs uppercase ${mutedClass}`}>Sold</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatPkr(
                  imeiBlock
                    ? imeiBlock.sales.filter((s) => !s.returnedAt).reduce((n, s) => n + s.pricePkr, 0)
                    : productBlock?.soldPkr ?? 0,
                )}
              </p>
              <p className={`text-xs ${mutedClass}`}>{saleRows.length} sale(s)</p>
            </div>
            <div className={`${cardClass} p-4`}>
              <p className={`text-xs uppercase ${mutedClass}`}>Profit</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatPkr(
                  imeiBlock
                    ? imeiBlock.sales.filter((s) => !s.returnedAt).reduce((n, s) => n + s.profitPkr, 0)
                    : productBlock?.profitPkr ?? 0,
                )}
              </p>
            </div>
          </div>

          {imeiBlock?.device ? (
            <div className={`${cardClass} p-4`}>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {imeiBlock.device.brand} {imeiBlock.device.model}
              </h3>
              <p className={`font-mono text-sm ${mutedClass}`}>{imeiBlock.device.imei}</p>
              <p className={`text-sm ${mutedClass}`}>
                Status: {imeiBlock.device.status.replace("_", " ")} · Cost{" "}
                {formatPkr(imeiBlock.device.purchasePricePkr)}
              </p>
            </div>
          ) : null}

          {(productBlock?.devices.length ?? 0) > 0 ? (
            <MzSection title={`Matching phones (${productBlock!.devices.length})`}>
              <ul className="space-y-1 text-sm">
                {productBlock!.devices.slice(0, 30).map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 dark:border-slate-800"
                  >
                    <span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {d.brand} {d.model}
                      </span>
                      <span className={`ml-2 font-mono text-xs ${mutedClass}`}>{d.imei}</span>
                      <span className={`ml-2 text-xs capitalize ${mutedClass}`}>
                        {d.status.replace("_", " ")}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--mz-accent)] underline-offset-2 hover:underline"
                      onClick={() => {
                        setQ(d.imei);
                        runSearch(d.imei);
                      }}
                    >
                      Open this IMEI
                    </button>
                  </li>
                ))}
              </ul>
            </MzSection>
          ) : null}

          <HistoryBlock
            title="Purchase history"
            rows={purchaseRows.map((p) => ({
              id: p.id,
              line: `${p.brand} ${p.model} (${p.imei}) · Seller ${p.sellerName} · ${formatPkr(p.purchasePricePkr)} · ${new Date(p.createdAt).toLocaleString()}`,
            }))}
          />
          <HistoryBlock
            title="Sale history"
            rows={saleRows.map((s) => ({
              id: s.id,
              line: `${s.brand} ${s.model} (${s.imei}) · Buyer ${s.customerName} · ${formatPkr(s.pricePkr)} · profit ${formatPkr(s.profitPkr)} · due ${formatPkr(s.remainingPkr)} · ${new Date(s.createdAt).toLocaleString()}`,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function CustomerHistoryPanel({
  branchCode,
  customer,
  hist,
}: {
  branchCode: string;
  customer: MobizoneCustomer;
  hist: ReturnType<typeof customerHistory>;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className={`${cardClass} flex flex-wrap gap-4 p-4`}>
        {customer.photoDataUrl ? (
          <img src={customer.photoDataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">{customer.name}</h3>
          <p className={`text-sm ${mutedClass}`}>
            {customer.cnic || "No CNIC"} · {customer.phone || "no phone"}
          </p>
          <p className={`text-sm ${mutedClass}`}>{customer.address || "—"}</p>
          {(customer.pendingPkr || 0) > 0 ? (
            <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
              Pending {formatPkr(customer.pendingPkr)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <MzSecondaryButton
              onClick={() =>
                openWhatsApp(
                  customer.phone,
                  buildWhatsAppAccountStatement(branchCode, "customer", customer.id),
                )
              }
            >
              WhatsApp statement
            </MzSecondaryButton>
            <Link to="/pops/mobizone/customers">
              <MzSecondaryButton>Open customers</MzSecondaryButton>
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          {customer.cnicFrontDataUrl ? (
            <img src={customer.cnicFrontDataUrl} alt="CNIC front" className="h-20 w-32 rounded object-cover" />
          ) : null}
          {customer.cnicBackDataUrl ? (
            <img src={customer.cnicBackDataUrl} alt="CNIC back" className="h-20 w-32 rounded object-cover" />
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Purchases" value={String(hist.purchases.length)} />
        <StatCard label="Sales" value={String(hist.sales.length)} />
        <StatCard
          label="Due"
          value={formatPkr(hist.sales.reduce((n, s) => n + (s.remainingPkr || 0), 0))}
        />
      </div>
      <HistoryBlock
        title="Purchases from this person"
        rows={hist.purchases.map((p) => ({
          id: p.id,
          line: `${p.brand} ${p.model} (${p.imei}) · ${formatPkr(p.purchasePricePkr)} · ${new Date(p.createdAt).toLocaleString()}`,
        }))}
      />
      <HistoryBlock
        title="Sales to this person"
        rows={hist.sales.map((s) => ({
          id: s.id,
          line: `${s.brand} ${s.model} (${s.imei}) · ${formatPkr(s.pricePkr)} · due ${formatPkr(s.remainingPkr)} · ${new Date(s.createdAt).toLocaleString()}`,
        }))}
      />
      <HistoryBlock
        title="Payment / ledger"
        rows={hist.ledger.map((e) => ({
          id: e.id,
          line: `${e.direction} ${formatPkr(e.amountPkr)} (${e.method}) · ${new Date(e.createdAt).toLocaleString()}`,
        }))}
      />
    </div>
  );
}

function ShopkeeperHistoryPanel({
  shopkeeper,
  hist,
}: {
  shopkeeper: MobizoneShopkeeper;
  hist: ReturnType<typeof shopkeeperHistory>;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className={`${cardClass} p-4`}>
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Shop {shopkeeper.shopNo} — {shopkeeper.name}
        </h3>
        <p className={`text-sm ${mutedClass}`}>{shopkeeper.phone || "No phone"}</p>
        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
          Balance {formatPkr(hist.balancePkr)}
        </p>
      </div>
      <HistoryBlock
        title="Purchases"
        rows={hist.purchases.map((p) => ({
          id: p.id,
          line: `${p.brand} ${p.model} (${p.imei}) · ${formatPkr(p.purchasePricePkr)} · due ${formatPkr(p.remainingPkr || 0)}`,
        }))}
      />
      <HistoryBlock
        title="Sales"
        rows={hist.sales.map((s) => ({
          id: s.id,
          line: `${s.brand} ${s.model} (${s.imei}) · ${formatPkr(s.pricePkr)} · due ${formatPkr(s.remainingPkr)}`,
        }))}
      />
      <HistoryBlock
        title="Ledger"
        rows={hist.ledger.map((e) => ({
          id: e.id,
          line: `${e.direction} ${formatPkr(e.amountPkr)} (${e.method}) · ${new Date(e.createdAt).toLocaleString()}`,
        }))}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className={`${cardClass} p-3`}>
      <p className={`text-xs uppercase ${mutedClass}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
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
