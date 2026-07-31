import type { StoreProduct } from "@platform/contracts";
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
} from "../../lib/excelTransfer";

export type StoreProductImportRow = {
  name: string;
  qty: number;
  serialNumber: string;
  barcode: string;
  alternativeBarcodes: string[];
  cost: number;
  salePrice: number;
  description: string;
  color: string;
  size: string;
};

export type StoreProductImportSummary = {
  created: number;
  skipped: number;
  errors: string[];
};

const SHEET_NAME = "Items";
const INSTRUCTIONS_SHEET = "Instructions";

const STORE_TEMPLATE_INSTRUCTIONS = [
  "Fill the Items sheet — one row per product.",
  "Required: Item Name. Recommended: Qty, Barcode, Cost, Sale Price.",
  "Alternative barcodes: put comma-separated codes in Alternative Barcode, or use Barcode 2 / Barcode 3 columns.",
  "Serial Number is optional (enables serial tracking when set).",
  "Optional: Item Description, Color, Size.",
  "Export downloads your current catalog in the same template format for editing and re-import.",
  "Import creates new items only (it does not update existing products by barcode).",
  "Save as .xlsx (recommended) or .csv. Keep sheet name: Items.",
];

function productToRow(p: StoreProduct): Record<string, string | number> {
  const barcodes = (p.barcodes?.length ? p.barcodes : p.barcode ? [p.barcode] : []).filter(Boolean);
  const primary = barcodes[0] ?? "";
  const alts = barcodes.slice(1);
  return {
    "Item Name": p.name,
    Qty: p.availableStock ?? 0,
    "Serial Number": p.serialNumbers?.[0] ?? "",
    Barcode: primary,
    "Alternative Barcode": alts.join(","),
    "Barcode 2": alts[0] ?? "",
    "Barcode 3": alts[1] ?? "",
    "Barcode 4": alts[2] ?? "",
    Cost: p.purchasePrice ?? p.orderCost ?? 0,
    "Sale Price": p.sellingPrice ?? p.salePrice ?? 0,
    "Item Description": p.description ?? "",
    Color: p.color ?? "",
    Size: p.size ?? "",
  };
}

function collectAltBarcodes(row: Record<string, unknown>): string[] {
  const codes: string[] = [];
  const joined = cellString(
    row,
    "Alternative Barcode",
    "Alternative Barcodes",
    "Alt Barcode",
    "Alt Barcodes",
    "ALU",
  );
  if (joined) {
    for (const part of joined.split(/[,;|]/)) {
      const c = part.trim();
      if (c && !codes.includes(c)) codes.push(c);
    }
  }
  for (let i = 1; i <= 10; i++) {
    const c = cellString(row, `Barcode ${i + 1}`, `Alt Barcode ${i}`, `ALU ${i}`, `Alternative Barcode ${i}`);
    if (c && !codes.includes(c)) codes.push(c);
  }
  return codes.slice(0, 11);
}

export function exportStoreProductsExcel(products: StoreProduct[], branchCode: string): void {
  writeWorkbookDownload(
    [
      { name: INSTRUCTIONS_SHEET, rows: instructionsRows(STORE_TEMPLATE_INSTRUCTIONS) },
      {
        name: SHEET_NAME,
        rows:
          products.length > 0
            ? products.map(productToRow)
            : [
                {
                  "Item Name": "",
                  Qty: 0,
                  "Serial Number": "",
                  Barcode: "",
                  "Alternative Barcode": "",
                  "Barcode 2": "",
                  "Barcode 3": "",
                  "Barcode 4": "",
                  Cost: 0,
                  "Sale Price": 0,
                  "Item Description": "",
                  Color: "",
                  Size: "",
                },
              ],
      },
    ],
    `store-items-${branchCode}-${isoDateStamp()}.xlsx`,
  );
}

