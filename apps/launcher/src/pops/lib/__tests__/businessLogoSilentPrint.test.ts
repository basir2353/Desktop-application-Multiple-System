import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("resolveBusinessLogoDataUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          "09": {
            logoUrl: "https://example.test/logo.png",
            praLogoUrl: null,
            address: "",
            phone: "",
            taxId: "",
          },
        }),
      setItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("converts remote Content Updation logo to data URL for silent print", async () => {
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => bytes.buffer,
      })),
    );

    const { resolveBusinessLogoSrc, resolveBusinessLogoDataUrl } = await import(
      "../businessLogo"
    );
    expect(resolveBusinessLogoSrc("09")).toBe("https://example.test/logo.png");
    const dataUrl = await resolveBusinessLogoDataUrl("09");
    expect(dataUrl).toBe(`data:image/png;base64,${pngBase64}`);
  });

  it("returns null when remote logo cannot be fetched (caller omits img)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("CORS");
      }),
    );
    const { resolveBusinessLogoDataUrl } = await import("../businessLogo");
    expect(await resolveBusinessLogoDataUrl("09")).toBeNull();
  });
});
