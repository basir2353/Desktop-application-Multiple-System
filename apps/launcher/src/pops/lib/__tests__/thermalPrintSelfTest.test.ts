import { beforeEach, describe, expect, it } from "vitest";
import {
  clampCustomPaperWidthMm,
  normalizeThermalPrintSettings,
  paperWidthMm,
  receiptRenderWidthPx,
  resolveThermalPaperSize,
  thermalContentWidthMm,
} from "../thermalPrintSettings";
import {
  defaultThermalForCompleteTest,
  runThermalPrintSelfTest,
} from "../thermalPrintSelfTest";

function mockLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    key: (index) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: localStorageMock,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    configurable: true,
  });
}

describe("thermal paper / custom roll width", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("maps presets to mm", () => {
    expect(paperWidthMm("58mm")).toBe(58);
    expect(paperWidthMm("80mm")).toBe(80);
    expect(paperWidthMm("100mm")).toBe(100);
  });

  it("applies and clamps custom roll width", () => {
    expect(paperWidthMm("custom", 72)).toBe(72);
    expect(paperWidthMm("custom", 40)).toBe(48);
    expect(paperWidthMm("custom", 200)).toBe(120);
    expect(clampCustomPaperWidthMm(95)).toBe(95);
  });

  it("thermal custom beats stale profile 80mm", () => {
    const thermal = normalizeThermalPrintSettings({
      defaultPaperSize: "custom",
      customPaperWidthMm: 72,
    });
    expect(resolveThermalPaperSize("80mm", thermal)).toBe("custom");
    expect(paperWidthMm(resolveThermalPaperSize("80mm", thermal), thermal.customPaperWidthMm)).toBe(
      72,
    );
  });

  it("profile custom still resolves when thermal is preset", () => {
    const thermal = normalizeThermalPrintSettings({
      defaultPaperSize: "80mm",
      customPaperWidthMm: 90,
    });
    expect(resolveThermalPaperSize("custom", thermal)).toBe("custom");
    expect(paperWidthMm("custom", thermal.customPaperWidthMm)).toBe(90);
  });

  it("content width respects margin up to 8mm", () => {
    const wide = thermalContentWidthMm("80mm", 3);
    const tighter = thermalContentWidthMm("80mm", 1);
    expect(wide).toBeLessThan(tighter);
    expect(wide).toBeGreaterThanOrEqual(40);
  });

  it("raster width grows with custom mm", () => {
    const w80 = receiptRenderWidthPx("custom", 80);
    const w100 = receiptRenderWidthPx("custom", 100);
    expect(w100).toBeGreaterThan(w80);
  });
});

describe("runThermalPrintSelfTest (complete)", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("passes complete checklist for custom 80mm columns+price", () => {
    const thermal = defaultThermalForCompleteTest();
    const result = runThermalPrintSelfTest({
      branchCode: "TEST",
      branchName: "Restaurant HQ",
      thermal,
      profilePaperSize: "80mm",
    });
    const failed = result.checks.filter((c) => !c.ok);
    expect(failed, failed.map((f) => `${f.id}: ${f.detail}`).join("\n")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.rollMm).toBe(80);
  });

  it("passes for custom 72mm and keeps custom over profile", () => {
    const thermal = normalizeThermalPrintSettings({
      ...defaultThermalForCompleteTest(),
      customPaperWidthMm: 72,
    });
    const result = runThermalPrintSelfTest({
      branchCode: "TEST",
      thermal,
      profilePaperSize: "80mm",
    });
    expect(result.checks.find((c) => c.id === "custom-mm")?.ok).toBe(true);
    expect(result.checks.find((c) => c.id === "custom-beats-profile")?.ok).toBe(true);
    expect(result.checks.find((c) => c.id === "html-page-size")?.ok).toBe(true);
    expect(result.rollMm).toBe(72);
  });

  it("stacks Card/Cash on 58mm narrow", () => {
    const thermal = normalizeThermalPrintSettings({
      defaultPaperSize: "58mm",
      receiptLayout: "clear",
      showUnitPrice: false,
    });
    const result = runThermalPrintSelfTest({
      branchCode: "TEST",
      thermal,
    });
    expect(result.checks.find((c) => c.id === "pay-compare-layout")?.ok).toBe(true);
    expect(result.checks.find((c) => c.id === "price-column")?.ok).toBe(true);
  });
});
