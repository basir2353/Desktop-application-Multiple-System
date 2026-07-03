import * as XLSX from "xlsx";
import {
  activeMenuVariants,
  type BranchMenu,
  type MenuCategory,
  type MenuItem,
} from "@platform/contracts";

export type MenuImportRow = {
  category: string;
  itemName: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  variantLabel: string;
  price: number;
  barcode: string;
};

export type MenuImportSummary = {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  skipped: number;
};

const MENU_ITEMS_SHEET = "Menu Items";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function yesNo(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return fallback;
  return text === "yes" || text === "y" || text === "true" || text === "1";
}

function cellString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (match && String(match[1] ?? "").trim()) return String(match[1]).trim();
  }
  return "";
}

function cellNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && direct !== "") {
      const n = Number(direct);
      if (Number.isFinite(n)) return n;
    }
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (match && match[1] != null && match[1] !== "") {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function menuItemRows(menu: BranchMenu): Record<string, string | number>[] {
  const categoryById = new Map(menu.categories.map((c) => [c.id, c]));
  const rows: Record<string, string | number>[] = [];

  for (const item of menu.items) {
    const categoryName = categoryById.get(item.categoryId)?.name ?? "";
    const variants = activeMenuVariants(item);
    const variantRows =
      variants.length > 0
        ? variants
        : [
            {
              label: "Standard",
              price: item.price,
              barcode: item.barcode,
            },
          ];

    for (const variant of variantRows) {
      rows.push({
        Category: categoryName,
        "Item Name": item.name,
        Featured: item.featured ? "Yes" : "No",
        Active: item.isActive ? "Yes" : "No",
        "Sort Order": item.sortOrder,
        "Variant Label": variant.label,
        Price: variant.price,
        Barcode: variant.barcode ?? "",
      });
    }
  }

  return rows;
}

export function exportMenuExcel(menu: BranchMenu, branchCode: string): void {
  const categoryRows = menu.categories.map((c) => ({
    Name: c.name,
    "Sort Order": c.sortOrder,
    Active: c.isActive ? "Yes" : "No",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoryRows), "Categories");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(menuItemRows(menu)), MENU_ITEMS_SHEET);

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `menu-${branchCode}-${date}.xlsx`,
  );
}

export function parseMenuImportFile(buffer: ArrayBuffer, filename: string): MenuImportRow[] {
  const lower = filename.toLowerCase();
  const wb = lower.endsWith(".csv")
    ? XLSX.read(new TextDecoder().decode(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });
  const sheetName =
    wb.SheetNames.find((name) => name.toLowerCase() === MENU_ITEMS_SHEET.toLowerCase()) ??
    wb.SheetNames.find((name) => name.toLowerCase().includes("menu")) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const parsed: MenuImportRow[] = [];

  for (const row of rawRows) {
    const category = cellString(row, "Category", "category");
    const itemName = cellString(row, "Item Name", "Item", "item name", "name");
    const variantLabel = cellString(row, "Variant Label", "Variant", "variant label", "Size") || "Standard";
    const price = cellNumber(row, "Price", "price");
    if (!category || !itemName || price <= 0) continue;

    parsed.push({
      category,
      itemName,
      featured: yesNo(cellString(row, "Featured", "featured")),
      active: yesNo(cellString(row, "Active", "active"), true),
      sortOrder: cellNumber(row, "Sort Order", "sort order"),
      variantLabel,
      price: Math.round(price),
      barcode: cellString(row, "Barcode", "barcode"),
    });
  }

  return parsed;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function findCategory(categories: MenuCategory[], name: string): MenuCategory | undefined {
  const key = normalizeName(name);
  return categories.find((c) => normalizeName(c.name) === key);
}

function findItem(items: MenuItem[], categoryId: string, name: string): MenuItem | undefined {
  const key = normalizeName(name);
  return items.find((i) => i.categoryId === categoryId && normalizeName(i.name) === key);
}

export function groupMenuImportRows(rows: MenuImportRow[]): Map<string, Map<string, MenuImportRow[]>> {
  const grouped = new Map<string, Map<string, MenuImportRow[]>>();
  for (const row of rows) {
    const categoryKey = row.category.trim();
    const itemKey = row.itemName.trim();
    if (!grouped.has(categoryKey)) grouped.set(categoryKey, new Map());
    const items = grouped.get(categoryKey)!;
    if (!items.has(itemKey)) items.set(itemKey, []);
    items.get(itemKey)!.push(row);
  }
  return grouped;
}

export type MenuImportDeps = {
  branchCode: string;
  categories: MenuCategory[];
  items: MenuItem[];
  createCategory: (input: { name: string; sortOrder: number }) => Promise<MenuCategory>;
  createItem: (input: {
    categoryId: string;
    name: string;
    featured: boolean;
    sortOrder: number;
    variants: { label: string; price: number; barcode?: string }[];
  }) => Promise<MenuItem>;
  updateItem: (
    itemId: string,
    input: {
      featured: boolean;
      isActive: boolean;
      sortOrder: number;
      variants: { label: string; price: number; barcode?: string }[];
    },
  ) => Promise<MenuItem>;
};

export async function importMenuRows(rows: MenuImportRow[], deps: MenuImportDeps): Promise<MenuImportSummary> {
  const summary: MenuImportSummary = {
    categoriesCreated: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    skipped: 0,
  };

  if (rows.length === 0) return summary;

  const categories = [...deps.categories];
  const items = [...deps.items];
  const grouped = groupMenuImportRows(rows);

  for (const [categoryName, itemMap] of grouped) {
    let category = findCategory(categories, categoryName);
    if (!category) {
      category = await deps.createCategory({
        name: categoryName.trim(),
        sortOrder: categories.length,
      });
      categories.push(category);
      summary.categoriesCreated += 1;
    }

    for (const [itemName, variantRows] of itemMap) {
      const first = variantRows[0];
      if (!first) continue;

      const variants = variantRows.map((row) => ({
        label: row.variantLabel.trim() || "Standard",
        price: row.price,
        barcode: row.barcode.trim() || undefined,
      }));

      const existing = findItem(items, category.id, itemName);
      if (existing) {
        await deps.updateItem(existing.id, {
          featured: first.featured,
          isActive: first.active,
          sortOrder: first.sortOrder || existing.sortOrder,
          variants,
        });
        summary.itemsUpdated += 1;
      } else {
        const created = await deps.createItem({
          categoryId: category.id,
          name: itemName.trim(),
          featured: first.featured,
          sortOrder: first.sortOrder || items.filter((i) => i.categoryId === category!.id).length,
          variants,
        });
        items.push(created);
        summary.itemsCreated += 1;
      }
    }
  }

  return summary;
}
