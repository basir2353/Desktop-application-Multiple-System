import { useRef } from "react";
import {
  BILL_FONT_SIZE_MAX,
  BILL_FONT_SIZE_MIN,
  BILL_LINE_FONT_MAX,
  BILL_LINE_FONT_MIN,
  BILL_SYSTEM_BLOCK_LABELS,
  getBlockStyle,
  isBillSystemBlock,
  resolveBlockFontSize,
  type BillPrintSettings,
  type BillSystemBlockId,
} from "../lib/billPrintSettings";
import { fieldInputClass } from "../lib/themeClasses";

type Props = {
  settings: BillPrintSettings;
  branchName: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (settings: BillPrintSettings) => void;
};

/** System blocks whose text is stored in bill settings and prints as typed. */
const EDITABLE_SYSTEM_TEXT: Partial<
  Record<BillSystemBlockId, keyof Pick<
    BillPrintSettings,
    | "headerBusinessName"
    | "headerSubtitle"
    | "documentTitle"
    | "footerText"
    | "footerSecondaryText"
  >>
> = {
  branchName: "headerBusinessName",
  headerSubtitle: "headerSubtitle",
  documentTitle: "documentTitle",
  footer: "footerText",
  footerSecondary: "footerSecondaryText",
};

function liveSample(blockId: BillSystemBlockId): string {
  switch (blockId) {
    case "meta":
      return "ORD-SAMPLE · Dine-in · T5";
    case "notes":
      return "Extra spicy • no onions";
    case "timestamp":
      return "ISB-GT · date & time";
    case "items":
      return "QTY  ITEM  PRICE  AMT";
    case "totals":
      return "Subtotal · Tax · TOTAL";
    default:
      return "";
  }
}

function isBlockEnabled(settings: BillPrintSettings, blockId: string): boolean {
  if (!isBillSystemBlock(blockId)) {
    return settings.customLines.find((l) => l.id === blockId)?.enabled !== false;
  }
  const f = settings.fields;
  switch (blockId) {
    case "branchName":
      return f.branchName;
    case "headerSubtitle":
      return f.headerSubtitle;
    case "documentTitle":
      return f.documentTitle;
    case "meta":
      return f.orderRef || f.orderType || f.tableLabel || f.billRef || f.waiterName;
    case "notes":
      return f.notes;
    case "timestamp":
      return f.timestamp || f.branchCode;
    case "items":
      return f.itemQty || f.itemAmount || f.itemHeaders;
    case "totals":
      return f.subtotal || f.total || f.tax || f.service;
    case "footer":
      return f.footer;
    case "footerSecondary":
      return f.footerSecondary;
    default:
      return true;
  }
}

function setBlockEnabled(
  settings: BillPrintSettings,
  blockId: string,
  enabled: boolean,
): BillPrintSettings {
  if (!isBillSystemBlock(blockId)) {
    return {
      ...settings,
      customLines: settings.customLines.map((line) =>
        line.id === blockId ? { ...line, enabled } : line,
      ),
    };
  }
  const fields = { ...settings.fields };
  switch (blockId) {
    case "branchName":
      fields.branchName = enabled;
      break;
    case "headerSubtitle":
      fields.headerSubtitle = enabled;
      break;
    case "documentTitle":
      fields.documentTitle = enabled;
      break;
    case "meta":
      fields.orderRef = enabled;
      fields.orderType = enabled;
      fields.tableLabel = enabled;
      fields.billRef = enabled;
      fields.waiterName = enabled;
      break;
    case "notes":
      fields.notes = enabled;
      break;
    case "timestamp":
      fields.timestamp = enabled;
      fields.branchCode = enabled;
      break;
    case "items":
      fields.itemHeaders = enabled;
      fields.itemQty = enabled;
      fields.itemAmount = enabled;
      break;
    case "totals":
      fields.subtotal = enabled;
      fields.discount = enabled;
      fields.service = enabled;
      fields.tax = enabled;
      fields.delivery = enabled;
      fields.total = enabled;
      break;
    case "footer":
      fields.footer = enabled;
      break;
    case "footerSecondary":
      fields.footerSecondary = enabled;
      break;
  }
  return { ...settings, fields };
}

