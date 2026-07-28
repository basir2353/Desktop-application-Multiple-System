import type { StorePromotion, StoreShift } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "../../pops/ui/Badge";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import {
  closeStoreShift,
  createStorePromotion,
  fetchStoreCategories,
  fetchStoreOpenShift,
  fetchStoreProducts,
  fetchStorePromotions,
  fetchStoreShifts,
  fetchStoreSuppliers,
  openStoreShift,
  toggleStorePromotion,
} from "../api/store";
import {
  buildPromotionPayload,
  StoreAutomaticDiscountWizard,
  type PromoWizardDraft,
} from "../components/StoreAutomaticDiscountWizard";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { loadStoreCashSetup } from "../lib/storeCashSetup";
import { getTerminalId } from "../lib/storePosSync";
import { describePromotionRule } from "../lib/storePromotions";
import { StoreField, StoreInput, StoreSelect } from "../ui/StoreUi";
import { Link } from "react-router-dom";

export function StoreShiftPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const terminalId = getTerminalId();
  const setup = loadStoreCashSetup(branch?.code);
  const [cashierName, setCashierName] = useState(setup.defaultCashierName);
  const [openingCash, setOpeningCash] = useState(String(setup.defaultOpeningCashPkr));
  const [closingCash, setClosingCash] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openShiftQuery = useQuery({
    queryKey: ["store", "shift-open", branch?.code, terminalId],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreOpenShift(branch!.code, terminalId),
  });

  const shiftsQuery = useQuery({
    queryKey: ["store", "shifts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreShifts(branch!.code),
  });

  const openMutation = useMutation({
    mutationFn: () =>
      openStoreShift({
        branchCode: branch!.code,
        cashierName: cashierName.trim(),
        openingCashPkr: Number(openingCash) || 0,
        terminalId,
      }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeStoreShift(openShiftQuery.data!.id, { closingCashPkr: Number(closingCash) }),
    onSuccess: () => { invalidate(); setClosingCash(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const openShift = openShiftQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader title="Shift & cash reconciliation" subtitle={`Terminal ${terminalId} — compare expected vs actual cash at shift close.`} />
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          to="/pops/store/pay-in-out"
          className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/20"
        >
          Open Pay In / Pay Out
        </Link>
        <Link
          to="/pops/store/setup"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500"
        >
          General Store setup
        </Link>
      </div>
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {openShift ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 dark:bg-emerald-950/20">
          <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Active shift — {openShift.cashierName}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Stat label="Opening cash" value={formatPkr(openShift.openingCashPkr)} />
            <Stat label="Sales this shift" value={formatPkr(openShift.totalSalesPkr)} />
            <Stat label="Transactions" value={String(openShift.transactionCount)} />
            <Stat label="Opened" value={new Date(openShift.openedAt).toLocaleTimeString()} />
          </div>
          <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); closeMutation.mutate(); }}>
            <StoreField label="Closing cash counted">
              <StoreInput type="number" min={0} value={closingCash} onChange={(e) => setClosingCash(e.target.value)} required />
            </StoreField>
            <button type="submit" disabled={!closingCash || closeMutation.isPending} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
              Close shift & reconcile
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Record drawer Pay In / Pay Out on the dedicated{" "}
            <Link className="text-emerald-400 hover:underline" to="/pops/store/pay-in-out">
              Pay In / Pay Out
            </Link>{" "}
            page (with slips & reason presets).
          </p>
        </div>
      ) : (
        <form className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); openMutation.mutate(); }}>
          <h2 className="text-sm font-semibold">Open new shift</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <StoreInput placeholder="Cashier name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} required />
            <StoreInput type="number" min={0} placeholder="Opening cash" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            <button type="submit" disabled={!cashierName.trim() || openMutation.isPending} className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Start shift</button>
          </div>
        </form>
      )}

      <SimpleTable<StoreShift>
        rowKey={(r) => r.id}
        columns={[
          { key: "cashierName", header: "Cashier" },
          { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "open" ? "success" : "neutral"}>{r.status}</Badge> },
          { key: "totalSalesPkr", header: "Sales", render: (r) => formatPkr(r.totalSalesPkr) },
          { key: "expectedCashPkr", header: "Expected cash", render: (r) => (r.expectedCashPkr != null ? formatPkr(r.expectedCashPkr) : "—") },
          { key: "cashDifferencePkr", header: "Variance", render: (r) => (r.cashDifferencePkr != null ? formatPkr(r.cashDifferencePkr) : "—") },
          { key: "openedAt", header: "Opened", render: (r) => new Date(r.openedAt).toLocaleString() },
        ]}
        rows={shiftsQuery.data ?? []}
      />
    </div>
  );
}

