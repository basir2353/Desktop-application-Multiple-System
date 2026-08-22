import { describe, expect, it } from "vitest";

/**
 * Mirrors extractPraInvoiceNumber / success parsing rules used by postPraPayloadFromClient.
 * Kept local so we can assert without exporting private helpers.
 */
function extractPraInvoiceNumber(
  obj: Record<string, unknown> | null,
  text: string,
): string {
  const candidates: unknown[] = [];
  if (obj) {
    candidates.push(
      obj.InvoiceNumber,
      obj.invoiceNumber,
      obj.InvoiceNo,
      obj.invoiceNo,
      obj.INVOICENUMBER,
    );
    const data = obj.data;
    if (typeof data === "object" && data) {
      const nested = data as Record<string, unknown>;
      candidates.push(nested.InvoiceNumber, nested.invoiceNumber, nested.InvoiceNo);
    }
  }
  for (const value of candidates) {
    const num = String(value ?? "").trim();
    if (num && !/^not available$/i.test(num) && !/^null$/i.test(num)) {
      return num;
    }
  }
  const match = text.match(/"InvoiceNumber"\s*:\s*"([^"]+)"/i);
  if (match?.[1] && !/^not available$/i.test(match[1].trim())) {
    return match[1].trim();
  }
  return "";
}

describe("PRA PostData invoice number extraction", () => {
  it("reads classic InvoiceNumber", () => {
    expect(
      extractPraInvoiceNumber({ Code: "100", InvoiceNumber: "197656ABCD12345678" }, ""),
    ).toBe("197656ABCD12345678");
  });

  it("reads nested data.InvoiceNumber", () => {
    expect(
      extractPraInvoiceNumber(
        { Code: "100", data: { InvoiceNumber: "197656NESTED99999999" } },
        "",
      ),
    ).toBe("197656NESTED99999999");
  });

  it("rejects Not Available", () => {
    expect(
      extractPraInvoiceNumber({ Code: "100", InvoiceNumber: "Not Available" }, ""),
    ).toBe("");
  });
});
