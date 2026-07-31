import {
  activeMenuVariants,
  type BranchMenu,
  type MenuCategory,
  type MenuItem,
} from "@platform/contracts";
import {
  cellNumber,
  cellString,
  instructionsRows,
  isoDateStamp,
  moneyNumber,
  pickSheet,
  readWorkbook,
  sheetRows,
  writeWorkbookDownload,
  yesNo,
} from "../../lib/excelTransfer";

export type MenuImportRow = {
  category: string;
  itemName: string;
  secondaryName: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  variantLabel: string;
  price: number;
  barcode: string;
};

export type MenuCategoryImportRow = {
  name: string;
  sortOrder: number;
  active: boolean;
};

export type MenuImportSummary = {
  categoriesCreated: number;
  categoriesUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  skipped: number;
  skipReasons: string[];
};

const CATEGORIES_SHEET = "Categories";
const MENU_ITEMS_SHEET = "Menu Items";
const INSTRUCTIONS_SHEET = "Instructions";

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
        "Secondary Name": item.secondaryName ?? "",
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

function categoryExportRows(menu: BranchMenu): Record<string, string | number>[] {
  return menu.categories.map((c) => ({
    Name: c.name,
    "Sort Order": c.sortOrder,
    Active: c.isActive ? "Yes" : "No",
  }));
}

const MENU_TEMPLATE_INSTRUCTIONS = [
  "Fill the Menu Items sheet — one row per item variant (Small/Medium/Large = separate rows with the same Item Name).",
  "Required columns on Menu Items: Category, Item Name, Price. Variant Label defaults to Standard if blank.",
  "Optional: Secondary Name, Featured (Yes/No), Active (Yes/No), Sort Order, Barcode.",
  "Categories sheet is optional but recommended — Name, Sort Order, Active. Missing categories are created from Menu Items.",
  "Featured/Active accept: Yes, No, Y, N, true, false, 1, 0.",
  "Re-importing the same Item Name + Category updates that item (when you have full menu permission).",
  "Save as .xlsx (recommended) or .csv. Keep sheet names: Categories, Menu Items.",
  "Do not change column header spelling. Extra columns are ignored.",
];

export function exportMenuExcel(menu: BranchMenu, branchCode: string): void {
  writeWorkbookDownload(
    [
      { name: INSTRUCTIONS_SHEET, rows: instructionsRows(MENU_TEMPLATE_INSTRUCTIONS) },
      { name: CATEGORIES_SHEET, rows: categoryExportRows(menu) },
      {
        name: MENU_ITEMS_SHEET,
        rows:
          menuItemRows(menu).length > 0
            ? menuItemRows(menu)
            : [
                {
                  Category: "",
                  "Item Name": "",
                  "Secondary Name": "",
                  Featured: "",
                  Active: "",
                  "Sort Order": 0,
                  "Variant Label": "",
                  Price: 0,
                  Barcode: "",
                },
              ],
      },
    ],
    `menu-${branchCode}-${isoDateStamp()}.xlsx`,
  );
}

export function downloadMenuImportTemplateExcel(branchCode?: string): void {
  const code = branchCode ? `-${branchCode}` : "";
  writeWorkbookDownload(
    [
      { name: INSTRUCTIONS_SHEET, rows: instructionsRows(MENU_TEMPLATE_INSTRUCTIONS) },
      {
        name: CATEGORIES_SHEET,
        rows: [
          { Name: "Mains", "Sort Order": 1, Active: "Yes" },
          { Name: "Drinks", "Sort Order": 2, Active: "Yes" },
        ],
      },
      {
        name: MENU_ITEMS_SHEET,
        rows: [
          {
            Category: "Mains",
            "Item Name": "Chicken Karahi",
            "Secondary Name": "",
            Featured: "Yes",
            Active: "Yes",
            "Sort Order": 1,
            "Variant Label": "Full",
            Price: 1200,
            Barcode: "",
          },
          {
            Category: "Mains",
            "Item Name": "Chicken Karahi",
            "Secondary Name": "",
            Featured: "Yes",
            Active: "Yes",
            "Sort Order": 1,
            "Variant Label": "Half",
            Price: 700,
            Barcode: "",
          },
          {
            Category: "Drinks",
            "Item Name": "Fresh Lime",
            "Secondary Name": "",
            Featured: "No",
            Active: "Yes",
            "Sort Order": 1,
            "Variant Label": "Standard",
            Price: 150,
            Barcode: "",
          },
        ],
      },
    ],
    `menu-import-template${code}-${isoDateStamp()}.xlsx`,
  );
}

export function parseMenuCategorySheet(
  buffer: ArrayBuffer,
  filename: string,
): MenuCategoryImportRow[] {
  const wb = readWorkbook(buffer, filename);
  const sheet = pickSheet(wb, [CATEGORIES_SHEET], ["categor"]);
  if (!sheet) return [];
  const out: MenuCategoryImportRow[] = [];
  for (const row of sheetRows(sheet)) {
    const name = cellString(row, "Name", "Category", "category name");
    if (!name) continue;
    out.push({
      name,
      sortOrder: cellNumber(row, "Sort Order", "sort order"),
      active: yesNo(cellString(row, "Active", "active"), true),
    });
  }
  return out;
}