export function StorePromotionsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const promotionsQuery = useQuery({
    queryKey: ["store", "promotions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStorePromotions(branch!.code),
  });

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  const categoriesQuery = useQuery({
    queryKey: ["store", "categories", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreCategories(branch!.code),
  });

  const suppliersQuery = useQuery({
    queryKey: ["store", "suppliers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSuppliers(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: (draft: PromoWizardDraft) =>
      createStorePromotion(buildPromotionPayload(branch!.code, draft)),
    onSuccess: () => {
      invalidate();
      setWizardOpen(false);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleStorePromotion(id, isActive),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Discount Pricing"
        subtitle="Automatic discounts applied at POS for scheduled sales, multi-buy deals, and percentage off."
      />
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-300">Automatic Discounts</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Select items and define discount pricing automatically applied for things like:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>A temporary or scheduled sale (e.g., Friday through Sunday)</li>
              <li>Buy X for $Y (e.g., buy 3 for $10.00)</li>
              <li>Buy X and get Y% off (e.g., buy 12 and get 10% off all 12)</li>
              <li>Get Y% off item (e.g., buy item and get 15% off)</li>
            </ul>
          </div>
          {canManage ? (
            <button
              type="button"
              className="shrink-0 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
              onClick={() => { setError(null); setWizardOpen(true); }}
            >
              Set Up Automatic Discount
            </button>
          ) : null}
        </div>
      </section>

      {wizardOpen && canManage ? (
        <StoreAutomaticDiscountWizard
          products={productsQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          suppliers={suppliersQuery.data ?? []}
          saving={createMutation.isPending}
          onCancel={() => setWizardOpen(false)}
          onSave={(draft) => createMutation.mutate(draft)}
        />
      ) : null}

      <SimpleTable<StorePromotion>
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Name" },
          { key: "type", header: "Type", render: (r) => describePromotionRule(r) },
          {
            key: "isActive",
            header: "Active",
            render: (r) => (
              <button
                type="button"
                onClick={() => canManage && toggleMutation.mutate({ id: r.id, isActive: !r.isActive })}
                className="text-xs font-medium text-sky-600"
              >
                {r.isActive ? "Active" : "Inactive"}
              </button>
            ),
          },
          {
            key: "scope",
            header: "Applies to",
            render: (r) => {
              const cfg = (r.config ?? {}) as Record<string, unknown>;
              const scope = String(cfg.scope ?? (r.productIds.length ? "custom" : "all"));
              if (scope === "custom") return `${r.productIds.length} item(s)`;
              if (scope === "department") return "Department";
              if (scope === "vendor") return "Vendor";
              if (scope === "named") return `Name: ${String(cfg.nameContains ?? "")}`;
              return "All items";
            },
          },
          {
            key: "schedule",
            header: "Schedule",
            render: (r) =>
              r.startsAt || r.endsAt
                ? `${r.startsAt ? new Date(r.startsAt).toLocaleString() : "—"} → ${r.endsAt ? new Date(r.endsAt).toLocaleString() : "—"}`
                : "Always",
          },
        ]}
        rows={promotionsQuery.data ?? []}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
