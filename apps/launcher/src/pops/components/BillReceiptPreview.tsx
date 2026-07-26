import { useEffect, useMemo, useState } from "react";
import {
  BILL_PRINT_SETTINGS_CHANGED_EVENT,
  loadBillPrintSettings,
  type BillPrintSettings,
} from "../lib/billPrintSettings";
import {
  THERMAL_PRINT_SETTINGS_CHANGED_EVENT,
  loadThermalPrintSettings,
} from "../lib/thermalPrintSettings";
import { buildPrintPreviewHtml, type PrintTicketInput } from "../lib/printTicket";

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
  title = "Print preview (matches printer)",
}: Props): JSX.Element {
  const [settings, setSettings] = useState<BillPrintSettings>(
    () => printSettings ?? loadBillPrintSettings(branchCode),
  );
  const [thermalTick, setThermalTick] = useState(0);

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

  useEffect(() => {
    function onThermal(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setThermalTick((n) => n + 1);
      }
    }
    window.addEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, onThermal);
    return () => window.removeEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, onThermal);
  }, [branchCode]);

  const html = useMemo(() => {
    // Touch thermal settings so paper/width changes refresh the preview.
    void loadThermalPrintSettings(branchCode);
    return buildPrintPreviewHtml({
      ...input,
      kind: "receipt",
      billPrintSettings: settings,
    });
  }, [input, settings, branchCode, thermalTick]);

  const paperPx = useMemo(() => {
    const paper = loadThermalPrintSettings(branchCode).defaultPaperSize;
    if (paper === "58mm") return 280;
    if (paper === "A4") return 420;
    return 340;
  }, [branchCode, thermalTick]);

  return (
    <div className={className}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div
        className="mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700"
        style={{ width: paperPx }}
      >
        <iframe
          title={title}
          srcDoc={html}
          className="block h-[420px] border-0 bg-white"
          style={{ width: paperPx }}
          sandbox="allow-same-origin"
        />
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500">
        Same layout as Auto print on your thermal printer
      </p>
    </div>
  );
}
