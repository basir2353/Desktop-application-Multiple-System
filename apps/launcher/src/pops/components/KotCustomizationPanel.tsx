import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import {
  KOT_FIELD_GROUPS,
  KOT_FIELD_LABELS,
  STORE_SLIP_FIELD_LABELS,
  KOT_PRINT_SETTINGS_CHANGED_EVENT,
  loadKotPrintSettings,
  newKotCustomLine,
  normalizeKotPrintSettings,
  saveKotPrintSettings,
  defaultSlipPrintSettings,
  storeSlipToBillPrintSettings,
  KOT_FONT_SIZE_MAX,
  KOT_FONT_SIZE_MIN,
  type KotPrintSettings,
  type KotReceiptFields,
  type SlipPrintPreset,
} from "../lib/kotPrintSettings";
import { buildPrintPreviewHtml, type PrintTicketInput } from "../lib/printTicket";
import {
  THERMAL_PRINT_SETTINGS_CHANGED_EVENT,
  loadThermalPrintSettings,
  previewPaperWidthPx,
} from "../lib/thermalPrintSettings";
import { fieldInputClass, fieldSelectClass } from "../lib/themeClasses";

type Props = {
  branchName: string;
  branchCode: string;
  /** Restaurant KOT vs General Store receipt/order slip. */
  variant?: "restaurant" | "store";
  onNotice?: (message: string) => void;
};

function sampleKotInput(branchName: string, branchCode: string): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: "ORD-3",
    modeLabel: "Takeaway",
    tableLabel: "Takeaway",
    waiterName: "Owner",
    printerName: "Kitchen1",
    notes: undefined,
    lines: [
      { label: "Family Combo 4", qty: 1, unitPrice: 0 },
      { label: "Malai Boti", qty: 1, unitPrice: 0 },
      { label: "Mint Margarita", qty: 1, unitPrice: 0 },
      { label: "Mutton Handi (Half)", qty: 1, unitPrice: 0 },
    ],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    total: 0,
    servicePct: 0,
    discountPct: 0,
  };
}

function sampleStoreInput(branchName: string, branchCode: string): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: "INV-1042",
    modeLabel: "Walk-in",
    tableLabel: "Counter 1",
    waiterName: "Cashier",
    printerName: "Receipt",
    notes: undefined,
    lines: [
      { label: "Lux Soap Bar 130g", qty: 2, unitPrice: 85 },
      { label: "Dettol Antiseptic 500ml", qty: 1, unitPrice: 420 },
      { label: "Surf Excel 1kg", qty: 1, unitPrice: 650 },
      { label: "Nestle Milk Pack 1L", qty: 3, unitPrice: 210 },
    ],
    subtotal: 1870,
    discount: 50,
    service: 0,
    tax: 0,
    total: 1820,
    servicePct: 0,
    discountPct: 0,
  };
}

