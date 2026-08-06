import { formatMenuItemPrintLabel, type MenuItem, type MenuItemVariant } from "@platform/contracts";
import type { PosCartLine } from "./posCart";

/** Snapshot of a kitchen ticket line before the cashier edits it. */
export type KotBaselineLine = {
  key: string;
  label: string;
  qty: number;
  item: MenuItem;
  variant: MenuItemVariant | null;
  unitPrice: number;
};

export type KotDeltaKind = "add" | "increase" | "decrease" | "cancel";

export type KotDeltaLine = {
  key: string;
  kind: KotDeltaKind;
  /** Original item name (no prefix). */
  label: string;
  /** Kitchen slip label with ADD / EXTRA / CANCEL. */
  printLabel: string;
  /** Qty to print (delta for increase/decrease; full for add/cancel). */
  qty: number;
  item: MenuItem;
  variant: MenuItemVariant | null;
  unitPrice: number;
};

export function formatKotDeltaPrintLabel(kind: KotDeltaKind, label: string): string {
  const name = label.trim() || "Item";
  switch (kind) {
    case "add":
      return `+ ADD  ${name}`;
    case "increase":
      return `↑ EXTRA  ${name}`;
    case "decrease":
      return `↓ CANCEL  ${name}`;
    case "cancel":
      return `✕ CANCEL  ${name}`;
  }
}

export function cartLinesToKotBaseline(lines: PosCartLine[]): KotBaselineLine[] {
  return lines
    .filter((line) => !line.isComplimentary && line.qty > 0)
    .map((line) => ({
      key: line.key,
      label: formatMenuItemPrintLabel({
        name: line.item.name,
        secondaryName: line.item.secondaryName,
        portion: line.item.portion,
        variantLabel: line.variant?.label ?? null,
        simplePrice: line.item.simplePrice,
      }),
      qty: Math.max(0, Math.round(line.qty)),
      item: line.item,
      variant: line.variant,
      unitPrice: line.unitPrice,
    }));
}

/** Diff current cart vs baseline — only changed lines (for UPDATE REVISED KOTs). */
export function diffKotLines(
  baseline: KotBaselineLine[],
  current: PosCartLine[],
): KotDeltaLine[] {
  const baseMap = new Map(baseline.map((line) => [line.key, line]));
  const currentClean = current.filter((line) => !line.isComplimentary && line.qty > 0);
  const curMap = new Map(currentClean.map((line) => [line.key, line]));
  const out: KotDeltaLine[] = [];

  for (const line of currentClean) {
    const prev = baseMap.get(line.key);
    const label = formatMenuItemPrintLabel({
      name: line.item.name,
      secondaryName: line.item.secondaryName,
      portion: line.item.portion,
      variantLabel: line.variant?.label ?? null,
      simplePrice: line.item.simplePrice,
    });
    const qty = Math.max(0, Math.round(line.qty));
    if (!prev) {
      out.push({
        key: line.key,
        kind: "add",
        label,
        printLabel: formatKotDeltaPrintLabel("add", label),
        qty,
        item: line.item,
        variant: line.variant,
        unitPrice: line.unitPrice,
      });
      continue;
    }
    if (qty > prev.qty) {
      out.push({
        key: line.key,
        kind: "increase",
        label,
        printLabel: formatKotDeltaPrintLabel("increase", label),
        qty: qty - prev.qty,
        item: line.item,
        variant: line.variant,
        unitPrice: line.unitPrice,
      });
    } else if (qty < prev.qty) {
      out.push({
        key: line.key,
        kind: "decrease",
        label,
        printLabel: formatKotDeltaPrintLabel("decrease", label),
        qty: prev.qty - qty,
        item: line.item,
        variant: line.variant,
        unitPrice: line.unitPrice,
      });
    }
  }

  for (const prev of baseline) {
    if (curMap.has(prev.key)) continue;
    out.push({
      key: prev.key,
      kind: "cancel",
      label: prev.label,
      printLabel: formatKotDeltaPrintLabel("cancel", prev.label),
      qty: prev.qty,
      item: prev.item,
      variant: prev.variant,
      unitPrice: prev.unitPrice,
    });
  }

  return out;
}

/** Turn deltas into cart lines so section routing still works. */
export function kotDeltasToCartLines(deltas: KotDeltaLine[]): PosCartLine[] {
  return deltas.map((delta, index) => ({
    key: delta.key,
    item: delta.item,
    variant: delta.variant,
    qty: Math.max(1, delta.qty),
    unitPrice: delta.unitPrice,
    lineLabel: delta.printLabel,
    sortOrder: index + 1,
  }));
}
