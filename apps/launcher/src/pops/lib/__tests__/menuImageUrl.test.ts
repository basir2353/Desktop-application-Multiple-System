import { describe, expect, it } from "vitest";
import {
  isEmbeddedMenuImage,
  isEphemeralUploadPath,
  resolveMenuImageUrl,
} from "../menuImageUrl";

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

describe("menu image persistence helpers", () => {
  it("detects embedded data-URL photos (survive updates)", () => {
    expect(isEmbeddedMenuImage("data:image/jpeg;base64,abc")).toBe(true);
    expect(isEmbeddedMenuImage("/uploads/menu/org/x.jpg")).toBe(false);
    expect(isEmbeddedMenuImage(null)).toBe(false);
  });

  it("detects ephemeral /uploads paths (break after deploy)", () => {
    expect(isEphemeralUploadPath("/uploads/menu/org/x.jpg")).toBe(true);
    expect(isEphemeralUploadPath("data:image/png;base64,xx")).toBe(false);
    expect(isEphemeralUploadPath("https://cdn.example/a.jpg")).toBe(false);
  });
});