export function parseMenuImportFile(
  buffer: ArrayBuffer,
  filename: string,
): { rows: MenuImportRow[]; skipped: number; skipReasons: string[] } {
  const wb = readWorkbook(buffer, filename);
  const sheet = pickSheet(wb, [MENU_ITEMS_SHEET], ["menu", "item"]);
  if (!sheet) return { rows: [], skipped: 0, skipReasons: ["Menu Items sheet not found"] };

  const rawRows = sheetRows(sheet);
  const parsed: MenuImportRow[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]!;
    const category = cellString(row, "Category", "category");
    const itemName = cellString(row, "Item Name", "Item", "item name", "name");
    const variantLabel =
      cellString(row, "Variant Label", "Variant", "variant label", "Size") || "Standard";
    const price = moneyNumber(cellNumber(row, "Price", "price"));
    const line = i + 2; // header is row 1

    if (!category && !itemName && price <= 0) continue; // blank template row
    if (!category || !itemName) {
      skipped += 1;
      if (skipReasons.length < 8) {
        skipReasons.push(`Row ${line}: Category and Item Name are required`);
      }
      continue;
    }
    if (price <= 0) {
      skipped += 1;
      if (skipReasons.length < 8) {
        skipReasons.push(`Row ${line} (${itemName}): Price must be greater than 0`);
      }
      continue;
    }

    parsed.push({
      category,
      itemName,
      secondaryName: cellString(row, "Secondary Name", "secondary name"),
      featured: yesNo(cellString(row, "Featured", "featured")),
      active: yesNo(cellString(row, "Active", "active"), true),
      sortOrder: cellNumber(row, "Sort Order", "sort order"),
      variantLabel,
      price,
      barcode: cellString(row, "Barcode", "barcode"),
    });
  }

  return { rows: parsed, skipped, skipReasons };
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
  /** When false, existing items are skipped instead of updated. */
  allowUpdate?: boolean;
  categoryMeta?: MenuCategoryImportRow[];
  createCategory: (input: {
    name: string;
    sortOrder: number;
  }) => Promise<MenuCategory>;
  updateCategory?: (
    categoryId: string,
    input: { sortOrder?: number; isActive?: boolean },
  ) => Promise<MenuCategory>;
  createItem: (input: {
    categoryId: string;
    name: string;
    secondaryName?: string;
    featured: boolean;
    sortOrder: number;
    variants: { label: string; price: number; barcode?: string }[];
  }) => Promise<MenuItem>;
  updateItem: (
    itemId: string,
    input: {
      secondaryName?: string;
      featured: boolean;
      isActive: boolean;
      sortOrder: number;
      variants: { label: string; price: number; barcode?: string }[];
    },
  ) => Promise<MenuItem>;
};

function toApiPrice(price: number): number {
  return Math.max(1, Math.round(moneyNumber(price)));
}

export async function importMenuRows(rows: MenuImportRow[], deps: MenuImportDeps): Promise<MenuImportSummary> {
  const summary: MenuImportSummary = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    skipped: 0,
    skipReasons: [],
  };

  const allowUpdate = deps.allowUpdate !== false;
  const categories = [...deps.categories];
  const items = [...deps.items];

  // Apply Categories sheet first (create / update metadata).
  for (const meta of deps.categoryMeta ?? []) {
    const existing = findCategory(categories, meta.name);
    if (!existing) {
      const created = await deps.createCategory({
        name: meta.name.trim(),
        sortOrder: meta.sortOrder || categories.length,
      });
      categories.push(created);
      summary.categoriesCreated += 1;
      if (deps.updateCategory && meta.active === false) {
        await deps.updateCategory(created.id, { isActive: false });
      }
    } else if (allowUpdate && deps.updateCategory) {
      await deps.updateCategory(existing.id, {
        sortOrder: meta.sortOrder || existing.sortOrder,
        isActive: meta.active,
      });
      summary.categoriesUpdated += 1;
    }
  }

  if (rows.length === 0) return summary;

  const grouped = groupMenuImportRows(rows);

  for (const [categoryName, itemMap] of grouped) {
    let category = findCategory(categories, categoryName);
    if (!category) {
      const meta = (deps.categoryMeta ?? []).find(
        (c) => normalizeName(c.name) === normalizeName(categoryName),
      );
      category = await deps.createCategory({
        name: categoryName.trim(),
        sortOrder: meta?.sortOrder || categories.length,
      });
      categories.push(category);
      summary.categoriesCreated += 1;
      if (deps.updateCategory && meta && meta.active === false) {
        await deps.updateCategory(category.id, { isActive: false });
      }
    }

    for (const [itemName, variantRows] of itemMap) {
      const first = variantRows[0];
      if (!first) continue;

      const variants = variantRows.map((row) => ({
        label: row.variantLabel.trim() || "Standard",
        price: toApiPrice(row.price),
        barcode: row.barcode.trim() || undefined,
      }));

      const existing = findItem(items, category.id, itemName);
      if (existing) {
        if (!allowUpdate) {
          summary.skipped += 1;
          if (summary.skipReasons.length < 8) {
            summary.skipReasons.push(`"${itemName}" already exists (add-only role cannot update)`);
          }
          continue;
        }
        await deps.updateItem(existing.id, {
          secondaryName: first.secondaryName || undefined,
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
          secondaryName: first.secondaryName || undefined,
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
