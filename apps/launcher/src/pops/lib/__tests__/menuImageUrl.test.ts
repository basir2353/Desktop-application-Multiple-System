import { describe, expect, it } from "vitest";
import { resolveMenuImageUrl } from "../menuImageUrl";

describe("resolveMenuImageUrl", () => {
  it("returns null for empty values", () => {
    expect(resolveMenuImageUrl(null)).toBeNull();
    expect(resolveMenuImageUrl(undefined)).toBeNull();
    expect(resolveMenuImageUrl("")).toBeNull();
    expect(resolveMenuImageUrl("   ")).toBeNull();
  });

  it("passes through data URLs and absolute http(s) URLs", () => {
    const data = "data:image/jpeg;base64,/9j/4AAQ";
    expect(resolveMenuImageUrl(data)).toBe(data);
    expect(resolveMenuImageUrl("https://cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg");
    expect(resolveMenuImageUrl("http://127.0.0.1:3000/uploads/a.jpg")).toBe(
      "http://127.0.0.1:3000/uploads/a.jpg",
    );
  });

  it("prefixes relative upload paths with API base", () => {
    const resolved = resolveMenuImageUrl("/uploads/menu/org/x.jpg");
    expect(resolved).toMatch(/\/uploads\/menu\/org\/x\.jpg$/);
    expect(resolved?.startsWith("http")).toBe(true);
  });
});
