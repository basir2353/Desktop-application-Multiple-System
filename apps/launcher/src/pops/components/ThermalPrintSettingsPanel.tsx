import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import type { PrinterPaperSize } from "../lib/printerRouting";
import {
  DEFAULT_THERMAL_PRINT_SETTINGS,
  loadThermalPrintSettings,
  normalizeThermalPrintSettings,
  saveThermalPrintSettings,
  THERMAL_PRINT_SETTINGS_CHANGED_EVENT,
  type ThermalPrintSettings,
  type ThermalReceiptLayout,
} from "../lib/thermalPrintSettings";
import { buildThermalPlainText, printTestPageAsync, type PrintTicketInput } from "../lib/printTicket";
import { listSystemPrintersDetailed } from "../lib/systemPrinters";
import { DEFAULT_BILL_PRINT_SETTINGS } from "../lib/billPrintSettings";

const PAPER_CHOICES: PrinterPaperSize[] = ["58mm", "80mm", "A4"];

type Props = {
  branchCode: string;
  notify?: (message: string) => void;
};

function sampleReceiptInput(
  branchCode: string,
  paperSize: PrinterPaperSize,
): PrintTicketInput {
  return {
    kind: "receipt",
    branchName: "POPS Blue Area",
    branchCode,
    orderRef: "ORD-6",
    billRef: "BILL-SAMPLE",
    modeLabel: "Takeaway",
    tableLabel: "Takeaway counter",
    waiterName: "POS Counter",
    paperSize,
    lines: [
      { label: "Seekh Kabab (6pc) (Standard)", qty: 1, unitPrice: 980 },
      { label: "Chicken Biryani (Plate)", qty: 1, unitPrice: 450 },
    ],
    subtotal: 1430,
    discount: 0,
    service: 143,
    tax: 0,
    total: 1573,
    servicePct: 10,
    taxPct: 0,
    discountPct: 0,
    billPrintSettings: {
      ...DEFAULT_BILL_PRINT_SETTINGS,
      documentTitle: "TAX INVOICE",
      footerText: "THANK YOU --- VISIT AGAIN",
    },
  };
}