export function downloadStoreProductImportTemplate(branchCode?: string): void {
  writeWorkbookDownload(
    [
      { name: INSTRUCTIONS_SHEET, rows: instructionsRows(STORE_TEMPLATE_INSTRUCTIONS) },
      {
        name: SHEET_NAME,
        rows: [
          {
            "Item Name": "Example Shirt",
            Qty: 10,
            "Serial Number": "SN-001",
            Barcode: "628100000001",
            "Alternative Barcode": "628100000002,628100000003",
            "Barcode 2": "",
            "Barcode 3": "",
            "Barcode 4": "",
            Cost: 3500,
            "Sale Price": 3600,
            "Item Description": "Cotton shirt",
            Color: "Blue",
            Size: "L",
          },
        ],
      },
    ],
    `store-items-template-${branchCode ?? "branch"}-${isoDateStamp()}.xlsx`,
  );
}

export function parseStoreProductImportFile(
  buffer: ArrayBuffer,
  filename = "import.xlsx",
): { rows: StoreProductImportRow[]; skipped: number; skipReasons: string[] } {
  const wb = readWorkbook(buffer, filename);
  const sheet = pickSheet(wb, [SHEET_NAME], ["item", "product"]);
  if (!sheet) {
    return { rows: [], skipped: 0, skipReasons: ["Items sheet not found"] };
  }

  const raw = sheetRows(sheet);
  const out: StoreProductImportRow[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]!;
    const name = cellString(row, "Item Name", "Name", "Product Name");
    const line = i + 2;
    if (!name) {
      const maybeEmpty =
        !cellString(row, "Barcode") && cellNumber(row, "Qty", "Cost", "Sale Price") === 0;
      if (maybeEmpty) continue;
      skipped += 1;
      if (skipReasons.length < 8) skipReasons.push(`Row ${line}: Item Name is required`);
      continue;
    }
    const barcode = cellString(row, "Barcode", "UPC", "Primary Barcode");
    const alts = collectAltBarcodes(row).filter((c) => c !== barcode);
    out.push({
      name,
      qty: Math.max(0, Math.round(cellNumber(row, "Qty", "Quantity", "Stock", "Available Stock"))),
      serialNumber: cellString(row, "Serial Number", "Serial", "Serial No"),
      barcode,
      alternativeBarcodes: alts.slice(0, 9),
      cost: Math.max(0, Math.round(moneyNumber(cellNumber(row, "Cost", "Purchase Price", "Original Price")))),
      salePrice: Math.max(
        0,
        Math.round(moneyNumber(cellNumber(row, "Sale Price", "Selling Price", "Regular Price", "Price"))),
      ),
      description: cellString(row, "Item Description", "Description"),
      color: cellString(row, "Color", "Colour"),
      size: cellString(row, "Size"),
    });
  }

  return { rows: out, skipped, skipReasons };
}

export function importRowToCreatePayload(row: StoreProductImportRow, branchCode: string) {
  const barcodes = [row.barcode, ...row.alternativeBarcodes].map((c) => c.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const code of barcodes) {
    if (!unique.includes(code)) unique.push(code);
  }
  const serialNumbers = row.serialNumber ? [row.serialNumber] : undefined;
  return {
    branchCode,
    name: row.name,
    description: row.description || undefined,
    barcode: unique[0],
    barcodes: unique.slice(0, 12),
    purchasePrice: row.cost,
    orderCost: row.cost,
    sellingPrice: row.salePrice,
    salePrice: row.salePrice,
    mrpPrice: 0,
    wholesalePrice: 0,
    customPrice: 0,
    marketSalePrice: 0,
    marginPct: 0,
    markupPct: 0,
    taxPct: 0,
    reorderLevel: 10,
    availableStock: row.qty,
    trackBatch: false,
    trackSerial: Boolean(serialNumbers?.length),
    isWeighed: false,
    color: row.color || undefined,
    size: row.size || undefined,
    serialNumbers,
  };
}
