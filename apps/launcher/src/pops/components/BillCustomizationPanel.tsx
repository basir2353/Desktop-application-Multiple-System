import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import { BillReceiptLayoutCanvas } from "./BillReceiptLayoutCanvas";
import { BillReceiptPreview } from "./BillReceiptPreview";
import {
  BILL_FIELD_GROUPS,
  BILL_FIELD_LABELS,
  BILL_FONT_SIZE_MAX,
  BILL_FONT_SIZE_MIN,
  DEFAULT_BILL_PRINT_SETTINGS,
  loadActiveBillTemplateId,
  newBillCustomLine,
  normalizeBillPrintSettings,
  saveActiveBillTemplateId,
  saveBillPrintSettings,
  type BillPrintSettings,
  type BillReceiptFields,
} from "../lib/billPrintSettings";
import {
  deleteBillPrintTemplate,
  loadBillPrintTemplates,
  saveBillPrintTemplate,
  starterBillPrintTemplates,
  type BillPrintTemplate,
} from "../lib/billPrintTemplates";
import { sampleBillPrintInput } from "../lib/billSampleReceipt";
import { fieldInputClass, fieldSelectClass } from "../lib/themeClasses";

type Props = {
  branchName: string;
  branchCode: string;
  settings: BillPrintSettings;
  onChange: (settings: BillPrintSettings) => void;
  onSave: () => void;
  onNotice?: (message: string) => void;
};

