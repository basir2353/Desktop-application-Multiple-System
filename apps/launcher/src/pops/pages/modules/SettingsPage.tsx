import { Button } from "@platform/ui";
import type { DataResetScope } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { useSessionStore } from "../../../stores/sessionStore";
import {
  fetchBusinessProfile,
  resetOrgData,
  updatePopsBranch,
} from "../../api/operations";
import {
  DEFAULT_POS_SETTINGS,
  loadPosSettings,
  normalizePosSettings,
  posSettingsFromTaxApi,
  savePosSettings,
  savePosSettingsSynced,
  type PosSettings,
} from "../../lib/posSettings";
import { POS_ORDER_MODES, type PosOrderMode } from "../../lib/posOrderMode";
import {
  DEFAULT_POS_ORDER_MODE_VISIBILITY,
  loadPosOrderModeVisibility,
  normalizePosOrderModeVisibility,
  POS_ORDER_MODE_VISIBILITY_KEYS,
  savePosOrderModeVisibility,
  type PosOrderModeVisibility,
} from "../../lib/posOrderModeVisibility";
import {
  applyOrderNumberStart,
  peekNextOrderRef,
} from "../../lib/orderNumber";
import {
  defaultOrderNumberSettings,
  loadOrderNumberSettings,
  normalizeOrderNumberSettings,
  previewOrderRef,
  saveOrderNumberSettings,
  type OrderNumberSettings,
} from "../../lib/orderNumberSettings";
import { fetchTaxSettings } from "../../api/accounting";
import {
  loadBillPrintSettings,
  saveBillPrintSettings,
} from "../../lib/billPrintSettings";
import {
  authorizeTerminal,
  getOrCreateTerminalId,
  loadAuthorizedTerminals,
  revokeTerminal,
} from "../../lib/terminalAuth";
import { computeTicketTotals } from "../../lib/posDiscount";
import { DashboardBusinessDaySettings } from "../../components/dashboard/DashboardBusinessDaySettings";
import { TaxAuthoritySettingsPanel } from "../../components/TaxAuthoritySettingsPanel";
import {
  isTaxAuthorityEnabled,
  useTaxAuthorityFeatures,
} from "../../hooks/useTaxAuthorityFeatures";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useThemeStore } from "../../../stores/themeStore";

type OrderTypeChargeKey = {
  service: keyof PosSettings;
  tax: keyof PosSettings;
};

const ORDER_TYPE_CHARGE_KEYS: Record<PosOrderMode, OrderTypeChargeKey> = {
  "dine-in": { service: "serviceOnDineIn", tax: "taxOnDineIn" },
  takeaway: { service: "serviceOnTakeaway", tax: "taxOnTakeaway" },
  delivery: { service: "serviceOnDelivery", tax: "taxOnDelivery" },
  online: { service: "serviceOnOnline", tax: "taxOnOnline" },
  foodpanda: { service: "serviceOnFoodpanda", tax: "taxOnFoodpanda" },
  "staff-food": { service: "serviceOnStaffFood", tax: "taxOnStaffFood" },
};
import { hasAnyPermission, sessionCanManageUsers } from "../../lib/roleAccess";
import { PageHeader } from "../../ui/PageHeader";
import { fieldInputClass } from "../../lib/themeClasses";

const DATA_RESET_OPTIONS: {
  scope: DataResetScope;
  title: string;
  detail: string;
}[] = [
  {
    scope: "hr",
    title: "HR reset",
    detail:
      "Removes employees, payroll runs, advances, attendance, leave, and staff food. Users/login accounts stay.",
  },
  {
    scope: "restaurant",
    title: "Restaurant reset",
    detail:
      "Removes sales, bills, kitchen tickets, cash sessions, journals, expenses, inventory movements, and zeros stock balances. Menu and users stay.",
  },
  {
    scope: "all",
    title: "All data reset",
    detail:
      "Full wipe: restaurant + HR + store/pharmacy transactions. Users, menu, and catalogue stay. Dashboard and P&L go to zero.",
  },
];

