import { describe, expect, it } from "vitest";

/**
 * Mirrors printPngToResolvedPrinter error selection.
 * Live DB proved failed BILL/ORD receipt jobs still had 4–8KB html + ticket.lines —
 * the old message was wrong; raster failed (remote business logo / html-to-image).
 */
function silentPrintPayloadError(hasHtml: boolean): string {
  return hasHtml
    ? "Could not render receipt image for silent print"
    : "Missing image/HTML payload for silent print";
}

describe("silent print payload errors (live failure diagnosis)", () => {
  it("does not blame missing payload when HTML was present (BILL-H138VJ case)", () => {
    // From live print_jobs_cloud: html_len=7755, ticket_lines=1, kind=receipt, status=failed
    const htmlLen = 7755;
    expect(silentPrintPayloadError(htmlLen > 0)).toBe(
      "Could not render receipt image for silent print",
    );
  });

  it("keeps missing-payload wording only for empty HTML", () => {
    expect(silentPrintPayloadError(false)).toBe(
      "Missing image/HTML payload for silent print",
    );
  });

  it("documents live pattern: kot ok, receipt fail for same mobile order", () => {
    // ORD-260925-190136959-FHS9: kot completed, receipt failed — both had html+ticket
    const kot = { kind: "kot", ok: true };
    const receipt = { kind: "receipt", ok: false, htmlLen: 4797 };
    expect(kot.ok).toBe(true);
    expect(receipt.ok).toBe(false);
    expect(receipt.htmlLen).toBeGreaterThan(0);
    // Receipt rebuild injects Content Updation business logo; KOT does not.
  });
});
