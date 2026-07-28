import * as XLSX from "xlsx";

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

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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

export function downloadStoreProductImportTemplate(branchCode?: string): void {
  const templateRows = [
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
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateRows), SHEET_NAME);
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `store-items-template-${branchCode ?? "branch"}-${date}.xlsx`,
  );
}

export function parseStoreProductImportFile(file: ArrayBuffer): StoreProductImportRow[] {
  const wb = XLSX.read(file, { type: "array" });
  const sheet =
    wb.Sheets[SHEET_NAME] ??
    wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase().includes("item")) ?? ""] ??
    wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const out: StoreProductImportRow[] = [];
  for (const row of rows) {
    const name = cellString(row, "Item Name", "Name", "Product Name");
    if (!name) continue;
    const barcode = cellString(row, "Barcode", "UPC", "Primary Barcode");
    const alts = collectAltBarcodes(row).filter((c) => c !== barcode);
    out.push({
      name,
      qty: Math.max(0, Math.round(cellNumber(row, "Qty", "Quantity", "Stock", "Available Stock"))),
      serialNumber: cellString(row, "Serial Number", "Serial", "Serial No"),
      barcode,
      alternativeBarcodes: alts.slice(0, 9),
      cost: Math.max(0, Math.round(cellNumber(row, "Cost", "Purchase Price", "Original Price"))),
      salePrice: Math.max(0, Math.round(cellNumber(row, "Sale Price", "Selling Price", "Regular Price", "Price"))),
      description: cellString(row, "Item Description", "Description"),
      color: cellString(row, "Color", "Colour"),
      size: cellString(row, "Size"),
    });
  }
  return out;
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
