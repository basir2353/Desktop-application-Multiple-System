import * as XLSX from "xlsx";

/** Shared Excel helpers for custom import/export templates across the app. */

export function downloadExcelBlob(buffer: ArrayBuffer | Uint8Array | number[], filename: string): void {
  const bytes = buffer instanceof ArrayBuffer ? buffer : Uint8Array.from(buffer as ArrayLike<number>);
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function writeWorkbookDownload(
  sheets: { name: string; rows: Record<string, string | number | boolean | null | undefined>[] }[],
  filename: string,
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeRows =
      sheet.rows.length > 0
        ? sheet.rows
        : [{}];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeRows), sheet.name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadExcelBlob(buffer, filename);
}

export function readWorkbook(buffer: ArrayBuffer, filename: string): XLSX.WorkBook {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return XLSX.read(new TextDecoder().decode(buffer), { type: "string" });
  }
  return XLSX.read(buffer, { type: "array" });
}

export function pickSheet(
  wb: XLSX.WorkBook,
  preferredNames: string[],
  fallbackIncludes?: string[],
): XLSX.WorkSheet | null {
  const names = wb.SheetNames;
  for (const preferred of preferredNames) {
    const hit = names.find((n) => n.trim().toLowerCase() === preferred.trim().toLowerCase());
    if (hit && wb.Sheets[hit]) return wb.Sheets[hit]!;
  }
  if (fallbackIncludes?.length) {
    for (const part of fallbackIncludes) {
      const hit = names.find((n) => n.toLowerCase().includes(part.toLowerCase()));
      if (hit && wb.Sheets[hit]) return wb.Sheets[hit]!;
    }
  }
  const first = names[0];
  return first && wb.Sheets[first] ? wb.Sheets[first]! : null;
}

export function sheetRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function yesNo(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return fallback;
  return text === "yes" || text === "y" || text === "true" || text === "1";
}

export function cellString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (match && String(match[1] ?? "").trim()) return String(match[1]).trim();
  }
  return "";
}

export function cellNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && direct !== "") {
      const n = typeof direct === "number" ? direct : Number(String(direct).replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (match && match[1] != null && match[1] !== "") {
      const n =
        typeof match[1] === "number" ? match[1] : Number(String(match[1]).replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** Money / qty with up to 2 decimal places (no silent integer truncation). */
export function moneyNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function isoDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function instructionsRows(lines: string[]): Record<string, string | number>[] {
  return lines.map((line, i) => ({ Step: i + 1, Instruction: line }));
}
