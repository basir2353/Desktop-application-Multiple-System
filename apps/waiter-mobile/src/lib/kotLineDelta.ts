import { formatMenuItemLabel, type MenuItem, type MenuItemVariant } from "@platform/contracts";

export type MobileCartLineLike = {
  key: string;
  item: MenuItem;
  variant?: MenuItemVariant | null;
  qty: number;
  unitPrice: number;
  lineLabel?: string;
  printedQty?: number;
};

export type KotBaselineLine = {
  key: string;
  label: string;
  qty: number;
  menuItemId?: string;
  categoryId?: string;
};

export type KotDeltaKind = "add" | "increase" | "decrease" | "cancel";

export type KotDeltaPrintLine = {
  label: string;
  qty: number;
  unitPrice: number;
  menuItemId?: string;
  categoryId?: string;
  kind: KotDeltaKind;
};

function lineLabelOf(line: MobileCartLineLike): string {
  if (line.lineLabel?.trim()) return line.lineLabel.trim();
  return formatMenuItemLabel({
    name: line.item.name,
    portion: line.item.portion,
    variantLabel: line.variant?.label ?? null,
    simplePrice: line.item.simplePrice,
  });
}

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

export function cartToKotBaseline(lines: MobileCartLineLike[]): KotBaselineLine[] {
  return lines
    .filter((line) => line.qty > 0)
    .map((line) => ({
      key: line.key,
      label: lineLabelOf(line),
      qty: Math.max(0, Math.round(line.qty)),
      menuItemId: line.item.id.startsWith("orphan:") ? undefined : line.item.id,
      categoryId: line.item.categoryId,
    }));
}

export function diffKotLines(
  baseline: KotBaselineLine[],
  current: MobileCartLineLike[],
): KotDeltaPrintLine[] {
  const baseMap = new Map(baseline.map((line) => [line.key, line]));
  const currentClean = current.filter((line) => line.qty > 0);
  const curMap = new Map(currentClean.map((line) => [line.key, line]));
  const out: KotDeltaPrintLine[] = [];

  for (const line of currentClean) {
    const prev = baseMap.get(line.key);
    const label = lineLabelOf(line);
    const qty = Math.max(0, Math.round(line.qty));
    const menuItemId = line.item.id.startsWith("orphan:") ? undefined : line.item.id;
    const categoryId = line.item.categoryId;
    if (!prev) {
      out.push({
        label: formatKotDeltaPrintLabel("add", label),
        qty,
        unitPrice: 0,
        menuItemId,
        categoryId,
        kind: "add",
      });
      continue;
    }
    if (qty > prev.qty) {
      out.push({
        label: formatKotDeltaPrintLabel("increase", label),
        qty: qty - prev.qty,
        unitPrice: 0,
        menuItemId,
        categoryId,
        kind: "increase",
      });
    } else if (qty < prev.qty) {
      out.push({
        label: formatKotDeltaPrintLabel("decrease", label),
        qty: prev.qty - qty,
        unitPrice: 0,
        menuItemId,
        categoryId,
        kind: "decrease",
      });
    }
  }

  for (const prev of baseline) {
    if (curMap.has(prev.key)) continue;
    out.push({
      label: formatKotDeltaPrintLabel("cancel", prev.label),
      qty: prev.qty,
      unitPrice: 0,
      menuItemId: prev.menuItemId,
      categoryId: prev.categoryId,
      kind: "cancel",
    });
  }

  return out;
}