export function ThermalPrintSettingsPanel({ branchCode, notify }: Props): JSX.Element {
  const [draft, setDraft] = useState<ThermalPrintSettings>(() =>
    loadThermalPrintSettings(branchCode),
  );
  const [dirty, setDirty] = useState(false);
  const [testPrinter, setTestPrinter] = useState("");
  const [osPrinters, setOsPrinters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(loadThermalPrintSettings(branchCode));
    setDirty(false);
  }, [branchCode]);

  useEffect(() => {
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (detail?.branchCode === branchCode) {
        setDraft(loadThermalPrintSettings(branchCode));
        setDirty(false);
      }
    }
    window.addEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
  }, [branchCode]);

  useEffect(() => {
    void listSystemPrintersDetailed().then((result) => {
      const names = (result.usable ?? []).map((p) => p.name);
      setOsPrinters(names);
      setTestPrinter((prev) => prev || names[0] || "");
    });
  }, []);

  const previewText = useMemo(
    () =>
      buildThermalPlainText(
        sampleReceiptInput(branchCode, draft.defaultPaperSize),
        draft,
      ),
    [branchCode, draft],
  );

  function patch(partial: Partial<ThermalPrintSettings>): void {
    setDraft((prev) => normalizeThermalPrintSettings({ ...prev, ...partial }));
    setDirty(true);
  }

  function save(): void {
    const next = saveThermalPrintSettings(branchCode, draft);
    setDraft(next);
    setDirty(false);
    notify?.("Print settings saved. Receipts will use this clear layout.");
  }

  function resetDefaults(): void {
    setDraft(DEFAULT_THERMAL_PRINT_SETTINGS);
    setDirty(true);
  }

  async function runTestPrint(): Promise<void> {
    if (!testPrinter.trim()) {
      notify?.("Select a Windows printer for the test print.");
      return;
    }
    setBusy(true);
    try {
      const ok = await printTestPageAsync(testPrinter.trim(), {
        branchCode,
        paperSize: draft.defaultPaperSize,
        thermal: draft,
        copies: 1,
      });
      notify?.(
        ok
          ? `Test print sent to ${testPrinter}. Amounts should be fully visible.`
          : `Test print failed for ${testPrinter}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-semibold text-white">Clear receipt layout</h3>
        <p className="mt-1 text-xs text-slate-400">
          Physical printers use a stacked layout so item names and full amounts always show —
          no cut-off on the right side. Match paper size to your roll (usually 58mm).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs font-medium text-slate-300">Receipt layout</span>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={draft.receiptLayout}
              onChange={(e) =>
                patch({ receiptLayout: e.target.value as ThermalReceiptLayout })
              }
            >
              <option value="clear">Clear (recommended) — item then amount</option>
              <option value="columns">Columns — Qty / Item / Price / Amt</option>
            </select>
            <span className="text-[11px] text-slate-500">
              Use Clear on all thermal printers. Columns only if you have wide 80mm paper.
            </span>
          </label>

          <label className="block space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs font-medium text-slate-300">Default paper size</span>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={draft.defaultPaperSize}
              onChange={(e) => patch({ defaultPaperSize: e.target.value as PrinterPaperSize })}
            >
              {PAPER_CHOICES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs font-medium text-slate-300">Side margin (mm)</span>
            <input
              type="number"
              min={0}
              max={8}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={draft.marginMm}
              onChange={(e) => patch({ marginMm: Number(e.target.value) })}
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={draft.compactMoney}
              onChange={(e) => patch({ compactMoney: e.target.checked })}
            />
            <span>
              <span className="block text-xs font-medium text-slate-300">Compact money (Rs1430)</span>
              <span className="mt-1 block text-[11px] text-slate-500">
                Keeps full totals on narrow paper.
              </span>
            </span>
          </label>

          {draft.receiptLayout === "columns" ? (
            <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.showUnitPrice}
                onChange={(e) => patch({ showUnitPrice: e.target.checked })}
              />
              <span>
                <span className="block text-xs font-medium text-slate-300">Show unit Price column</span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  Only for columns layout on 80mm paper.
                </span>
              </span>
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <span className="text-xs font-medium text-slate-300">Chars / line (58mm)</span>
              <input
                type="number"
                min={24}
                max={40}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                value={draft.charsPerLine58}
                onChange={(e) => patch({ charsPerLine58: Number(e.target.value) })}
              />
            </label>
            <label className="block space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <span className="text-xs font-medium text-slate-300">Chars / line (80mm)</span>
              <input
                type="number"
                min={32}
                max={56}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                value={draft.charsPerLine80}
                onChange={(e) => patch({ charsPerLine80: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Test print</h4>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1 space-y-1.5">
                <span className="text-xs text-slate-400">Windows printer</span>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={testPrinter}
                  onChange={(e) => setTestPrinter(e.target.value)}
                >
                  <option value="">Select printer…</option>
                  {osPrinters.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !testPrinter}
                onClick={() => void runTestPrint()}
              >
                {busy ? "Sending…" : "Send test print"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save} disabled={!dirty}>
              Save print settings
            </Button>
            <Button type="button" variant="ghost" onClick={resetDefaults}>
              Reset to defaults
            </Button>
            {dirty ? <span className="self-center text-xs text-amber-300">Unsaved changes</span> : null}
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              Receipt preview
            </h4>
            <span className="text-[10px] text-slate-500">
              Exact layout sent to physical printer
            </span>
          </div>
          <div
            className="mx-auto overflow-auto rounded-lg border border-slate-700 bg-white p-3 text-slate-900 shadow-inner"
            style={{ maxWidth: draft.defaultPaperSize === "58mm" ? 280 : 340 }}
          >
            <pre
              className="whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.35]"
              style={{ fontFamily: 'ui-monospace, Consolas, "Courier New", monospace' }}
            >
              {previewText}
            </pre>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Example uses Seekh Kabab + Biryani so you can confirm amounts like{" "}
            <span className="text-slate-300">Rs980</span> and{" "}
            <span className="text-slate-300">Rs1573</span> are fully visible.
          </p>
        </div>
      </div>
    </div>
  );
}