export function KotCustomizationPanel({
  branchName,
  branchCode,
  variant = "restaurant",
  onNotice,
}: Props): JSX.Element {
  const preset: SlipPrintPreset = variant === "store" ? "general-store" : "restaurant";
  const fieldLabels = variant === "store" ? STORE_SLIP_FIELD_LABELS : KOT_FIELD_LABELS;
  const [draft, setDraft] = useState<KotPrintSettings>(() => loadKotPrintSettings(branchCode, preset));
  const [dirty, setDirty] = useState(false);
  const [thermalTick, setThermalTick] = useState(0);

  useEffect(() => {
    setDraft(loadKotPrintSettings(branchCode, preset));
    setDirty(false);
  }, [branchCode, preset]);

  useEffect(() => {
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string; preset?: SlipPrintPreset }>).detail;
      if (detail?.branchCode !== branchCode) return;
      if (detail.preset && detail.preset !== preset) return;
      setDraft(loadKotPrintSettings(branchCode, preset));
      setDirty(false);
    }
    window.addEventListener(KOT_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(KOT_PRINT_SETTINGS_CHANGED_EVENT, onChanged);
  }, [branchCode, preset]);

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

  const previewHtml = useMemo(() => {
    void loadThermalPrintSettings(branchCode);
    const sample =
      variant === "store" ? sampleStoreInput(branchName, branchCode) : sampleKotInput(branchName, branchCode);
    if (variant === "store") {
      return buildPrintPreviewHtml({
        ...sample,
        kind: "receipt",
        billPrintSettings: storeSlipToBillPrintSettings(draft),
      });
    }
    return buildPrintPreviewHtml({
      ...sample,
      kind: "kot",
      kotSettings: draft,
    });
  }, [branchName, branchCode, draft, thermalTick, variant]);

  const paperPx = useMemo(() => {
    const thermal = loadThermalPrintSettings(branchCode);
    return previewPaperWidthPx(thermal.defaultPaperSize, thermal.customPaperWidthMm);
  }, [branchCode, thermalTick]);

  function patch(partial: Partial<KotPrintSettings>): void {
    setDraft((prev) => normalizeKotPrintSettings({ ...prev, ...partial }));
    setDirty(true);
  }

  function patchField(key: keyof KotReceiptFields, value: boolean): void {
    patch({ fields: { ...draft.fields, [key]: value } });
  }

  function insertCustomInOrder(
    order: string[],
    lineId: string,
    zone: (typeof draft.customLines)[number]["zone"],
  ): string[] {
    const next = order.filter((id) => id !== lineId);
    const anchor =
      zone === "header"
        ? "documentTitle"
        : zone === "beforeItems"
          ? "timestamp"
          : zone === "afterItems"
            ? "items"
            : "footer";
    const idx = next.indexOf(anchor);
    if (idx < 0) return [...next, lineId];
    next.splice(idx + 1, 0, lineId);
    return next;
  }

  function addLine(): void {
    const line = newKotCustomLine({
      text: variant === "store" ? "Store note" : "Custom kitchen note",
      zone: "beforeItems",
    });
    patch({
      customLines: [...draft.customLines, line],
      blockOrder: insertCustomInOrder(draft.blockOrder, line.id, line.zone),
    });
  }

  function updateLine(id: string, partial: Partial<(typeof draft.customLines)[number]>): void {
    const nextLines = draft.customLines.map((l) => (l.id === id ? { ...l, ...partial } : l));
    const line = nextLines.find((l) => l.id === id);
    patch({
      customLines: nextLines,
      blockOrder:
        line && partial.zone
          ? insertCustomInOrder(draft.blockOrder, id, line.zone)
          : draft.blockOrder,
    });
  }

  function removeLine(id: string): void {
    patch({
      customLines: draft.customLines.filter((l) => l.id !== id),
      blockOrder: draft.blockOrder.filter((x) => x !== id),
    });
  }

  function save(): void {
    saveKotPrintSettings(branchCode, draft, preset);
    setDirty(false);
    onNotice?.(
      variant === "store"
        ? "Store slip template saved — Order / Pay / Print on POS now use this layout."
        : "Kitchen ticket template saved — live KOTs use this layout.",
    );
  }

  function resetDefaults(): void {
    setDraft(defaultSlipPrintSettings(preset));
    setDirty(true);
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            Header alignment
            <select
              className={`mt-1 w-full ${fieldSelectClass}`}
              value={draft.headerAlign}
              onChange={(e) =>
                patch({ headerAlign: e.target.value as KotPrintSettings["headerAlign"] })
              }
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500">
            Base font size (px)
            <input
              type="number"
              min={KOT_FONT_SIZE_MIN}
              max={KOT_FONT_SIZE_MAX}
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.baseFontSize}
              onChange={(e) =>
                patch({
                  baseFontSize: Math.max(
                    KOT_FONT_SIZE_MIN,
                    Math.min(KOT_FONT_SIZE_MAX, Number(e.target.value) || 15),
                  ),
                })
              }
            />
          </label>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Header &amp; footer text
          </div>
          <label className="block text-xs text-slate-500">
            {variant === "store" ? "Store / business name" : "Kitchen / business name"}
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.headerBusinessName}
              onChange={(e) => patch({ headerBusinessName: e.target.value })}
              placeholder={branchName || "Uses branch name when empty"}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Subtitle
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.headerSubtitle}
              onChange={(e) => patch({ headerSubtitle: e.target.value })}
              placeholder={variant === "store" ? "e.g. Main counter" : "e.g. Hot kitchen"}
            />
          </label>
          <label className="block text-xs text-slate-500">
            {variant === "store" ? "Slip title" : "Ticket title"}
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.documentTitle}
              onChange={(e) => patch({ documentTitle: e.target.value })}
              placeholder={variant === "store" ? "Sales Receipt" : "Kitchen Order"}
            />
          </label>
          <label className="block text-xs text-slate-500">
            {variant === "store" ? "Title when reprinting" : "Title when order is updated"}
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.documentTitleUpdate}
              onChange={(e) => patch({ documentTitleUpdate: e.target.value })}
              placeholder={
                variant === "store" ? "Sales Receipt — UPDATE" : "Kitchen Order — UPDATE"
              }
            />
          </label>
          <label className="block text-xs text-slate-500">
            Footer
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

        <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {variant === "store" ? "Receipt options" : "Kitchen options"}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={draft.emphasizeOrderMeta}
              onChange={(e) => patch({ emphasizeOrderMeta: e.target.checked })}
            />
            {variant === "store"
              ? "Bold / enlarge sale type & counter"
              : "Bold / enlarge order type & table"}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={draft.itemUnderlineSeparator}
              onChange={(e) => patch({ itemUnderlineSeparator: e.target.checked })}
            />
            Underline under each item
          </label>
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Show / hide sections
          </div>
          {KOT_FIELD_GROUPS.map((group) => (
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
                      {fieldLabels[key]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Custom lines
            </div>
            <Button type="button" variant="ghost" className="text-[10px]" onClick={addLine}>
              + Add line
            </Button>
          </div>
          {draft.customLines.length === 0 ? (
            <p className="text-[11px] text-slate-500">No custom lines yet.</p>
          ) : (
            draft.customLines.map((line) => (
              <div
                key={line.id}
                className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700"
              >
                <input
                  className={`w-full ${fieldInputClass}`}
                  value={line.text}
                  onChange={(e) => updateLine(line.id, { text: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={line.enabled}
                      onChange={(e) => updateLine(line.id, { enabled: e.target.checked })}
                    />
                    On
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={line.bold}
                      onChange={(e) => updateLine(line.id, { bold: e.target.checked })}
                    />
                    Bold
                  </label>
                  <select
                    className={fieldSelectClass}
                    value={line.zone}
                    onChange={(e) =>
                      updateLine(line.id, {
                        zone: e.target.value as (typeof line)["zone"],
                      })
                    }
                  >
                    <option value="header">After header</option>
                    <option value="beforeItems">Before items</option>
                    <option value="afterItems">After items</option>
                    <option value="footer">In footer</option>
                  </select>
                  <button
                    type="button"
                    className="text-rose-400 hover:text-rose-300"
                    onClick={() => removeLine(line.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="text-xs" onClick={save} disabled={!dirty}>
            {variant === "store" ? "Save store slip template" : "Save kitchen template"}
          </Button>
          <Button type="button" variant="ghost" className="text-xs" onClick={resetDefaults}>
            Reset defaults
          </Button>
          {dirty ? (
            <span className="self-center text-[10px] font-semibold text-amber-400">Unsaved</span>
          ) : null}
        </div>
      </div>

      <aside className="xl:sticky xl:top-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {variant === "store"
            ? "Store receipt preview (matches printer)"
            : "Kitchen print preview (matches printer)"}
        </div>
        <div
          className="mx-auto overflow-hidden rounded-lg border border-slate-700 bg-white"
          style={{ width: paperPx }}
        >
          <iframe
            title={variant === "store" ? "Store receipt preview" : "Kitchen KOT preview"}
            srcDoc={previewHtml}
            className="block h-[min(70vh,520px)] border-0 bg-white"
            style={{ width: paperPx }}
            sandbox="allow-same-origin"
          />
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-500">
          {variant === "store"
            ? "Sample General Store products · live POS print uses real cart lines"
            : "Same layout as kitchen Auto print · paper from Thermal / printer profile (58mm is scaled smaller)"}
        </p>
      </aside>
    </div>
  );
}
