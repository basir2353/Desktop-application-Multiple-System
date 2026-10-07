import { describe, expect, it } from "vitest";
import {
  kotChangeReasonGraceExpired,
  parseKotBaselineAtMs,
} from "../kotLineDelta";

describe("kotChangeReasonGraceExpired", () => {
  it("does not require reason inside the grace window", () => {
    const now = Date.parse("2026-10-05T12:00:00.000Z");
    const placedAt = Date.parse("2026-10-05T11:59:00.000Z"); // 1 min ago
    expect(kotChangeReasonGraceExpired(placedAt, 2, now)).toBe(false);
  });

  it("requires reason after the grace window", () => {
    const now = Date.parse("2026-10-05T12:00:00.000Z");
    const placedAt = Date.parse("2026-10-05T11:57:00.000Z"); // 3 min ago
    expect(kotChangeReasonGraceExpired(placedAt, 2, now)).toBe(true);
  });

  it("with grace 0 requires reason immediately once baseline exists", () => {
    const now = Date.parse("2026-10-05T12:00:00.000Z");
    expect(kotChangeReasonGraceExpired(now, 0, now)).toBe(true);
  });

  it("with no baseline never requires reason", () => {
    expect(kotChangeReasonGraceExpired(null, 2)).toBe(false);
  });
});

describe("parseKotBaselineAtMs", () => {
  it("parses ISO timestamps", () => {
    expect(parseKotBaselineAtMs("2026-10-05T12:00:00.000Z")).toBe(
      Date.parse("2026-10-05T12:00:00.000Z"),
    );
  });
});
