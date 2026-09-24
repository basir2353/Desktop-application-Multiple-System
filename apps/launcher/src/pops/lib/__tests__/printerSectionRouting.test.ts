import { beforeEach, describe, expect, it, vi } from "vitest";

describe("resolvePrimaryPrinterForSection — two printers", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const key of Object.keys(store)) delete store[key];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal("window", {
      dispatchEvent: () => true,
    });
  });

  it("prefers the user's assigned section printer over section primary", async () => {
    const routing = await import("../printerRouting");
    const a = routing.addPrinterProfile("BR", "Kitchen A", {
      printerType: "kitchen",
      systemPrinterName: "USB Printer A",
    });
    const b = routing.addPrinterProfile("BR", "Kitchen B", {
      printerType: "kitchen",
      systemPrinterName: "USB Printer B",
    });
    // Section primary is A; user is assigned B only.
    routing.setSectionPrinters("BR", "kitchen", [a.id, b.id]);
    routing.setUserPrinters("BR", "waiter-1", [b.id]);
    routing.setSectionUsers("BR", "kitchen", ["waiter-1"]);

    const picked = routing.resolvePrimaryPrinterForSection("BR", "kitchen", "waiter-1");
    expect(picked?.id).toBe(b.id);
    expect(picked?.systemPrinterName).toBe("USB Printer B");
  });

  it("setSectionPrimaryPrinter makes the chosen printer primary", async () => {
    const routing = await import("../printerRouting");
    const a = routing.addPrinterProfile("BR2", "Kitchen A", {
      printerType: "kitchen",
      systemPrinterName: "USB Printer A",
    });
    const b = routing.addPrinterProfile("BR2", "Kitchen B", {
      printerType: "kitchen",
      systemPrinterName: "USB Printer B",
    });
    routing.setSectionPrinters("BR2", "kitchen", [a.id, b.id]);
    routing.setSectionPrimaryPrinter("BR2", "kitchen", b.id);

    const state = routing.loadPrinterRouting("BR2");
    expect(state.sectionPrinters.kitchen[0]).toBe(b.id);
    const picked = routing.resolvePrimaryPrinterForSection("BR2", "kitchen", null);
    expect(picked?.id).toBe(b.id);
  });

  it("finds a kitchen printer assigned under a different branch-code case and user id case", async () => {
    const routing = await import("../printerRouting");
    const kitchen = routing.addPrinterProfile("main", "Kitchen", {
      printerType: "kitchen",
      systemPrinterName: "EPSON TM-T82",
    });
    routing.setUserPrinters("main", "Waiter-ABC", [kitchen.id]);

    const picked = routing.resolvePrinterForUser("MAIN", "waiter-abc", "kitchen");
    expect(picked?.systemPrinterName).toBe("EPSON TM-T82");
    expect(routing.loadPrinterRouting("Main").userPrinters["Waiter-ABC"]).toEqual([kitchen.id]);
  });
});
