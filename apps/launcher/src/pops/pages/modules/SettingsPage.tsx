import { Button } from "@platform/ui";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { updatePopsBranch } from "../../api/operations";
import {
  DEFAULT_POS_SETTINGS,
  loadPosSettings,
  normalizePosSettings,
  savePosSettings,
  type PosSettings,
} from "../../lib/posSettings";
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
import { hasAnyPermission, sessionCanManageUsers } from "../../lib/roleAccess";
import { PageHeader } from "../../ui/PageHeader";
import { fieldInputClass } from "../../lib/themeClasses";

export function SettingsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const setBranch = usePopsStore((s) => s.setBranch);
  const claims = useSessionStore((s) => s.claims);
  const themeMode = useThemeStore((s) => s.mode);
  const [saved, setSaved] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [draft, setDraft] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
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

  const authorizedTerminals = useMemo(
    () => loadAuthorizedTerminals(branch?.code),
    [branch?.code, notice],
  );

  useEffect(() => {
    const loaded = loadPosSettings(branch?.code);
    setSaved(loaded);
    setDraft(loaded);
  }, [branch?.code]);

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

  function apply(): void {
    if (!branch?.code) return;
    const next = normalizePosSettings(draft);
    // If tax master toggle is off, force payment-method tax off too.
    if (!next.taxEnabled) {
      next.taxByPaymentMethod = false;
    }
    savePosSettings(branch.code, next);
    // Keep bill print template in sync: off means hide Tax line on next prints.
    const billPrint = loadBillPrintSettings(branch.code);
    saveBillPrintSettings(branch.code, {
      ...billPrint,
      fields: { ...billPrint.fields, tax: next.taxEnabled },
    });
    setSaved(next);
    setDraft(next);
    setNotice(
      next.taxEnabled
        ? "POS charges saved. Tax is ON for new tickets."
        : "POS charges saved. Tax is OFF — new bills will not add or show tax.",
    );
  }

  function reset(): void {
    setDraft(DEFAULT_POS_SETTINGS);
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
          Current: service {saved.servicePct}%, tax {saved.taxEnabled ? `${saved.taxPct}%` : "off"}
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
    </div>
  );
}