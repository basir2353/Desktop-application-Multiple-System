import { useEffect, useMemo, useState } from "react";
import {
  BILL_PRINT_SETTINGS_CHANGED_EVENT,
  loadBillPrintSettings,
  type BillPrintSettings,
} from "../lib/billPrintSettings";
import { buildTicketHtml, type PrintTicketInput } from "../lib/printTicket";

type Props = {
  input: Omit<PrintTicketInput, "kind">;
  branchCode: string;
  /** Optional override; otherwise loaded from branch settings. */
  printSettings?: BillPrintSettings;
  className?: string;
  title?: string;
};

export function BillReceiptPreview({
  input,
  branchCode,
  printSettings,
  className = "",
  title = "Bill preview",
}: Props): JSX.Element {
  const [settings, setSettings] = useState<BillPrintSettings>(
    () => printSettings ?? loadBillPrintSettings(branchCode),
  );

  useEffect(() => {
    if (printSettings) {
      setSettings(printSettings);
      return;
    }
    setSettings(loadBillPrintSettings(branchCode));
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setSettings(loadBillPrintSettings(branchCode));
      }
    }
    window.addEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
  }, [branchCode, printSettings]);

  const html = useMemo(
    () => buildTicketHtml({ ...input, kind: "receipt", billPrintSettings: settings }),
    [input, settings],
  );

  return (
    <div className={className}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700">
        <iframe
          title={title}
          srcDoc={html}
          className="block h-[420px] w-full border-0 bg-white"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