export function BillCustomizationPanel({
  branchName,
  branchCode,
  settings,
  onChange,
  onSave,
  onNotice,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<BillPrintSettings>(() => normalizeBillPrintSettings(settings));
  const [templates, setTemplates] = useState<BillPrintTemplate[]>(() =>
    loadBillPrintTemplates(branchCode),
  );
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => loadActiveBillTemplateId(branchCode) ?? "",
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setDraft(normalizeBillPrintSettings(settings));
  }, [settings]);

  useEffect(() => {
    setTemplates(loadBillPrintTemplates(branchCode));
    setSelectedTemplateId(loadActiveBillTemplateId(branchCode) ?? "");
  }, [branchCode]);

  const previewInput = useMemo(
    () => sampleBillPrintInput(branchName, branchCode),
    [branchName, branchCode],
  );

  function patch(partial: Partial<BillPrintSettings>): void {
    const next = normalizeBillPrintSettings({ ...draft, ...partial });
    setDraft(next);
    onChange(next);
  }

  function replaceDraft(nextRaw: BillPrintSettings): void {
    const next = normalizeBillPrintSettings(nextRaw);
    setDraft(next);
    onChange(next);
  }

  function patchField(key: keyof BillReceiptFields, value: boolean): void {
    patch({ fields: { ...draft.fields, [key]: value } });
  }

  function resetDefaults(): void {
    const next = normalizeBillPrintSettings(DEFAULT_BILL_PRINT_SETTINGS);
    setDraft(next);
    onChange(next);
    saveActiveBillTemplateId(branchCode, null);
    setSelectedTemplateId("");
  }

  function addLine(): void {
    if (draft.customLines.length >= 24) {
      onNotice?.("Maximum 24 custom lines.");
      return;
    }
    const line = newBillCustomLine({ text: "Custom line", zone: "footer", fontSize: 12 });
    const next = normalizeBillPrintSettings({
      ...draft,
      customLines: [...draft.customLines, line],
      blockOrder: [...draft.blockOrder, line.id],
    });
    setDraft(next);
    onChange(next);
    setSelectedBlockId(line.id);
  }

  function refreshTemplates(): void {
    setTemplates(loadBillPrintTemplates(branchCode));
  }

  function saveAsTemplate(): void {
    try {
      const name = templateName.trim() || `Template ${templates.length + 1}`;
      const saved = saveBillPrintTemplate(branchCode, name, draft, selectedTemplateId || undefined);
      setTemplateName("");
      setSelectedTemplateId(saved.id);
      refreshTemplates();
      onNotice?.(`Template “${saved.name}” saved.`);
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : "Could not save template.");
    }
  }

  /** Assign = apply template to live print settings immediately. */
  function assignTemplate(template: BillPrintTemplate): void {
    const next = normalizeBillPrintSettings(template.settings);
    setDraft(next);
    onChange(next);
    saveBillPrintSettings(branchCode, next);
    saveActiveBillTemplateId(branchCode, template.id);
    setSelectedTemplateId(template.id);
    onNotice?.(`Template “${template.name}” assigned — prints will use this layout.`);
  }

  function removeTemplate(id: string): void {
    deleteBillPrintTemplate(branchCode, id);
    if (selectedTemplateId === id) {
      setSelectedTemplateId("");
      saveActiveBillTemplateId(branchCode, null);
    }
    refreshTemplates();
    onNotice?.("Template deleted.");
  }

  function cloneStarter(name: string, starterSettings: BillPrintSettings): void {
    try {
      const saved = saveBillPrintTemplate(branchCode, name, starterSettings);
      setSelectedTemplateId(saved.id);
      refreshTemplates();
      onNotice?.(`Starter “${saved.name}” added. Click Assign to use it on prints.`);
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : "Could not add starter template.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bill customization</h3>
        <p className="mt-1 text-xs text-slate-500">
          Drag each receipt line, set bold / size per line, save templates, then Assign to activate on print.
        </p>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                Templates
              </div>
              <span className="text-[10px] text-slate-500">
                {templates.length}/8 saved
                {selectedTemplateId ? " · one assigned" : ""}
              </span>
            </div>
            {templates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No saved templates yet. Add a starter, then click Assign.
              </p>
            ) : (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${
                      selectedTemplateId === tpl.id
                        ? "border-amber-400 bg-white dark:border-amber-600 dark:bg-slate-900"
                        : "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/60"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                      {tpl.name}
                      {selectedTemplateId === tpl.id ? (
                        <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                          Active
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600"
                      onClick={() => assignTemplate(tpl)}
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300"
                      onClick={() => {
                        setSelectedTemplateId(tpl.id);
                        setTemplateName(tpl.name);
                      }}
                    >
                      Overwrite
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-200 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                      onClick={() => removeTemplate(tpl.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                className={`min-w-[10rem] flex-1 ${fieldInputClass}`}
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <Button type="button" className="text-xs" onClick={saveAsTemplate}>
                {selectedTemplateId && templateName ? "Update template" : "Save as template"}
              </Button>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Starter layouts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {starterBillPrintTemplates().map((starter) => (
                  <button
                    key={starter.name}
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => cloneStarter(starter.name, starter.settings)}
                  >
                    + {starter.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Base typography
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Also on the receipt canvas (right). Changes every line’s default size; each line can still use its own A−/A+.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={draft.baseFontSize <= BILL_FONT_SIZE_MIN}
                onClick={() => patch({ baseFontSize: draft.baseFontSize - 1 })}
              >
                A−
              </button>
              <span className="min-w-[3rem] text-center text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {draft.baseFontSize}px
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={draft.baseFontSize >= BILL_FONT_SIZE_MAX}
                onClick={() => patch({ baseFontSize: draft.baseFontSize + 1 })}
              >
                A+
              </button>
              <Button type="button" variant="ghost" className="text-[10px]" onClick={addLine}>
                + Add custom line
              </Button>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-500">
              Layout
              <select
                className={`mt-1 w-full ${fieldSelectClass}`}
                value={draft.layout}
                onChange={(e) => patch({ layout: e.target.value as BillPrintSettings["layout"] })}
              >
                <option value="standard">Standard spacing</option>
                <option value="compact">Compact spacing</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">
              Header alignment
              <select
                className={`mt-1 w-full ${fieldSelectClass}`}
                value={draft.headerAlign}
                onChange={(e) =>
                  patch({ headerAlign: e.target.value as BillPrintSettings["headerAlign"] })
                }
              >
                <option value="center">Center</option>
                <option value="left">Left</option>
              </select>
            </label>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Header text</div>
            <label className="block text-xs text-slate-500">
              Business name
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.headerBusinessName}
                onChange={(e) => patch({ headerBusinessName: e.target.value })}
                placeholder={branchName || "Uses branch name when empty"}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Subtitle / tagline
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.headerSubtitle}
                onChange={(e) => patch({ headerSubtitle: e.target.value })}
                placeholder="e.g. Fine dining · DHA Phase 6"
              />
            </label>
            <label className="block text-xs text-slate-500">
              Document title
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.documentTitle}
                onChange={(e) => patch({ documentTitle: e.target.value })}
                placeholder="Tax Invoice"
              />
            </label>
            <label className="block text-xs text-slate-500">
              Footer message
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.footerText}
                onChange={(e) => patch({ footerText: e.target.value })}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Footer secondary
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.footerSecondaryText}
                onChange={(e) => patch({ footerSecondaryText: e.target.value })}
              />
            </label>
          </section>

          <button
            type="button"
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"} field checklist
          </button>

          {showAdvanced ? (
            <section className="space-y-4">
              {BILL_FIELD_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{group.label}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
                      >
                        <input
                          type="checkbox"
                          className="accent-amber-500"
                          checked={draft.fields[key]}
                          onChange={(e) => patchField(key, e.target.checked)}
                        />
                        {BILL_FIELD_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="text-xs" onClick={onSave}>
              Save customization
            </Button>
            <Button type="button" variant="ghost" className="text-xs" onClick={resetDefaults}>
              Reset defaults
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <BillReceiptLayoutCanvas
            settings={draft}
            branchName={branchName}
            selectedId={selectedBlockId}
            onSelect={setSelectedBlockId}
            onChange={replaceDraft}
          />
          <BillReceiptPreview
            input={previewInput}
            branchCode={branchCode}
            printSettings={draft}
            title="Print preview"
          />
        </div>
      </div>
    </div>
  );
}
