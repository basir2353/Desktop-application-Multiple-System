import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePopsStore } from "../../../stores/popsStore";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  loadKotPrintSettings,
  normalizeKotPrintSettings,
  saveKotPrintSettings,
  type KotPrintSettings,
} from "../../lib/kotPrintSettings";
import {
  PRINTER_PRESETS,
  loadPrinterAssignments,
  setCategoryPrinter,
  setItemPrinter,
  setUserPrinter,
} from "../../lib/printerAssignmentSettings";
import { fetchBranchMenuAdmin } from "../../api/menu";
import { fetchOrgUsers } from "../../api/users";
import { PageHeader } from "../../ui/PageHeader";

export function PrinterPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const [kotSaved, setKotSaved] = useState<KotPrintSettings>(DEFAULT_KOT_PRINT_SETTINGS);
  const [kotDraft, setKotDraft] = useState<KotPrintSettings>(DEFAULT_KOT_PRINT_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);

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

  useEffect(() => {
    const kot = loadKotPrintSettings(branch?.code);
    setKotSaved(kot);
    setKotDraft(kot);
  }, [branch?.code]);

  function applyKot(): void {
    if (!branch?.code) return;
    const next = normalizeKotPrintSettings(kotDraft);
    saveKotPrintSettings(branch.code, next);
    setKotSaved(next);
    setKotDraft(next);
    setNotice("KOT print template saved.");
  }

  if (!branch?.code) {
    return <PageHeader title="Printer" subtitle="Select a branch to configure printer settings." />;
  }

  const categories = menuQuery.data?.categories ?? [];
  const items = menuQuery.data?.items ?? [];
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printer"
        subtitle={`Printer configuration for ${branch.name} (${branch.code}) — KOT template and printer assignment.`}
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </p>
      ) : null}

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
    </div>
  );
}
