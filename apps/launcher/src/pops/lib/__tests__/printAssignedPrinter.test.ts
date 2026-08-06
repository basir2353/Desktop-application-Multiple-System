import { describe, expect, it, vi, beforeEach } from "vitest";
import { asPrinterName } from "../asPrinterName";
import {
  isVirtualSystemPrinter,
  isXpsSystemPrinter,
  preferPdfOverXpsPrinter,
} from "../systemPrinters";

describe("assigned printer naming", () => {
  it("asPrinterName keeps real OS names and drops empty", () => {
    expect(asPrinterName("EPSON TM-T82")).toBe("EPSON TM-T82");
    expect(asPrinterName("  ")).toBeUndefined();
    expect(asPrinterName(null)).toBeUndefined();
    expect(asPrinterName(undefined)).toBeUndefined();
  });

  it("detects PDF/XPS as virtual — not physical thermals", () => {
    expect(isVirtualSystemPrinter("Microsoft Print to PDF")).toBe(true);
    expect(isVirtualSystemPrinter("Microsoft XPS Document Writer")).toBe(true);
    expect(isVirtualSystemPrinter("EPSON TM-T82III")).toBe(false);
    expect(isVirtualSystemPrinter("XP-80C")).toBe(false);
  });

  it("preferPdfOverXps only remaps XPS, never a thermal name", () => {
    expect(isXpsSystemPrinter("Microsoft XPS Document Writer")).toBe(true);
    expect(preferPdfOverXpsPrinter("Microsoft XPS Document Writer")).toBe(
      "Microsoft Print to PDF",
    );
    // Physical thermals pass through unchanged — never become PDF.
    expect(preferPdfOverXpsPrinter("EPSON TM-T82")).toBe("EPSON TM-T82");
    expect(preferPdfOverXpsPrinter("XP-80C")).toBe("XP-80C");
    expect(preferPdfOverXpsPrinter("EPSON TM-T82")).not.toBe("Microsoft Print to PDF");
  });
});

describe("resolveSilentSystemPrinterName — no invented PDF", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null for receipt when nothing is linked (does not invent PDF)", async () => {
    vi.doMock("../systemPrinters", async () => {
      const actual = await vi.importActual<typeof import("../systemPrinters")>("../systemPrinters");
      return {
        ...actual,
        listSystemPrinters: async () => [
          {
            name: "Microsoft Print to PDF",
            systemName: "Microsoft Print to PDF",
            driverName: "pdf",
            portName: "PORTPROMPT:",
            isDefault: true,
            isShared: false,
            state: "ready" as const,
            connectionType: "Other" as const,
            isVirtual: true,
          },
        ],
      };
    });
    vi.doMock("../printerRouting", () => ({
      loadPrinterRouting: () => ({
        printers: [],
        sectionPrinters: {},
        userPrinters: {},
        categorySections: {},
        itemSections: {},
      }),
      resolveKotPrinter: () => null,
      resolveDefaultPrinterByType: () => null,
      resolvePrinterForUser: () => null,
      resolveReceiptPrinter: () => null,
    }));

    const { resolveSilentSystemPrinterName } = await import("../branchPrintClient");
    const name = await resolveSilentSystemPrinterName({
      branchCode: "TEST",
      kind: "receipt",
    });
    expect(name).toBeNull();
    expect(name).not.toBe("Microsoft Print to PDF");
  });

  it("returns linked physical hint when present on OS list", async () => {
    vi.doMock("../systemPrinters", async () => {
      const actual = await vi.importActual<typeof import("../systemPrinters")>("../systemPrinters");
      return {
        ...actual,
        listSystemPrinters: async () => [
          {
            name: "EPSON TM-T82",
            systemName: "EPSON TM-T82",
            driverName: "epson",
            portName: "USB001",
            isDefault: false,
            isShared: false,
            state: "ready" as const,
            connectionType: "USB" as const,
            isVirtual: false,
          },
          {
            name: "Microsoft Print to PDF",
            systemName: "Microsoft Print to PDF",
            driverName: "pdf",
            portName: "PORTPROMPT:",
            isDefault: true,
            isShared: false,
            state: "ready" as const,
            connectionType: "Other" as const,
            isVirtual: true,
          },
        ],
      };
    });
    vi.doMock("../printerRouting", () => ({
      loadPrinterRouting: () => ({
        printers: [],
        sectionPrinters: {},
        userPrinters: {},
        categorySections: {},
        itemSections: {},
      }),
      resolveKotPrinter: () => null,
      resolveDefaultPrinterByType: () => null,
      resolvePrinterForUser: () => null,
      resolveReceiptPrinter: () => null,
    }));

    const { resolveSilentSystemPrinterName } = await import("../branchPrintClient");
    const name = await resolveSilentSystemPrinterName({
      branchCode: "TEST",
      kind: "receipt",
      systemPrinterName: "EPSON TM-T82",
    });
    expect(name).toBe("EPSON TM-T82");
  });
});

describe("PosPage Order print regression", () => {
  it("Order place no longer passes forceDialog: true", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(__dirname, "../../pages/modules/PosPage.tsx"),
      "utf8",
    );
    // createOrderMutation onSuccess must call printKitchenKotsOnPay without forceDialog.
    expect(src).toMatch(/printKitchenKotsOnPay\(ticket\.orderRef \?\? orderRef\)/);
    expect(src).not.toMatch(/printKitchenKotsOnPay\([^)]*forceDialog:\s*true/);
  });
});