function blockInputValue(
  settings: BillPrintSettings,
  blockId: string,
  branchName: string,
): { value: string; placeholder: string; editable: boolean; hint?: string } {
  if (!isBillSystemBlock(blockId)) {
    const line = settings.customLines.find((l) => l.id === blockId);
    return {
      value: line?.text ?? "",
      placeholder: "Custom line text",
      editable: true,
    };
  }
  const key = EDITABLE_SYSTEM_TEXT[blockId];
  if (key) {
    const placeholders: Record<string, string> = {
      headerBusinessName: branchName || "Business name",
      headerSubtitle: "Subtitle / tagline",
      documentTitle: "Tax Invoice",
      footerText: "Thank you — visit again",
      footerSecondaryText: "Phone · address · NTN",
    };
    return {
      value: String(settings[key] ?? ""),
      placeholder: placeholders[key] ?? "",
      editable: true,
    };
  }
  return {
    value: liveSample(blockId),
    placeholder: "",
    editable: false,
    hint: "Live from each order — use On / Bold / A± only",
  };
}

export function BillReceiptLayoutCanvas({
  settings,
  branchName,
  selectedId,
  onSelect,
  onChange,
}: Props): JSX.Element {
  const dragIdRef = useRef<string | null>(null);

  function moveBlock(fromId: string, toId: string): void {
    if (fromId === toId) return;
    const order = [...settings.blockOrder];
    const from = order.indexOf(fromId);
    const to = order.indexOf(toId);
    if (from < 0 || to < 0) return;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    onChange({ ...settings, blockOrder: order });
  }

  function moveBlockBy(blockId: string, delta: number): void {
    const order = [...settings.blockOrder];
    const from = order.indexOf(blockId);
    if (from < 0) return;
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    onChange({ ...settings, blockOrder: order });
  }

  function bumpSize(blockId: string, delta: number): void {
    if (!isBillSystemBlock(blockId)) {
      const line = settings.customLines.find((l) => l.id === blockId);
      if (!line) return;
      const current =
        line.fontSize > 0
          ? line.fontSize
          : resolveBlockFontSize(settings, blockId, settings.baseFontSize);
      const next = Math.max(BILL_LINE_FONT_MIN, Math.min(BILL_LINE_FONT_MAX, current + delta));
      onChange({
        ...settings,
        customLines: settings.customLines.map((row) =>
          row.id === blockId ? { ...row, fontSize: next } : row,
        ),
      });
      return;
    }
    const style = getBlockStyle(settings, blockId);
    const current =
      style.fontSize > 0
        ? style.fontSize
        : resolveBlockFontSize(settings, blockId, settings.baseFontSize);
    const next = Math.max(BILL_LINE_FONT_MIN, Math.min(BILL_LINE_FONT_MAX, current + delta));
    onChange({
      ...settings,
      blockStyles: {
        ...settings.blockStyles,
        [blockId]: { ...style, fontSize: next },
      },
    });
  }

  function toggleBold(blockId: string): void {
    if (!isBillSystemBlock(blockId)) {
      onChange({
        ...settings,
        customLines: settings.customLines.map((row) =>
          row.id === blockId ? { ...row, bold: !row.bold } : row,
        ),
      });
      return;
    }
    const style = getBlockStyle(settings, blockId);
    onChange({
      ...settings,
      blockStyles: {
        ...settings.blockStyles,
        [blockId]: { ...style, bold: !style.bold },
      },
    });
  }

  function updateLineText(blockId: string, text: string): void {
    if (!isBillSystemBlock(blockId)) {
      onChange({
        ...settings,
        customLines: settings.customLines.map((row) =>
          row.id === blockId ? { ...row, text } : row,
        ),
      });
      return;
    }
    const key = EDITABLE_SYSTEM_TEXT[blockId];
    if (!key) return;
    onChange({ ...settings, [key]: text });
  }

  function removeCustom(blockId: string): void {
    onChange({
      ...settings,
      customLines: settings.customLines.filter((row) => row.id !== blockId),
      blockOrder: settings.blockOrder.filter((id) => id !== blockId),
    });
  }

  function bumpBaseFont(delta: number): void {
    const next = Math.max(
      BILL_FONT_SIZE_MIN,
      Math.min(BILL_FONT_SIZE_MAX, settings.baseFontSize + delta),
    );
    onChange({ ...settings, baseFontSize: next });
  }

  const align = settings.headerAlign === "left" ? "text-left" : "text-center";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700">
      <div className="space-y-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Base typography
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
            disabled={settings.baseFontSize <= BILL_FONT_SIZE_MIN}
            onClick={() => bumpBaseFont(-1)}
          >
            A−
          </button>
          <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {settings.baseFontSize}px
          </span>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
            disabled={settings.baseFontSize >= BILL_FONT_SIZE_MAX}
            onClick={() => bumpBaseFont(1)}
          >
            A+
          </button>
          <span className="text-[10px] text-slate-400">
            Default size for all lines (each line can still override)
          </span>
        </div>
        <div className="text-[10px] text-slate-400">
          Edit any line below · ↑↓ / drag to move · B bold · A−/A+ line size
        </div>
      </div>

      <div className={`max-h-[520px] space-y-1 overflow-y-auto p-3 ${align}`}>
        {settings.blockOrder.map((blockId, index) => {
          const selected = selectedId === blockId;
          const enabled = isBlockEnabled(settings, blockId);
          const custom = !isBillSystemBlock(blockId)
            ? settings.customLines.find((l) => l.id === blockId)
            : null;
          const bold = custom ? custom.bold : getBlockStyle(settings, blockId).bold;
          const fontPx = resolveBlockFontSize(settings, blockId, settings.baseFontSize);
          const label = isBillSystemBlock(blockId)
            ? BILL_SYSTEM_BLOCK_LABELS[blockId]
            : "Custom line";
          const input = blockInputValue(settings, blockId, branchName);

          return (
            <div
              key={blockId}
              draggable
              onDragStart={(e) => {
                dragIdRef.current = blockId;
                e.dataTransfer.setData("text/plain", blockId);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("text/plain") || dragIdRef.current;
                if (fromId) moveBlock(fromId, blockId);
                dragIdRef.current = null;
              }}
              onClick={() => onSelect(blockId)}
              className={`cursor-grab rounded-md border px-2 py-1.5 active:cursor-grabbing ${
                selected
                  ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300 dark:border-amber-500 dark:bg-amber-950/30"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900/40"
              } ${enabled ? "" : "opacity-40"}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-1">
                <span className="select-none text-[10px] text-slate-400">⋮⋮</span>
                <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 disabled:opacity-30 dark:border-slate-600 dark:text-slate-300"
                    disabled={index === 0}
                    title="Move up"
                    onClick={() => moveBlockBy(blockId, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 disabled:opacity-30 dark:border-slate-600 dark:text-slate-300"
                    disabled={index >= settings.blockOrder.length - 1}
                    title="Move down"
                    onClick={() => moveBlockBy(blockId, 1)}
                  >
                    ↓
                  </button>
                </div>
                <span className="text-[9px] uppercase tracking-wide text-slate-400">{label}</span>
                <label
                  className="ml-auto flex items-center gap-1 text-[9px] text-slate-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="accent-amber-500"
                    checked={enabled}
                    onChange={(e) => onChange(setBlockEnabled(settings, blockId, e.target.checked))}
                  />
                  On
                </label>
                <button
                  type="button"
                  className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                    bold
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBold(blockId);
                  }}
                >
                  B
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] dark:border-slate-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    bumpSize(blockId, -1);
                  }}
                >
                  A−
                </button>
                <span className="min-w-[2rem] text-center text-[9px] tabular-nums text-slate-500">
                  {fontPx}px
                </span>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] dark:border-slate-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    bumpSize(blockId, 1);
                  }}
                >
                  A+
                </button>
                {custom ? (
                  <button
                    type="button"
                    className="rounded px-1 text-[9px] text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustom(blockId);
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              {input.editable ? (
                <input
                  className={`w-full ${fieldInputClass} ${bold ? "font-semibold" : ""}`}
                  style={{ fontSize: fontPx }}
                  value={input.value}
                  placeholder={input.placeholder}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateLineText(blockId, e.target.value)}
                />
              ) : (
                <div>
                  <input
                    className={`w-full ${fieldInputClass} cursor-default bg-slate-50 text-slate-500 dark:bg-slate-900/80`}
                    style={{ fontSize: fontPx }}
                    value={input.value}
                    readOnly
                    onClick={(e) => e.stopPropagation()}
                    title={input.hint}
                  />
                  {input.hint ? (
                    <p className="mt-0.5 text-left text-[9px] text-slate-400">{input.hint}</p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
