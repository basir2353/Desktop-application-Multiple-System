import { useEffect, useState } from "react";
import { usePopsStore } from "../../../../stores/popsStore";
import { BillCustomizationPanel } from "../../../components/BillCustomizationPanel";
import { CashSlipCustomizationPanel } from "../../../components/CashSlipCustomizationPanel";
import {
  loadBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../../../lib/billPrintSettings";
import { mutedClass } from "../../../lib/themeClasses";

type Props = {
  onNotice?: (message: string) => void;
};

export function BillManagementCustomizationPanel({ onNotice }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const [settings, setSettings] = useState<BillPrintSettings>(() =>
    loadBillPrintSettings(undefined),
  );

  useEffect(() => {
    setSettings(loadBillPrintSettings(branch?.code));
  }, [branch?.code]);

  if (!branch?.code) {
    return <p className={`text-sm ${mutedClass}`}>Select a branch to customize bill layout.</p>;
  }

  return (
    <div className="space-y-6">
      <BillCustomizationPanel
        branchName={branch.name}
        branchCode={branch.code}
        settings={settings}
        onChange={setSettings}
        onNotice={onNotice}
        onSave={() => {
          saveBillPrintSettings(branch.code, settings);
          onNotice?.("Bill print layout saved for this branch.");
        }}
      />
      <CashSlipCustomizationPanel branchCode={branch.code} onNotice={onNotice} />
    </div>
  );
}
