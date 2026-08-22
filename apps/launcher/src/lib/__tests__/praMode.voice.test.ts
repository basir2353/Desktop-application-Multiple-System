import { describe, expect, it } from "vitest";
import {
  canShowRpraButton,
  canShowRpraForBill,
  resolveAutoPraMode,
  praCloseIssueNotice,
} from "../../pops/lib/praIssueFlow";

describe("FPRA vs Real PRA mode routing", () => {
  it("Real Active → auto real, hide RPRA", () => {
    expect(resolveAutoPraMode({ praRealEnabled: true, praFakeEnabled: false })).toBe("real");
    expect(canShowRpraButton({ praRealEnabled: true, praFakeEnabled: false })).toBe(false);
  });

  it("FPRA Active → auto fake, show RPRA", () => {
    expect(resolveAutoPraMode({ praRealEnabled: false, praFakeEnabled: true })).toBe("fake");
    expect(canShowRpraButton({ praRealEnabled: false, praFakeEnabled: true })).toBe(true);
  });

  it("both flags → prefer Real, hide RPRA", () => {
    // UI/features normalize both-on to Real; resolveAutoPraMode also prefers real.
    expect(resolveAutoPraMode({ praRealEnabled: true, praFakeEnabled: true })).toBe("real");
    expect(canShowRpraButton({ praRealEnabled: true, praFakeEnabled: true })).toBe(false);
  });

  it("hides RPRA on bills that already have Real fiscal", () => {
    expect(
      canShowRpraForBill({
        praFakeEnabled: true,
        praRealEnabled: false,
        praMode: "real",
      }),
    ).toBe(false);
  });

  it("Close notices match mode voice", () => {
    expect(praCloseIssueNotice("real", "blocked")).toMatch(/Real PRA/i);
    expect(praCloseIssueNotice("fake", "missing")).toMatch(/FPRA/i);
    expect(praCloseIssueNotice("real", "missing")).toMatch(/Real PRA/i);
  });
});
