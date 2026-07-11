import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import { BillReceiptPreview } from "./BillReceiptPreview";
import {
  BILL_FIELD_GROUPS,
  BILL_FIELD_LABELS,
  BILL_FONT_SIZE_MAX,
  BILL_FONT_SIZE_MIN,
  DEFAULT_BILL_PRINT_SETTINGS,
  normalizeBillPrintSettings,
  type BillPrintSettings,
  type BillReceiptFields,
} from "../lib/billPrintSettings";
import { sampleBillPrintInput } from "../lib/billSampleReceipt";
import { fieldInputClass, fieldSelectClass } from "../lib/themeClasses";

type Props = {
  branchName: string;
  branchCode: string;
  settings: BillPrintSettings;
  onChange: (settings: BillPrintSettings) => void;
  onSave: () => void;
};

export function BillCustomizationPanel({
  branchName,
  branchCode,
  settings,
  onChange,
  onSave,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<BillPrintSettings>(() => normalizeBillPrintSettings(settings));

  useEffect(() => {
    setDraft(normalizeBillPrintSettings(settings));
  }, [settings]);
  const previewInput = useMemo(
    () => sampleBillPrintInput(branchName, branchCode),
    [branchName, branchCode],
  );

  function patch(partial: Partial<BillPrintSettings>): void {
    const next = normalizeBillPrintSettings({ ...draft, ...partial });
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
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bill customization</h3>
        <p className="mt-1 text-xs text-slate-500">
          Customize receipt layout, visible fields, and font size. Changes apply to preview, print, and digital
          receipts.
        </p>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div className="space-y-5">
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Typography</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={draft.baseFontSize <= BILL_FONT_SIZE_MIN}
                onClick={() => patch({ baseFontSize: draft.baseFontSize - 1 })}
              >
                A−
              </button>
              <span className="min-w-[3rem] text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">
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
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Header</div>
            <label className="block text-xs text-slate-500">
              Business name
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.headerBusinessName}
                onChange={(e) => patch({ headerBusinessName: e.target.value })}
                placeholder={branchName || "Uses branch name when empty"}
                disabled={!draft.fields.branchName}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Leave empty to show the branch name ({branchName || "current branch"}).
              </span>
            </label>
            <label className="block text-xs text-slate-500">
              Subtitle / tagline
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.headerSubtitle}
                onChange={(e) => patch({ headerSubtitle: e.target.value })}
                placeholder="e.g. Fine dining · DHA Phase 6"
                disabled={!draft.fields.headerSubtitle}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Document title
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.documentTitle}
                onChange={(e) => patch({ documentTitle: e.target.value })}
                placeholder="Tax Invoice"
                disabled={!draft.fields.documentTitle}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Header alignment
              <select
                className={`mt-1 w-full ${fieldSelectClass}`}
                value={draft.headerAlign}
                onChange={(e) => patch({ headerAlign: e.target.value as BillPrintSettings["headerAlign"] })}
              >
                <option value="center">Center</option>
                <option value="left">Left</option>
              </select>
            </label>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Footer</div>
            <label className="block text-xs text-slate-500">
              Primary message
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.footerText}
                onChange={(e) => patch({ footerText: e.target.value })}
                placeholder="Thank you — visit again"
                disabled={!draft.fields.footer}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Secondary line
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={draft.footerSecondaryText}
                onChange={(e) => patch({ footerSecondaryText: e.target.value })}
                placeholder="Phone · address · NTN / STRN"
                disabled={!draft.fields.footerSecondary}
              />
            </label>
          </section>

          <section className="space-y-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Show / hide fields
            </div>
            {BILL_FIELD_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{group.label}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.keys.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
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

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="text-xs" onClick={onSave}>
              Save customization
            </Button>
            <Button type="button" variant="ghost" className="text-xs" onClick={resetDefaults}>
              Reset defaults
            </Button>
          </div>
        </div>

        <BillReceiptPreview
          input={previewInput}
          branchCode={branchCode}
          printSettings={draft}
          title="Live receipt preview"
        />
      </div>
    </div>
  );
}
