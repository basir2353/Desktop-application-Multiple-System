import { Button } from "@platform/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_THERMAL_PRINT_SETTINGS,
  loadThermalPrintSettings,
  normalizeThermalPrintSettings,
  saveThermalPrintSettings,
  THERMAL_PRINT_SETTINGS_CHANGED_EVENT,
  type ThermalPrintSettings,
  type ThermalReceiptLayout,
} from "../lib/thermalPrintSettings";
import { buildPrintPreviewHtml, printTestPageAsync } from "../lib/printTicket";
import { sampleBillPrintInput } from "../lib/billSampleReceipt";
import { listSystemPrintersDetailed } from "../lib/systemPrinters";
import {
  BILL_PRINT_SETTINGS_CHANGED_EVENT,
  loadBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../lib/billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "../lib/billReceiptTemplateAssignments";
import { BillCustomizationPanel } from "./BillCustomizationPanel";
import { KotCustomizationPanel } from "./KotCustomizationPanel";
import { usePopsStore } from "../../stores/popsStore";

type Props = {
  branchCode: string;
  notify?: (message: string) => void;
};

function StepBadge({ n }: { n: number }): JSX.Element {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/40">
      {n}
    </span>
  );
}

function SectionCard({
  step,
  title,
  subtitle,
  children,
  action,
}: {
  step?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/50 shadow-sm shadow-black/20">
      <header className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {step != null ? <StepBadge n={step} /> : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ThermalPrintSettingsPanel({ branchCode, notify }: Props): JSX.Element {
  const branchName = usePopsStore((s) => s.branch?.name) ?? "BuchaSoft";
  const [draft, setDraft] = useState<ThermalPrintSettings>(() =>
    loadThermalPrintSettings(branchCode),
  );
  const [dirty, setDirty] = useState(false);
  const [testPrinter, setTestPrinter] = useState("");
  const [osPrinters, setOsPrinters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [billSettings, setBillSettings] = useState<BillPrintSettings>(() =>
    loadBillPrintSettings(branchCode),
  );

  useEffect(() => {
    setDraft(loadThermalPrintSettings(branchCode));
    setBillSettings(loadBillPrintSettings(branchCode));
    setDirty(false);
  }, [branchCode]);

  useEffect(() => {
    function onThermalChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (detail?.branchCode === branchCode) {
        setDraft(loadThermalPrintSettings(branchCode));
        setDirty(false);
      }
    }
    function onBillChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setBillSettings(loadBillPrintSettings(branchCode));
      }
    }
    window.addEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, onThermalChanged);
    window.addEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onBillChanged);
    return () => {
      window.removeEventListener(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, onThermalChanged);
      window.removeEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onBillChanged);
    };
  }, [branchCode]);

  useEffect(() => {
    void listSystemPrintersDetailed().then((result) => {
      // All Windows printers (USB, network, PDF, XPS, …) for Auto test prints.
      const names = (result.printers ?? result.usable ?? []).map((p) => p.name);
      setOsPrinters(names);
      setTestPrinter((prev) => prev || names[0] || "");
    });
  }, []);

  const previewHtml = useMemo(() => {
    const settings =
      resolveBillPrintSettingsForReceipt(branchCode) ?? billSettings;
    return buildPrintPreviewHtml({
      ...sampleBillPrintInput(branchName, branchCode),
      kind: "receipt",
      paperSize: draft.defaultPaperSize,
      billPrintSettings: settings,
    });
  }, [branchCode, branchName, billSettings, draft]);

  function patch(partial: Partial<ThermalPrintSettings>): void {
    setDraft((prev) => normalizeThermalPrintSettings({ ...prev, ...partial }));
    setDirty(true);
  }

  function saveThermal(): void {
    const next = saveThermalPrintSettings(branchCode, draft);
    setDraft(next);
    setDirty(false);
    notify?.("Paper settings saved.");
  }

  function resetDefaults(): void {
    setDraft(DEFAULT_THERMAL_PRINT_SETTINGS);
    setDirty(true);
  }

  function persistBillSettings(next: BillPrintSettings): void {
    saveBillPrintSettings(branchCode, next);
    setBillSettings(next);
    notify?.("Bill slip saved — live prints use this layout.");
  }

  async function runTestPrint(): Promise<void> {
    if (!testPrinter.trim()) {
      notify?.("Select a printer first.");
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
      notify?.(ok ? `Test bill sent to ${testPrinter}.` : `Test print failed for ${testPrinter}.`);
    } finally {
      setBusy(false);
    }
  }

  const paperLabel =
    draft.defaultPaperSize === "A4"
      ? "A4 sheet"
      : draft.defaultPaperSize === "58mm"
        ? "58mm roll"
        : "80mm roll";

  return (
    <div className="space-y-8">
      {/* Page intro */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-6 py-5">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 80% 40%, rgba(245,158,11,0.18), transparent 60%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
              Print settings
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Set up how bills look when printed
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Three steps: choose paper, check a test print, then edit the slip text and colors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-300">
              Paper · {paperLabel}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-300">
              Layout · {draft.receiptLayout === "clear" ? "Stacked" : "Columns"}
            </span>
          </div>
        </div>

        <ol className="relative mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: 1, t: "Paper", d: "Roll size & amounts" },
            { n: 2, t: "Test", d: "Send a sample bill" },
            { n: 3, t: "Bill slip", d: "Invoice text & fields" },
            { n: 4, t: "Kitchen", d: "KOT ticket layout" },
          ].map((s) => (
            <li
              key={s.n}
              className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2.5"
            >
              <StepBadge n={s.n} />
              <div>
                <div className="text-xs font-semibold text-slate-100">{s.t}</div>
                <div className="text-[11px] text-slate-500">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-6">
          <SectionCard
            step={1}
            title="Paper & layout"
            subtitle="Match your physical printer roll. Most restaurants use 80mm."
            action={
              dirty ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                  Unsaved
                </span>
              ) : null
            }
          >
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-300">Paper size</div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "58mm" as const, label: "58mm", hint: "Narrow" },
                      { id: "80mm" as const, label: "80mm", hint: "Wide · recommended" },
                      { id: "A4" as const, label: "A4", hint: "Office printer" },
                    ] as const
                  ).map((opt) => {
                    const active = draft.defaultPaperSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          patch({
                            defaultPaperSize: opt.id,
                            receiptLayout: "columns",
                            showUnitPrice: opt.id === "80mm",
                          })
                        }
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/30"
                            : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
                        }`}
                      >
                        <div
                          className={`text-sm font-semibold ${active ? "text-amber-200" : "text-slate-200"}`}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-300">Item layout</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: "clear" as ThermalReceiptLayout,
                        label: "Stacked",
                        hint: "Name, then amount — safest on narrow paper",
                      },
                      {
                        id: "columns" as ThermalReceiptLayout,
                        label: "Columns",
                        hint: "Qty · Item · Price · Amt",
                      },
                    ] as const
                  ).map((opt) => {
                    const active = draft.receiptLayout === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patch({ receiptLayout: opt.id })}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/30"
                            : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
                        }`}
                      >
                        <div
                          className={`text-sm font-semibold ${active ? "text-amber-200" : "text-slate-200"}`}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-300">Amount format</div>
                <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
                  <label className="flex cursor-pointer items-start gap-3 bg-slate-900/40 px-4 py-3 hover:bg-slate-900/70">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-amber-500"
                      checked={draft.showCurrencyPrefix}
                      onChange={(e) => patch({ showCurrencyPrefix: e.target.checked })}
                    />
                    <span>
                      <span className="block text-sm text-slate-200">Show “Rs” before amounts</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        Example: Rs 3200 instead of 3200
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 bg-slate-900/40 px-4 py-3 hover:bg-slate-900/70">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-amber-500"
                      checked={draft.compactMoney}
                      onChange={(e) => patch({ compactMoney: e.target.checked })}
                    />
                    <span>
                      <span className="block text-sm text-slate-200">Compact numbers</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        Example: 1430 instead of 1,430
                      </span>
                    </span>
                  </label>
                  {draft.receiptLayout === "columns" ? (
                    <label className="flex cursor-pointer items-start gap-3 bg-slate-900/40 px-4 py-3 hover:bg-slate-900/70">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-amber-500"
                        checked={draft.showUnitPrice}
                        onChange={(e) => patch({ showUnitPrice: e.target.checked })}
                      />
                      <span>
                        <span className="block text-sm text-slate-200">Show unit price column</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          Extra Price column next to Qty / Item / Amount
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="block max-w-[12rem]">
                  <span className="text-xs text-slate-400">Side margin (mm)</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={draft.marginMm}
                    onChange={(e) => patch({ marginMm: Number(e.target.value) })}
                  />
                </label>
                <p className="mt-1 text-[10px] text-slate-500">
                  If the right edge is cut off, raise this to 2–3 mm, or switch paper to 58mm / Stacked.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
                <Button type="button" onClick={saveThermal} disabled={!dirty}>
                  Save paper settings
                </Button>
                <Button type="button" variant="ghost" onClick={resetDefaults}>
                  Reset
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            step={2}
            title="Test print"
            subtitle="Send a sample bill with your current settings before editing the slip."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Printer</span>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
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
                disabled={busy || !testPrinter}
                onClick={() => void runTestPrint()}
                className="shrink-0"
              >
                {busy ? "Sending…" : "Send test bill"}
              </Button>
            </div>
            {osPrinters.length === 0 ? (
              <p className="mt-3 text-[11px] text-slate-500">
                No Windows printers found. In the browser, link Microsoft Print to PDF under All Printers — print
                opens the Windows dialog where PDF / XPS appear. Or use the desktop app for silent Auto print.
              </p>
            ) : null}
          </SectionCard>
        </div>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-4">
          <SectionCard
            title="Live preview"
            subtitle="Updates as you change paper or the slip below."
          >
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-white shadow-inner">
              <iframe
                title="Bill preview"
                srcDoc={previewHtml}
                className="block h-[min(70vh,560px)] w-full border-0 bg-white"
                sandbox="allow-same-origin"
              />
            </div>
            <p className="mt-3 text-center text-[10px] text-slate-500">
              Preview matches Auto print · same layout as your thermal printer
            </p>
          </SectionCard>
        </aside>
      </div>

      <SectionCard
        step={3}
        title="Edit the bill / invoice slip"
        subtitle="Change business name, title, footer, colors, and which sections appear. Drag lines to reorder."
      >
        <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1">
            Click a line to edit text
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1">
            Color · Bold · Size on each line
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1">
            Drag ⋮⋮ to reorder
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1">
            Save when finished
          </span>
        </div>
        <BillCustomizationPanel
          branchName={branchName}
          branchCode={branchCode}
          settings={billSettings}
          onChange={setBillSettings}
          onSave={() => persistBillSettings(billSettings)}
          onNotice={notify}
        />
      </SectionCard>

      <SectionCard
        step={4}
        title="Edit the kitchen ticket (KOT)"
        subtitle="Same idea as the bill slip — title, footer, which fields show, custom lines. Preview matches Auto print."
      >
        <KotCustomizationPanel
          branchName={branchName}
          branchCode={branchCode}
          onNotice={notify}
        />
      </SectionCard>
    </div>
  );
}
