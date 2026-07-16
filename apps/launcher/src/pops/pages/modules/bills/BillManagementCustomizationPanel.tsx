import { Button } from "@platform/ui";
import { useEffect, useState } from "react";
import { usePopsStore } from "../../../../stores/popsStore";
import {
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  normalizeBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../../../lib/billPrintSettings";
import { fieldInputClass, mutedClass, panelClass, panelTitleClass } from "../../../lib/themeClasses";

type Props = {
  onNotice?: (message: string) => void;
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}): JSX.Element {
  return (
    <label className={`flex items-center gap-2 text-xs ${mutedClass}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function BillManagementCustomizationPanel({ onNotice }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const [draft, setDraft] = useState<BillPrintSettings>(DEFAULT_BILL_PRINT_SETTINGS);
  const [saved, setSaved] = useState<BillPrintSettings>(DEFAULT_BILL_PRINT_SETTINGS);

  useEffect(() => {
    const next = loadBillPrintSettings(branch?.code);
    setDraft(next);
    setSaved(next);
  }, [branch?.code]);

  if (!branch?.code) {
    return <p className={`text-sm ${mutedClass}`}>Select a branch to customize bill layout.</p>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function patch(partial: Partial<BillPrintSettings>): void {
    setDraft((prev) => normalizeBillPrintSettings({ ...prev, ...partial }));
  }

  function save(): void {
    const next = normalizeBillPrintSettings(draft);
    saveBillPrintSettings(branch!.code, next);
    setDraft(next);
    setSaved(next);
    onNotice?.("Bill print layout saved for this branch.");
  }

  function reset(): void {
    setDraft(DEFAULT_BILL_PRINT_SETTINGS);
  }

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <div className={`${panelClass} space-y-4 p-4`}>
        <div>
          <div className={panelTitleClass}>Bill header & footer</div>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Customize the title and messages printed on customer bills for {branch.name}.
          </p>
        </div>

        <label className={`block text-xs ${mutedClass}`}>
          Document title
          <input
            className={`mt-1.5 w-full ${fieldInputClass}`}
            value={draft.documentTitle}
            onChange={(e) => patch({ documentTitle: e.target.value })}
            placeholder="Tax Invoice"
            maxLength={48}
          />
        </label>

        <label className={`block text-xs ${mutedClass}`}>
          Header subtitle (optional)
          <input
            className={`mt-1.5 w-full ${fieldInputClass}`}
            value={draft.headerSubtitle}
            onChange={(e) => patch({ headerSubtitle: e.target.value })}
            placeholder="e.g. Fine dining · Est. 2018"
            maxLength={80}
          />
        </label>

        <label className={`block text-xs ${mutedClass}`}>
          Footer message
          <input
            className={`mt-1.5 w-full ${fieldInputClass}`}
            value={draft.footerMessage}
            onChange={(e) => patch({ footerMessage: e.target.value })}
            placeholder="Thank you — visit again"
            maxLength={80}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`block text-xs ${mutedClass}`}>
            Paper width
            <select
              className={`mt-1.5 w-full ${fieldInputClass}`}
              value={draft.paperWidthMm}
              onChange={(e) => patch({ paperWidthMm: Number(e.target.value) === 58 ? 58 : 80 })}
            >
              <option value={80}>80 mm (standard)</option>
              <option value={58}>58 mm (compact)</option>
            </select>
          </label>
          <label className={`block text-xs ${mutedClass}`}>
            Base font size (px)
            <input
              type="number"
              min={9}
              max={14}
              className={`mt-1.5 w-full ${fieldInputClass}`}
              value={draft.baseFontSize}
              onChange={(e) => patch({ baseFontSize: Number(e.target.value) || 11 })}
            />
          </label>
        </div>
      </div>

      <div className={`${panelClass} space-y-4 p-4`}>
        <div>
          <div className={panelTitleClass}>Receipt fields</div>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Choose which details appear on printed bills and reprints.
          </p>
        </div>

        <div className="space-y-2.5">
          <Toggle
            label="Show branch code"
            checked={draft.showBranchCode}
            onChange={(showBranchCode) => patch({ showBranchCode })}
          />
          <Toggle
            label="Show printed timestamp"
            checked={draft.showTimestamp}
            onChange={(showTimestamp) => patch({ showTimestamp })}
          />
          <Toggle
            label="Show waiter name"
            checked={draft.showWaiterName}
            onChange={(showWaiterName) => patch({ showWaiterName })}
          />
          <Toggle
            label="Show printer name"
            checked={draft.showPrinterName}
            onChange={(showPrinterName) => patch({ showPrinterName })}
          />
          <Toggle
            label="Show order notes"
            checked={draft.showOrderNotes}
            onChange={(showOrderNotes) => patch({ showOrderNotes })}
          />
          <Toggle
            label="Show item prices / amount column"
            checked={draft.showItemPrices}
            onChange={(showItemPrices) => patch({ showItemPrices })}
          />
          <Toggle
            label="Show discount line"
            checked={draft.showDiscountLine}
            onChange={(showDiscountLine) => patch({ showDiscountLine })}
          />
          <Toggle
            label="Show service charge"
            checked={draft.showServiceCharge}
            onChange={(showServiceCharge) => patch({ showServiceCharge })}
          />
          <Toggle
            label="Show tax line"
            checked={draft.showTaxLine}
            onChange={(showTaxLine) => patch({ showTaxLine })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:col-span-2">
        <Button type="button" className="text-xs" disabled={!dirty} onClick={save}>
          Save bill layout
        </Button>
        <Button type="button" variant="ghost" className="text-xs" onClick={reset}>
          Reset to defaults
        </Button>
        {dirty ? (
          <span className={`self-center text-xs ${mutedClass}`}>Unsaved changes</span>
        ) : (
          <span className={`self-center text-xs ${mutedClass}`}>Saved for this branch</span>
        )}
      </div>
    </div>
  );
}
