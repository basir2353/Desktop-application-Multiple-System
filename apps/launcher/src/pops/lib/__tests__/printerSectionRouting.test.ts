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

describe("Option 40: multi-section KOT fan-out", () => {
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

  it("groups food and drinks onto separate sections", async () => {
    const routing = await import("../printerRouting");
    routing.setCategorySections("BR", "cat-food", ["kitchen"]);
    routing.setCategorySections("BR", "cat-drinks", ["bar"]);

    const groups = routing.groupCartLinesBySection(
      "BR",
      [
        {
          key: "1",
          item: { id: "m1", categoryId: "cat-food", name: "Biryani" } as never,
          variant: null,
          qty: 1,
          unitPrice: 500,
          lineLabel: "Biryani",
          sortOrder: 1,
        },
        {
          key: "2",
          item: { id: "m2", categoryId: "cat-drinks", name: "Coke" } as never,
          variant: null,
          qty: 2,
          unitPrice: 100,
          lineLabel: "Coke",
          sortOrder: 2,
        },
      ],
      new Set(["kitchen", "bar"]),
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.sectionId).sort()).toEqual(["bar", "kitchen"]);
    expect(groups.find((g) => g.sectionId === "kitchen")?.lines).toHaveLength(1);
    expect(groups.find((g) => g.sectionId === "bar")?.lines).toHaveLength(1);
  });

  it("coalesce keeps Kitchen and Bar as separate jobs", async () => {
    const routing = await import("../printerRouting");
    const parts = routing.coalesceKotFanoutByPrinter([
      {
        sectionId: "kitchen",
        lines: ["Biryani"],
        systemPrinterName: "EPSON Kitchen",
        label: "Kitchen",
      },
      {
        sectionId: "bar",
        lines: ["Coke"],
        systemPrinterName: "EPSON Bar",
        label: "Bar",
      },
      {
        sectionId: "grill",
        lines: ["Tikka"],
        systemPrinterName: "EPSON Kitchen",
        label: "Grill",
      },
    ]);
    expect(parts).toHaveLength(2);
    const kitchenJob = parts.find((p) => p.systemPrinterName === "EPSON Kitchen");
    expect(kitchenJob?.lines).toEqual(["Biryani", "Tikka"]);
    expect(kitchenJob?.label).toContain("Kitchen");
    expect(parts.find((p) => p.sectionId === "bar")?.lines).toEqual(["Coke"]);
  });
});