function DataResetPanel(props: {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [scope, setScope] = useState<DataResetScope>("restaurant");
  const [confirmText, setConfirmText] = useState("");
  const profile = useQuery({
    queryKey: ["operations", "business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const businessName = profile.data?.name ?? "";

  const resetMut = useMutation({
    mutationFn: () => resetOrgData(scope, confirmText),
    onSuccess: (result) => {
      setConfirmText("");
      props.onNotice(result.message);
    },
    onError: (err) => {
      props.onError(err instanceof Error ? err.message : "Data reset failed");
    },
  });

  const confirmOk =
    confirmText.trim().toLowerCase() === "reset" ||
    (businessName.length > 0 &&
      confirmText.trim().toLowerCase() === businessName.trim().toLowerCase());

  const selected = DATA_RESET_OPTIONS.find((o) => o.scope === scope)!;

  return (
    <section className="max-w-xl space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">Data reset</h3>
      <p className="text-xs text-red-800/90 dark:text-red-200/90">
        Permanently delete module data for this business. This cannot be undone. Type{" "}
        <span className="font-semibold">RESET</span>
        {businessName ? (
          <>
            {" "}
            or the business name <span className="font-semibold">“{businessName}”</span>
          </>
        ) : null}{" "}
        to confirm.
      </p>

      <div className="space-y-2">
        {DATA_RESET_OPTIONS.map((opt) => (
          <label
            key={opt.scope}
            className="flex cursor-pointer gap-2 rounded-lg border border-red-200/80 bg-white/70 px-3 py-2 dark:border-red-900/50 dark:bg-slate-950/40"
          >
            <input
              type="radio"
              name="data-reset-scope"
              className="mt-1"
              checked={scope === opt.scope}
              onChange={() => setScope(opt.scope)}
            />
            <span>
              <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                {opt.title}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-600 dark:text-slate-400">
                {opt.detail}
              </span>
            </span>
          </label>
        ))}
      </div>

      <label className="block text-xs font-medium text-red-900 dark:text-red-100">
        Confirm
        <input
          className={`mt-1 w-full ${fieldInputClass}`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={businessName || "RESET"}
          autoComplete="off"
        />
      </label>

      <Button
        type="button"
        variant="ghost"
        className="text-xs text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
        disabled={resetMut.isPending || !confirmOk}
        onClick={() => {
          if (
            !window.confirm(
              `Reset ${selected.title.replace(/ reset$/i, "")} data? Deleted rows cannot be recovered.`,
            )
          ) {
            return;
          }
          resetMut.mutate();
        }}
      >
        {resetMut.isPending ? "Resetting…" : `Run ${selected.title.toLowerCase()}`}
      </Button>
    </section>
  );
}

export function SettingsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const setBranch = usePopsStore((s) => s.setBranch);
  const claims = useSessionStore((s) => s.claims);
  const themeMode = useThemeStore((s) => s.mode);
  const [saved, setSaved] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [draft, setDraft] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [modeVisibilityDraft, setModeVisibilityDraft] = useState<PosOrderModeVisibility>(
    DEFAULT_POS_ORDER_MODE_VISIBILITY,
  );
  const [orderNumDraft, setOrderNumDraft] = useState<OrderNumberSettings>(() =>
    defaultOrderNumberSettings(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [taxError, setTaxError] = useState<string | null>(null);
  const [branchDraft, setBranchDraft] = useState({ name: "", city: "", code: "" });
  const terminalId = getOrCreateTerminalId();
  const taxFeatures = useTaxAuthorityFeatures();
  const taxUnlockedBySuperAdmin = isTaxAuthorityEnabled(taxFeatures.data);

  const canManageTaxFeatures =
    sessionCanManageUsers(claims) ||
    hasAnyPermission(claims?.permissions, ["pops.accounting.manage", "pops.users.manage"]);
  /** Settings FBR/PRA toggles only after Super Admin enables tax for this business. */
  const showTaxFeatureToggles = canManageTaxFeatures && taxUnlockedBySuperAdmin;
  const canEditBranch = hasAnyPermission(claims?.permissions, [
    "pops.menu.manage",
    "pops.multi_branch.manage",
    "*",
  ]);
  const canResetData = sessionCanManageUsers(claims);

  const authorizedTerminals = useMemo(
    () => loadAuthorizedTerminals(branch?.code),
    [branch?.code, notice],
  );

  useEffect(() => {
    const loaded = loadPosSettings(branch?.code);
    setSaved(loaded);
    setDraft(loaded);
    setModeVisibilityDraft(loadPosOrderModeVisibility(branch?.code));
    setOrderNumDraft(loadOrderNumberSettings(branch?.code));
  }, [branch?.code]);

  const cloudTaxQuery = useQuery({
    queryKey: ["accounting", "tax", "pos-charges", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTaxSettings(branch!.code),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!branch?.code || !cloudTaxQuery.data) return;
    const local = loadPosSettings(branch.code);
    const fromCloud = posSettingsFromTaxApi(cloudTaxQuery.data, {
      showBillNotes: local.showBillNotes,
      fullScreenMenuEnabled: local.fullScreenMenuEnabled,
      menuViewMode: local.menuViewMode,
    });
    // Prefer cloud when it has explicit posCharges; otherwise keep local custom rates
    // but push local → cloud once so mobile can see them.
    if (cloudTaxQuery.data.posCharges) {
      savePosSettings(branch.code, fromCloud);
      setSaved(fromCloud);
      setDraft(fromCloud);
      return;
    }
    void savePosSettingsSynced(branch.code, local).catch(() => {
      // Local still works if sync fails (permissions / offline).
    });
  }, [branch?.code, cloudTaxQuery.data]);

  useEffect(() => {
    if (!branch) return;
    setBranchDraft({ name: branch.name, city: branch.city, code: branch.code });
  }, [branch?.id, branch?.name, branch?.city, branch?.code]);

  const branchUpdateMut = useMutation({
    mutationFn: () => {
      if (!branch?.id) throw new Error("No branch selected");
      return updatePopsBranch(branch.id, {
        name: branchDraft.name.trim(),
        city: branchDraft.city.trim(),
        code: branchDraft.code.trim() || undefined,
      });
    },
    onSuccess: (updated) => {
      setBranch({
        id: updated.id,
        code: updated.code,
        name: updated.name,
        city: updated.city,
      });
      setTaxError(null);
      setNotice(`Branch saved as “${updated.name}” (${updated.code}).`);
    },
    onError: (err) => {
      setNotice(null);
      setTaxError(err instanceof Error ? err.message : "Branch update failed");
    },
  });

  const preview = useMemo(() => {
    const sampleSubtotal = 10_000;
    const taxPct = draft.taxByPaymentMethod
      ? draft.taxEnabled
        ? draft.cashTaxPct
        : 0
      : draft.taxEnabled
        ? draft.taxPct
        : 0;
    const autoDisc = draft.autoDiscountEnabled
      ? Math.round(sampleSubtotal * (draft.autoDiscountPct / 100))
      : 0;
    return computeTicketTotals(sampleSubtotal, autoDisc, draft.servicePct, taxPct);
  }, [draft]);

  async function apply(): Promise<void> {
    if (!branch?.code) return;
    try {
      const next = normalizePosSettings(draft);
      // If tax master toggle is off, force payment-method tax off too.
      if (!next.taxEnabled) {
        next.taxByPaymentMethod = false;
      }
      let syncedToCloud = false;
      let syncError: string | null = null;
      try {
        await savePosSettingsSynced(branch.code, next);
        syncedToCloud = true;
      } catch (err) {
        // Still save locally so desktop POS works even if cloud sync is denied.
        savePosSettings(branch.code, next);
        syncError = err instanceof Error ? err.message : "Cloud sync failed";
      }
      // Keep bill print template in sync: off means hide Tax line on next prints.
      const billPrint = loadBillPrintSettings(branch.code);
      saveBillPrintSettings(branch.code, {
        ...billPrint,
        fields: { ...billPrint.fields, tax: next.taxEnabled },
      });
      setSaved(next);
      setDraft(next);
      const nextVisibility = normalizePosOrderModeVisibility(modeVisibilityDraft);
      savePosOrderModeVisibility(branch.code, nextVisibility);
      setModeVisibilityDraft(nextVisibility);
      if (syncedToCloud) {
        setTaxError(null);
        setNotice(
          next.taxEnabled
            ? `POS charges saved & synced for mobile (service ${next.servicePct}%). Tax is ON for new tickets.`
            : `POS charges saved & synced for mobile (service ${next.servicePct}%). Tax is OFF — new bills will not add or show tax.`,
        );
      } else {
        setNotice(
          `Saved on this PC only (service ${next.servicePct}%). Mobile will keep the old rate until cloud sync works.`,
        );
        setTaxError(
          `Cloud sync failed — ${syncError ?? "unknown"}. Need permission pops.accounting.manage or pops.menu.manage, then Save again.`,
        );
      }
    } catch (err) {
      setTaxError(err instanceof Error ? err.message : "Could not save POS settings (storage full?).");
      setNotice(null);
    }
  }

  function reset(): void {
    setDraft(DEFAULT_POS_SETTINGS);
    setModeVisibilityDraft(DEFAULT_POS_ORDER_MODE_VISIBILITY);
  }

  if (!branch?.code) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Select a branch for POS charges, or manage FBR / PRA for the business below."
        />
        {notice ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            {notice}
          </p>
        ) : null}
        {taxError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {taxError}
          </p>
        ) : null}
        {showTaxFeatureToggles ? (
          <TaxAuthoritySettingsPanel
            onNotice={(m) => {
              setTaxError(null);
              setNotice(m);
            }}
            onError={(m) => {
              setNotice(null);
              setTaxError(m);
            }}
          />
        ) : canManageTaxFeatures ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            FBR / PRA Settings appear here only after the platform Super Admin enables FBR, FPRA, or Real PRA for this business.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Ask an Admin to manage FBR / FPRA / Real PRA in Settings (after Super Admin unlocks
            tax for this business).
          </p>
        )}

        {canResetData ? (
          <DataResetPanel
            onNotice={(m) => {
              setTaxError(null);
              setNotice(m);
            }}
            onError={(m) => {
              setNotice(null);
              setTaxError(m);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle={`Branch configuration for ${branch.name} (${branch.code}) — POS, tax, FBR/PRA, and terminals.`}
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}
      {taxError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {taxError}
        </p>
      ) : null}

      {canEditBranch ? (
        <section className="max-w-xl space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Branch details</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Edit the currently open branch. Name and city are safe to change anytime.
          </p>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Name
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={branchDraft.name}
              onChange={(e) => setBranchDraft((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            City
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={branchDraft.city}
              onChange={(e) => setBranchDraft((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Code
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={branchDraft.code}
              onChange={(e) => setBranchDraft((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
          <Button
            type="button"
            disabled={
              branchUpdateMut.isPending ||
              !branchDraft.name.trim() ||
              !branchDraft.city.trim() ||
              (branchDraft.name === branch.name &&
                branchDraft.city === branch.city &&
                branchDraft.code === branch.code)
            }
            onClick={() => branchUpdateMut.mutate()}
          >
            {branchUpdateMut.isPending ? "Saving…" : "Save branch"}
          </Button>
        </section>
      ) : null}

      {showTaxFeatureToggles ? (
        <TaxAuthoritySettingsPanel
          onNotice={(m) => {
            setTaxError(null);
            setNotice(m);
          }}
          onError={(m) => {
            setNotice(null);
            setTaxError(m);
          }}
        />
      ) : canManageTaxFeatures ? (
        <p className="max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          FBR / PRA Settings appear here only after the platform Super Admin enables FBR, FPRA,
          or Real PRA for this business.
        </p>
      ) : null}

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</div>
        <p className="mt-1 text-xs text-slate-500">
          Choose light or dark mode for the restaurant ERP interface. Current: {themeMode}.
        </p>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">POS charges & tax</div>
        <p className="mt-1 text-xs text-slate-500">
          Current: service {saved.servicePct}%
          {(() => {
            const serviceModes = POS_ORDER_MODES.filter(
              (m) => Boolean(saved[ORDER_TYPE_CHARGE_KEYS[m.id].service]),
            ).map((m) => m.label);
            return serviceModes.length
              ? ` on ${serviceModes.join(", ")}`
              : " (off for all order types)";
          })()}
          , tax{" "}
          {saved.taxEnabled
            ? (() => {
                const taxModes = POS_ORDER_MODES.filter(
                  (m) => Boolean(saved[ORDER_TYPE_CHARGE_KEYS[m.id].tax]),
                ).map((m) => m.label);
                return taxModes.length
                  ? `${saved.taxPct}% on ${taxModes.join(", ")}`
                  : "off for all order types";
              })()
            : "off"}
          {saved.autoDiscountEnabled ? `, auto discount ${saved.autoDiscountPct}%` : ""}.
        </p>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={draft.taxEnabled}
            onChange={(e) => setDraft((prev) => ({ ...prev, taxEnabled: e.target.checked }))}
          />
          Enable tax on invoices
        </label>

        <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={draft.taxByPaymentMethod}
            disabled={!draft.taxEnabled}
            onChange={(e) => setDraft((prev) => ({ ...prev, taxByPaymentMethod: e.target.checked }))}
          />
          Different tax rates by payment method (cash / card / online)
        </label>

        <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={draft.autoDiscountEnabled}
            onChange={(e) => setDraft((prev) => ({ ...prev, autoDiscountEnabled: e.target.checked }))}
          />
          Automatic discount on every sale
        </label>
        <p className="mt-1 text-[10px] text-slate-500">
          When enabled, this discount applies to every ticket automatically (discountable items only).
          Original item prices stay visible; the discounted amount shows separately in the totals.
        </p>

        <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={draft.showBillNotes}
            onChange={(e) => setDraft((prev) => ({ ...prev, showBillNotes: e.target.checked }))}
          />
          Show bill note on POS ticket
        </label>
        <p className="mt-1 text-[10px] text-slate-500">
          On: bill note / item note fields appear on New order. Off: those fields are hidden.
        </p>

        <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
          <div className="text-xs font-semibold text-slate-300">Display · Full screen menu</div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={draft.fullScreenMenuEnabled}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, fullScreenMenuEnabled: e.target.checked }))
              }
            />
            Enable Full Screen Menu button on POS
          </label>
          <p className="mt-1 text-[10px] text-slate-500">
            After Dine-in / Takeaway / Delivery, show a Full Screen control so waiters can browse the
            menu on the whole screen during rush.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!draft.fullScreenMenuEnabled}
              onClick={() => setDraft((prev) => ({ ...prev, menuViewMode: "category" }))}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                draft.menuViewMode === "category"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 ring-1 ring-slate-700 disabled:opacity-40"
              }`}
            >
              Category wise
            </button>
            <button
              type="button"
              disabled={!draft.fullScreenMenuEnabled}
              onClick={() => setDraft((prev) => ({ ...prev, menuViewMode: "all" }))}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                draft.menuViewMode === "all"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 ring-1 ring-slate-700 disabled:opacity-40"
              }`}
            >
              All items
            </button>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Category wise: categories on top, items below. All items: every dish in one list.
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Service charge (%)
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={draft.servicePct}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, servicePct: Number(e.target.value) || 0 }))
              }
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Automatic discount (%)
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={draft.autoDiscountPct}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, autoDiscountPct: Number(e.target.value) || 0 }))
              }
              disabled={!draft.autoDiscountEnabled}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
          <div className="text-xs font-medium text-slate-300">Charges by order type</div>
          <p className="mt-1 text-[10px] text-slate-500">
            Show = tab appears on POS. Service / Tax = whether those charges apply. At least one
            order type must stay on.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs text-slate-400">
              <thead>
                <tr className="border-b border-slate-700/80 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-2 font-medium">Order type</th>
                  <th className="pb-2 px-2 font-medium text-center">Show</th>
                  <th className="pb-2 px-2 font-medium text-center">Service</th>
                  <th className="pb-2 pl-2 font-medium text-center">Tax</th>
                </tr>
              </thead>
              <tbody>
                {POS_ORDER_MODES.map(({ id, label }) => {
                  const keys = ORDER_TYPE_CHARGE_KEYS[id];
                  const showKey = POS_ORDER_MODE_VISIBILITY_KEYS[id];
                  const showChecked = Boolean(modeVisibilityDraft[showKey]);
                  const enabledCount = Object.values(modeVisibilityDraft).filter(Boolean).length;
                  return (
                    <tr key={id} className="border-b border-slate-800/80 last:border-0">
                      <td className="py-2 pr-2 text-slate-300">{label}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Show ${label} on POS`}
                          checked={showChecked}
                          disabled={showChecked && enabledCount <= 1}
                          onChange={(e) =>
                            setModeVisibilityDraft((prev) =>
                              normalizePosOrderModeVisibility({
                                ...prev,
                                [showKey]: e.target.checked,
                              }),
                            )
                          }
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Service on ${label}`}
                          checked={Boolean(draft[keys.service])}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [keys.service]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="py-2 pl-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Tax on ${label}`}
                          checked={Boolean(draft[keys.tax])}
                          disabled={!draft.taxEnabled}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [keys.tax]: e.target.checked }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Default sales tax (%)
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={draft.taxPct}
              onChange={(e) => setDraft((prev) => ({ ...prev, taxPct: Number(e.target.value) || 0 }))}
              disabled={!draft.taxEnabled}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Cash payment tax (%)
            <input
              type="number"
              min={0}
              max={30}
              value={draft.cashTaxPct}
              onChange={(e) => setDraft((prev) => ({ ...prev, cashTaxPct: Number(e.target.value) || 0 }))}
              disabled={!draft.taxByPaymentMethod || !draft.taxEnabled}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Card payment tax (%)
            <input
              type="number"
              min={0}
              max={30}
              value={draft.cardTaxPct}
              onChange={(e) => setDraft((prev) => ({ ...prev, cardTaxPct: Number(e.target.value) || 0 }))}
              disabled={!draft.taxByPaymentMethod || !draft.taxEnabled}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Online payment tax (%)
            <input
              type="number"
              min={0}
              max={30}
              value={draft.onlineTaxPct}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, onlineTaxPct: Number(e.target.value) || 0 }))
              }
              disabled={!draft.taxByPaymentMethod || !draft.taxEnabled}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Example on Rs 10,000 subtotal
          {draft.autoDiscountEnabled
            ? ` with ${draft.autoDiscountPct}% auto discount`
            : ""}
          : service Rs {preview.service.toLocaleString()}, tax Rs {preview.tax.toLocaleString()}
          {preview.discount > 0 ? `, discount −Rs ${preview.discount.toLocaleString()}` : ""}, total
          Rs {preview.total.toLocaleString()}.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" className="text-xs" onClick={() => apply()}>
            Save POS settings
          </Button>
          <Button type="button" variant="ghost" className="text-xs" onClick={() => reset()}>
            Reset to defaults
          </Button>
        </div>
      </div>

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Order numbering</div>
        <p className="mt-1 text-xs text-slate-500">
          Control how POS order numbers start, how many digits show, and whether each order type
          (Dine-in, Takeaway, Delivery…) has its own sequence.
        </p>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={orderNumDraft.separateByOrderType}
            onChange={(e) =>
              setOrderNumDraft((prev) => ({ ...prev, separateByOrderType: e.target.checked }))
            }
          />
          Separate sequence per order type
        </label>

        {!orderNumDraft.separateByOrderType ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-slate-400">
              Prefix
              <input
                value={orderNumDraft.prefix}
                maxLength={8}
                onChange={(e) =>
                  setOrderNumDraft((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))
                }
                className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                placeholder="ORD"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Start from
              <input
                type="number"
                min={1}
                max={999999999}
                value={orderNumDraft.startAt}
                onChange={(e) =>
                  setOrderNumDraft((prev) => ({
                    ...prev,
                    startAt: Number(e.target.value) || 1,
                  }))
                }
                className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Digits to show
              <input
                type="number"
                min={0}
                max={8}
                value={orderNumDraft.digitCount}
                onChange={(e) =>
                  setOrderNumDraft((prev) => ({
                    ...prev,
                    digitCount: Number(e.target.value) || 0,
                  }))
                }
                className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
              <span className="mt-1 block text-[10px] text-slate-500">
                0 = no padding. 4 → 0007
              </span>
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-slate-400 sm:max-w-[10rem]">
              Digits to show (all types)
              <input
                type="number"
                min={0}
                max={8}
                value={orderNumDraft.digitCount}
                onChange={(e) =>
                  setOrderNumDraft((prev) => ({
                    ...prev,
                    digitCount: Number(e.target.value) || 0,
                  }))
                }
                className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </label>
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
              <table className="w-full min-w-[360px] text-left text-xs text-slate-400">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Order type</th>
                    <th className="px-2 py-2 font-medium">Prefix</th>
                    <th className="px-2 py-2 font-medium">Start from</th>
                    <th className="px-3 py-2 font-medium">Next preview</th>
                  </tr>
                </thead>
                <tbody>
                  {POS_ORDER_MODES.map(({ id, label }) => {
                    const row = orderNumDraft.byMode[id];
                    const nextPreview = previewOrderRef(
                      orderNumDraft,
                      Math.max(row.startAt, 1),
                      id,
                    );
                    return (
                      <tr key={id} className="border-b border-slate-800/80 last:border-0">
                        <td className="px-3 py-2 text-slate-300">{label}</td>
                        <td className="px-2 py-2">
                          <input
                            value={row.prefix}
                            maxLength={8}
                            onChange={(e) =>
                              setOrderNumDraft((prev) => ({
                                ...prev,
                                byMode: {
                                  ...prev.byMode,
                                  [id]: {
                                    ...prev.byMode[id],
                                    prefix: e.target.value.toUpperCase(),
                                  },
                                },
                              }))
                            }
                            className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500/50"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            value={row.startAt}
                            onChange={(e) =>
                              setOrderNumDraft((prev) => ({
                                ...prev,
                                byMode: {
                                  ...prev.byMode,
                                  [id]: {
                                    ...prev.byMode[id],
                                    startAt: Number(e.target.value) || 1,
                                  },
                                },
                              }))
                            }
                            className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500/50"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-300/90">{nextPreview}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Next on this terminal
          {orderNumDraft.separateByOrderType
            ? `: e.g. ${previewOrderRef(orderNumDraft, orderNumDraft.byMode["dine-in"].startAt, "dine-in")} (Dine-in start)`
            : `: ${previewOrderRef(orderNumDraft, orderNumDraft.startAt)}`}
          {branch?.code ? ` · live peek ${peekNextOrderRef(branch.code, "dine-in")}` : ""}.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="text-xs"
            onClick={() => {
              const savedNum = saveOrderNumberSettings(branch?.code, orderNumDraft);
              setOrderNumDraft(savedNum);
              if (savedNum.separateByOrderType) {
                for (const { id } of POS_ORDER_MODES) {
                  applyOrderNumberStart(branch?.code, savedNum, id);
                }
              } else {
                applyOrderNumberStart(branch?.code, savedNum);
              }
              setNotice(
                savedNum.separateByOrderType
                  ? "Order numbering saved (per order type)."
                  : `Order numbering saved. Next starts from ${savedNum.prefix}-${savedNum.startAt}.`,
              );
            }}
          >
            Save order numbering
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => setOrderNumDraft(normalizeOrderNumberSettings(null))}
          >
            Reset numbering defaults
          </Button>
        </div>
      </div>

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Authorized terminals</div>
        <p className="mt-1 text-xs text-slate-500">
          Restrict POS access to registered devices. This terminal: <code>{terminalId}</code>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            className="text-xs"
            onClick={() => {
              authorizeTerminal(branch.code);
              setNotice("This terminal authorized for POS access.");
            }}
          >
            Authorize this terminal
          </Button>
        </div>
        {authorizedTerminals.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            {authorizedTerminals.map((id) => (
              <li key={id} className="flex items-center justify-between">
                <span>{id}</span>
                <button
                  type="button"
                  className="text-red-400"
                  onClick={() => {
                    revokeTerminal(branch.code, id);
                    setNotice(`Terminal ${id} revoked.`);
                  }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No restrictions — all terminals allowed.</p>
        )}
      </div>

      <div className="max-w-xl">
        <DashboardBusinessDaySettings branchCode={branch.code} />
      </div>

      {canResetData ? (
        <DataResetPanel
          onNotice={(m) => {
            setTaxError(null);
            setNotice(m);
          }}
          onError={(m) => {
            setNotice(null);
            setTaxError(m);
          }}
        />
      ) : null}
    </div>
  );
}