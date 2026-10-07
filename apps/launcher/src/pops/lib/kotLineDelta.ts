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

/**
 * Reason popup only when an existing line qty is reduced or removed.
 * Adding new items or increasing qty does not require a reason.
 */
export function kotDeltaRequiresChangeReason(
  deltas: Array<{ kind: KotDeltaKind }>,
): boolean {
  return deltas.some((d) => d.kind === "decrease" || d.kind === "cancel");
}

/**
 * Reason popup only after the grace window since the KOT / ticket baseline time.
 * Within grace (e.g. just placed, fixing qty), no reason is required.
 */
export function kotChangeReasonGraceExpired(
  baselineAtMs: number | null | undefined,
  graceMinutes: number,
  nowMs: number = Date.now(),
): boolean {
  if (baselineAtMs == null || !Number.isFinite(baselineAtMs) || baselineAtMs <= 0) {
    return false;
  }
  const graceMs = Math.max(0, Math.round(graceMinutes)) * 60_000;
  return nowMs - baselineAtMs >= graceMs;
}

export function parseKotBaselineAtMs(iso: string | null | undefined): number {
  if (!iso) return Date.now();
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
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
