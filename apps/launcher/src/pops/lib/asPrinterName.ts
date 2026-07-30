/** Coerce unknown printer / option values to a usable OS printer name. */
export function asPrinterName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
