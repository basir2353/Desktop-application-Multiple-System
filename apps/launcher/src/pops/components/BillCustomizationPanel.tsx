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
import {
  assignBillTemplateToPosAction,
  BILL_POS_RECEIPT_ACTIONS,
  BILL_RECEIPT_TEMPLATE_ASSIGN_CHANGED_EVENT,
  loadBillReceiptTemplateAssignments,
  listPosActionsForTemplate,
  setBranchDefaultBillTemplate,
  type BillPosReceiptAction,
  type BillReceiptTemplateAssignmentStore,
} from "../lib/billReceiptTemplateAssignments";
import { sampleBillPrintInput } from "../lib/billSampleReceipt";
import {
  loadPrinterRouting,
  resolveReceiptPrinter,
  updatePrinterProfile,
  type PrinterPaperSize,
} from "../lib/printerRouting";
import {
  loadThermalPrintSettings,
  saveThermalPrintSettings,
  THERMAL_PRINT_SETTINGS_CHANGED_EVENT,
} from "../lib/thermalPrintSettings";
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
  const [assignments, setAssignments] = useState<BillReceiptTemplateAssignmentStore>(() =>
    loadBillReceiptTemplateAssignments(branchCode),
  );
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);
  const [receiptPaperSize, setReceiptPaperSize] = useState<PrinterPaperSize>(() => {
    const profile = resolveReceiptPrinter(branchCode);
    return profile?.paperSize ?? loadThermalPrintSettings(branchCode).defaultPaperSize;
  });

  useEffect(() => {
    setDraft(normalizeBillPrintSettings(settings));
  }, [settings]);

  useEffect(() => {
    setTemplates(loadBillPrintTemplates(branchCode));
    setSelectedTemplateId(loadActiveBillTemplateId(branchCode) ?? "");
    setAssignments(loadBillReceiptTemplateAssignments(branchCode));
    setViewingTemplateId(null);
    const profile = resolveReceiptPrinter(branchCode);
    setReceiptPaperSize(
      profile?.paperSize ?? loadThermalPrintSettings(branchCode).defaultPaperSize,
    );
  }, [branchCode]);

  useEffect(() => {
    const refresh = () => setAssignments(loadBillReceiptTemplateAssignments(branchCode));
    const refreshPaper = () => {
      const profile = resolveReceiptPrinter(branchCode);
      setReceiptPaperSize(
        profile?.paperSize ?? loadThermalPrintSettings(branchCode).defaultPaperSize,
      );
    };
    window.addEventListener(BILL_RECEIPT_TEMPLATE_ASSIGN_CHANGED_EVENT, refresh);
    window.addEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, refreshPaper);
    return () => {
      window.removeEventListener(BILL_RECEIPT_TEMPLATE_ASSIGN_CHANGED_EVENT, refresh);
      window.removeEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, refreshPaper);
    };
  }, [branchCode]);

  function setAssignedReceiptPaper(paperSize: PrinterPaperSize): void {
    setReceiptPaperSize(paperSize);
    saveThermalPrintSettings(branchCode, { defaultPaperSize: paperSize });
    const profile = resolveReceiptPrinter(branchCode);
    if (profile) {
      updatePrinterProfile(branchCode, profile.id, { paperSize });
      onNotice?.(`Receipt paper set to ${paperSize} (printer “${profile.name}”).`);
      return;
    }
    const anyReceipt = loadPrinterRouting(branchCode).printers.find(
      (p) => p.printerType === "receipt",
    );
    if (anyReceipt) {
      updatePrinterProfile(branchCode, anyReceipt.id, { paperSize });
      onNotice?.(`Receipt paper set to ${paperSize} (printer “${anyReceipt.name}”).`);
      return;
    }
    onNotice?.(`Receipt paper default set to ${paperSize}. Add a receipt printer profile to apply it.`);
  }

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
      setTemplateName(saved.name);
      setSelectedTemplateId(saved.id);
      setViewingTemplateId(saved.id);
      refreshTemplates();
      onNotice?.(`Template “${saved.name}” saved. Assign it to POS Order / Pay below if needed.`);
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : "Could not save template.");
    }
  }

  function viewTemplate(template: BillPrintTemplate): void {
    const next = normalizeBillPrintSettings(template.settings);
    setDraft(next);
    onChange(next);
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setViewingTemplateId(template.id);
    onNotice?.(`Viewing “${template.name}”. Edit on the right, then Update template or Save.`);
  }

  function editTemplate(template: BillPrintTemplate): void {
    viewTemplate(template);
    onNotice?.(`Editing “${template.name}”. Change fields, then click Update template.`);
  }

  /** Assign = apply template to live print settings + branch default. */
  function assignTemplate(template: BillPrintTemplate): void {
    const next = normalizeBillPrintSettings(template.settings);
    setDraft(next);
    onChange(next);
    saveBillPrintSettings(branchCode, next);
    saveActiveBillTemplateId(branchCode, template.id);
    setSelectedTemplateId(template.id);
    setViewingTemplateId(null);
    setAssignments(setBranchDefaultBillTemplate(branchCode, template.id));
    onNotice?.(`Template “${template.name}” set as branch default for prints.`);
  }

  function setPosActionTemplate(action: BillPosReceiptAction, templateId: string): void {
    const next = assignBillTemplateToPosAction(branchCode, action, templateId || null);
    setAssignments(next);
    const tpl = templates.find((t) => t.id === templateId);
    const label = BILL_POS_RECEIPT_ACTIONS.find((a) => a.id === action)?.label ?? action;
    onNotice?.(
      templateId
        ? `${label} → “${tpl?.name ?? "template"}”`
        : `${label} cleared (uses branch default)`,
    );
  }

  function removeTemplate(id: string): void {
    const assign = loadBillReceiptTemplateAssignments(branchCode);
    if (assign.branchDefaultTemplateId === id) {
      setBranchDefaultBillTemplate(branchCode, null);
    }
    for (const action of ["order", "pay"] as const) {
      if (assign.byPosAction[action] === id) {
        assignBillTemplateToPosAction(branchCode, action, null);
      }
    }
    deleteBillPrintTemplate(branchCode, id);
    if (selectedTemplateId === id) {
      setSelectedTemplateId("");
      saveActiveBillTemplateId(branchCode, null);
    }
    if (viewingTemplateId === id) setViewingTemplateId(null);
    setAssignments(loadBillReceiptTemplateAssignments(branchCode));
    refreshTemplates();
    onNotice?.("Template deleted.");
  }

  function templateBadges(templateId: string): string[] {
    const badges: string[] = [];
    if (assignments.branchDefaultTemplateId === templateId) badges.push("Default");
    if (selectedTemplateId === templateId && viewingTemplateId === templateId) badges.push("Editing");
    else if (selectedTemplateId === templateId) badges.push("Active");
    for (const action of listPosActionsForTemplate(branchCode, templateId)) {
      badges.push(action === "order" ? "Order" : "Pay");
    }
    return badges;
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
          Drag lines with ⋮⋮, set bold / size, save up to 8 templates, then assign Order vs Pay receipts.
        </p>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                Saved templates
              </div>
              <span className="text-[10px] text-slate-500">{templates.length}/8 saved</span>
            </div>
            <p className="text-[10px] text-slate-500">
              View or edit any template, then assign which one POS Order / Pay should print.
            </p>
            {templates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No saved templates yet. Add a starter below, then View / Edit / Assign.
              </p>
            ) : (
              <ul className="space-y-2">
                {templates.map((tpl) => {
                  const badges = templateBadges(tpl.id);
                  return (
                    <li
                      key={tpl.id}
                      className={`rounded-md border px-2 py-2 ${
                        selectedTemplateId === tpl.id || viewingTemplateId === tpl.id
                          ? "border-amber-400 bg-white dark:border-amber-600 dark:bg-slate-900"
                          : "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                            {tpl.name}
                          </div>
                          {badges.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {badges.map((badge) => (
                                <span
                                  key={badge}
                                  className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-300"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-0.5 text-[9px] text-slate-400">
                            Updated {new Date(tpl.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200"
                            onClick={() => viewTemplate(tpl)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="rounded border border-sky-300 px-2 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300"
                            onClick={() => editTemplate(tpl)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600"
                            onClick={() => assignTemplate(tpl)}
                          >
                            Set default
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-200 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                            onClick={() => removeTemplate(tpl.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
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
                {selectedTemplateId ? "Update template" : "Save as template"}
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

          <section className="space-y-3 rounded-lg border border-sky-200/80 bg-sky-50/40 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-200">
              Assign templates to POS
            </div>
            <p className="text-[10px] text-slate-500">
              Choose which saved template prints for Order/Invoice vs Pay. Leave empty to use the
              branch default. Paper size matches Printer Profiles (58mm / 80mm / A4).
            </p>
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              Receipt paper size
              <select
                className={`mt-1 w-full ${fieldSelectClass}`}
                value={receiptPaperSize}
                onChange={(e) => setAssignedReceiptPaper(e.target.value as PrinterPaperSize)}
              >
                <option value="58mm">58mm roll</option>
                <option value="80mm">80mm roll</option>
                <option value="A4">A4</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              Branch default
              <select
                className={`mt-1 w-full ${fieldSelectClass}`}
                value={assignments.branchDefaultTemplateId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setAssignments(setBranchDefaultBillTemplate(branchCode, id));
                  if (id) {
                    const tpl = templates.find((t) => t.id === id);
                    if (tpl) {
                      saveActiveBillTemplateId(branchCode, id);
                      setSelectedTemplateId(id);
                    }
                  }
                  onNotice?.(id ? "Branch default updated." : "Branch default cleared.");
                }}
              >
                <option value="">Live customization (no template)</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
            {BILL_POS_RECEIPT_ACTIONS.map((action) => (
              <label key={action.id} className="block text-xs text-slate-600 dark:text-slate-300">
                {action.label}
                <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                  {action.description}
                </span>
                <select
                  className={`mt-1 w-full ${fieldSelectClass}`}
                  value={assignments.byPosAction[action.id] ?? ""}
                  onChange={(e) => setPosActionTemplate(action.id, e.target.value)}
                >
                  <option value="">Use branch default</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
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
