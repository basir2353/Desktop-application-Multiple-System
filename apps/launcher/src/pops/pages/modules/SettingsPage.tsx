import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import {
  DEFAULT_POS_SETTINGS,
  loadPosSettings,
  normalizePosSettings,
  savePosSettings,
  type PosSettings,
} from "../../lib/posSettings";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  loadKotPrintSettings,
  normalizeKotPrintSettings,
  saveKotPrintSettings,
  type KotPrintSettings,
} from "../../lib/kotPrintSettings";
import {
  authorizeTerminal,
  getOrCreateTerminalId,
  loadAuthorizedTerminals,
  revokeTerminal,
} from "../../lib/terminalAuth";
import { PRINTER_PRESETS, loadPrinterAssignments, setCategoryPrinter, setItemPrinter, setUserPrinter } from "../../lib/printerAssignmentSettings";
import { fetchBranchMenuAdmin } from "../../api/menu";
import { fetchOrgUsers } from "../../api/users";
import { useQuery } from "@tanstack/react-query";
import { computeTicketTotals } from "../../lib/posDiscount";
import { DashboardBusinessDaySettings } from "../../components/dashboard/DashboardBusinessDaySettings";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useThemeStore } from "../../../stores/themeStore";
import { PageHeader } from "../../ui/PageHeader";

export function SettingsPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const themeMode = useThemeStore((s) => s.mode);
  const [saved, setSaved] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [draft, setDraft] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [kotSaved, setKotSaved] = useState<KotPrintSettings>(DEFAULT_KOT_PRINT_SETTINGS);
  const [kotDraft, setKotDraft] = useState<KotPrintSettings>(DEFAULT_KOT_PRINT_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);
  const terminalId = getOrCreateTerminalId();

  const menuQuery = useQuery({
    queryKey: ["menu", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
  });

  const usersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: () => fetchOrgUsers(),
  });

  const printerMap = useMemo(
    () => loadPrinterAssignments(branch?.code),
    [branch?.code, notice],
  );
  const authorizedTerminals = useMemo(
    () => loadAuthorizedTerminals(branch?.code),
    [branch?.code, notice],
  );

  useEffect(() => {
    const loaded = loadPosSettings(branch?.code);
    setSaved(loaded);
    setDraft(loaded);
    const kot = loadKotPrintSettings(branch?.code);
    setKotSaved(kot);
    setKotDraft(kot);
  }, [branch?.code]);

  const preview = useMemo(() => {
    const sampleSubtotal = 10_000;
    const taxPct = draft.taxByPaymentMethod ? draft.cashTaxPct : draft.taxEnabled ? draft.taxPct : 0;
    return computeTicketTotals(sampleSubtotal, 0, draft.servicePct, taxPct);
  }, [draft]);

  function apply(): void {
    if (!branch?.code) return;
    const next = normalizePosSettings(draft);
    savePosSettings(branch.code, next);
    setSaved(next);
    setDraft(next);
    setNotice("POS charges saved. They apply to new tickets immediately.");
  }

  function applyKot(): void {
    if (!branch?.code) return;
    const next = normalizeKotPrintSettings(kotDraft);
    saveKotPrintSettings(branch.code, next);
    setKotSaved(next);
    setKotDraft(next);
    setNotice("KOT print template saved.");
  }

  function reset(): void {
    setDraft(DEFAULT_POS_SETTINGS);
    setKotDraft(DEFAULT_KOT_PRINT_SETTINGS);
  }

  if (!branch?.code) {
    return <PageHeader title="Settings" subtitle="Select a branch to configure POS charges." />;
  }

  const categories = menuQuery.data?.categories ?? [];
  const items = menuQuery.data?.items ?? [];
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle={`Branch configuration for ${branch.name} (${branch.code}) — POS, tax, KOT, printers, and terminals.`}
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
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
          Current: service {saved.servicePct}%, tax {saved.taxEnabled ? `${saved.taxPct}%` : "off"}.
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
            onChange={(e) => setDraft((prev) => ({ ...prev, taxByPaymentMethod: e.target.checked }))}
          />
          Different tax rates by payment method (cash 16%, card 8%)
        </label>

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
              disabled={!draft.taxByPaymentMethod}
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
              disabled={!draft.taxByPaymentMethod}
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Example on Rs 10,000 subtotal: service Rs {preview.service.toLocaleString()}, tax Rs{" "}
          {preview.tax.toLocaleString()}, total Rs {preview.total.toLocaleString()}.
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
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Kitchen KOT print template</div>
        <p className="mt-1 text-xs text-slate-500">Customize how kitchen order tickets are printed.</p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={kotDraft.emphasizeOrderMeta}
              onChange={(e) => setKotDraft((p) => ({ ...p, emphasizeOrderMeta: e.target.checked }))}
            />
            Bold &amp; enlarge order number, order type, and table number
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={kotDraft.showItemTotals}
              onChange={(e) => setKotDraft((p) => ({ ...p, showItemTotals: e.target.checked }))}
            />
            Show total items and total item quantity
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={kotDraft.itemUnderlineSeparator}
              onChange={(e) => setKotDraft((p) => ({ ...p, itemUnderlineSeparator: e.target.checked }))}
            />
            Underline separator for each item
          </label>
          <label className="block text-xs text-slate-400">
            Base font size (px)
            <input
              type="number"
              min={9}
              max={14}
              value={kotDraft.baseFontSize}
              onChange={(e) =>
                setKotDraft((p) => ({ ...p, baseFontSize: Number(e.target.value) || 11 }))
              }
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="mt-4">
          <Button type="button" className="text-xs" onClick={() => applyKot()}>
            Save KOT template
          </Button>
        </div>
      </div>

      <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Printer assignment</div>
        <p className="mt-1 text-xs text-slate-500">
          Route KOT/receipt prints by user, category, or item. Item overrides category; category overrides user.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-400">User-wise</div>
            <ul className="mt-2 space-y-2">
              {users.slice(0, 8).map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <span className="w-40 truncate text-xs text-slate-300">{u.email}</span>
                  <select
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                    value={printerMap.byUser[u.id]?.printerName ?? ""}
                    onChange={(e) => {
                      setUserPrinter(branch.code, u.id, e.target.value);
                      setNotice(`Printer updated for ${u.email}`);
                    }}
                  >
                    <option value="">Default</option>
                    {PRINTER_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-400">Category-wise</div>
            <ul className="mt-2 space-y-2">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="w-40 truncate text-xs text-slate-300">{c.name}</span>
                  <select
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                    value={printerMap.byCategory[c.id]?.printerName ?? ""}
                    onChange={(e) => {
                      setCategoryPrinter(branch.code, c.id, e.target.value);
                      setNotice(`Printer updated for category ${c.name}`);
                    }}
                  >
                    <option value="">Default</option>
                    {PRINTER_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-400">Item-wise</div>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {items.slice(0, 20).map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className="w-40 truncate text-xs text-slate-300">{item.name}</span>
                  <select
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                    value={printerMap.byItem[item.id]?.printerName ?? ""}
                    onChange={(e) => {
                      setItemPrinter(branch.code, item.id, e.target.value);
                      setNotice(`Printer updated for ${item.name}`);
                    }}
                  >
                    <option value="">Default</option>
                    {PRINTER_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
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