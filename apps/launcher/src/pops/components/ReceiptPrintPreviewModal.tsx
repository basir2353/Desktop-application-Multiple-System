import { useEffect, useMemo, useState } from "react";
import {
  BILL_PRINT_SETTINGS_CHANGED_EVENT,
  loadBillPrintSettings,
  type BillPrintSettings,
} from "../lib/billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "../lib/billReceiptTemplateAssignments";
import {
  buildPrintPreviewHtml,
  printReceiptDetailed,
  type PrintTicketInput,
} from "../lib/printTicket";

type Props = {
  input: Omit<PrintTicketInput, "kind">;
  branchCode: string;
  /** Optional printer routing for the confirmed print job. */
  printerName?: string;
  systemPrinterName?: string;
  billPrintSettings?: BillPrintSettings;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onPrinted?: (ok: boolean, error?: string) => void;
};

export function ReceiptPrintPreviewModal({
  input,
  branchCode,
  printerName,
  systemPrinterName,
  billPrintSettings,
  title = "Print preview",
  subtitle,
  onClose,
  onPrinted,
}: Props): JSX.Element {
  const [settings, setSettings] = useState<BillPrintSettings>(
    () =>
      billPrintSettings ??
      resolveBillPrintSettingsForReceipt(branchCode) ??
      loadBillPrintSettings(branchCode),
  );
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (billPrintSettings) {
      setSettings(billPrintSettings);
      return;
    }
    setSettings(
      resolveBillPrintSettingsForReceipt(branchCode) ?? loadBillPrintSettings(branchCode),
    );
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setSettings(
          resolveBillPrintSettingsForReceipt(branchCode) ?? loadBillPrintSettings(branchCode),
        );
      }
    }
    window.addEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
  }, [branchCode, billPrintSettings]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !printing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, printing]);

  const ticketInput: PrintTicketInput = useMemo(
    () => ({
      ...input,
      kind: "receipt",
      printerName,
      systemPrinterName,
      billPrintSettings: settings,
    }),
    [input, printerName, systemPrinterName, settings],
  );

  const html = useMemo(() => buildPrintPreviewHtml(ticketInput), [ticketInput]);

  async function handlePrint(): Promise<void> {
    if (printing) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const result = await printReceiptDetailed(ticketInput);
      onPrinted?.(result.ok, result.error);
      if (result.ok) {
        onClose();
        return;
      }
      const message =
        result.error?.trim() ||
        "Print failed. Link a receipt printer in Printer settings, or use the EXE for silent Auto print.";
      setPrintError(message);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={() => {
        if (!printing) onClose();
      }}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-print-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="receipt-print-preview-title"
              className="text-sm font-semibold text-white"
            >
              {title}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {subtitle
                ? subtitle
                : `${input.orderRef}${input.billRef ? ` · ${input.billRef}` : ""} · ${input.modeLabel} · same design as printer`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={printing}
            className="shrink-0 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-950/40 px-4 py-4">
          <div className="mx-auto overflow-hidden rounded-lg border border-slate-700 bg-white shadow-lg">
            <iframe
              title="Receipt print preview"
              srcDoc={html}
              className="block h-[min(62vh,520px)] w-full border-0 bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-800 px-4 py-3">
          {printError ? (
            <p className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
              {printError}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={printing}
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePrint()}
            disabled={printing}
            className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {printing ? "Printing…" : "Print"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
