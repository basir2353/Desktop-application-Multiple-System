import { Button } from "@platform/ui";
import type { PraFiscalInvoice } from "@platform/contracts";
import { useEffect, useState } from "react";
import { buildPraFiscalHtml, sanitizePraQrPayload } from "../lib/praFiscalPrint";
import { mutedClass, panelClass } from "../lib/themeClasses";

/** Preview / print using the same POS order-slip layout (not a separate e-IMS design). */
export function PraFiscalInvoiceModal({
  fiscal,
  open,
  onClose,
  onPrint,
  printing,
  branchName,
  branchCode,
}: {
  fiscal: PraFiscalInvoice | null;
  open: boolean;
  onClose: () => void;
  onPrint?: () => void;
  printing?: boolean;
  branchName?: string;
  branchCode?: string;
}): JSX.Element | null {
  const [htmlPreview, setHtmlPreview] = useState<string>("");

  useEffect(() => {
    if (!open || !fiscal) return;
    let cancelled = false;
    void (async () => {
      const html = await buildPraFiscalHtml(fiscal, { branchName, branchCode });
      if (!cancelled) setHtmlPreview(html);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fiscal, branchName, branchCode]);

  if (!open || !fiscal) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className={`${panelClass} max-h-[92vh] w-full max-w-md overflow-auto p-4 shadow-xl`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Print invoice</h2>
            <p className={`text-xs ${mutedClass}`}>
              Same design as POS order slip · PRA Invoice # {fiscal.invoiceNumber}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          {htmlPreview ? (
            <iframe
              title="Invoice preview"
              srcDoc={htmlPreview}
              className="h-[70vh] w-full border-0 bg-white"
            />
          ) : (
            <p className={`p-6 text-center text-sm ${mutedClass}`}>Preparing preview…</p>
          )}
        </div>

        <p className={`mt-2 break-all text-center text-[10px] ${mutedClass}`}>
          {sanitizePraQrPayload(fiscal.qrPayload || fiscal.invoiceNumber)}
        </p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {onPrint ? (
            <Button type="button" disabled={printing} onClick={onPrint}>
              {printing ? "Printing…" : "Print invoice"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
