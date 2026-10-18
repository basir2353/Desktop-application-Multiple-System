import { describe, expect, it } from "vitest";

/** Mirrors useNavigationHistory skip rules for POS ← Cash drawer. */
function shouldSkipBackTarget(currentPath: string | undefined, target: string): boolean {
  if (target === "/pops") return true;
  if (currentPath === "/pops/pos" && target.includes("/pos/cash-drawer")) return true;
  return false;
}

function collapseCashDrawerUnderPos(stack: string[], pathname: string): string[] {
  const idx = stack.length - 1;
  const current = stack[idx];
  if (pathname === "/pops/pos" && current?.includes("/pos/cash-drawer")) {
    const next = [...stack];
    next[idx] = pathname;
    return next;
  }
  return [...stack, pathname];
}

describe("POS Back navigation guards", () => {
  it("skips cash-drawer when leaving main POS", () => {
    expect(shouldSkipBackTarget("/pops/pos", "/pops/pos/cash-drawer")).toBe(true);
    expect(shouldSkipBackTarget("/pops/pos", "/pops/orders")).toBe(false);
    expect(shouldSkipBackTarget("/pops/orders", "/pops/pos/cash-drawer")).toBe(false);
  });

  it("collapses cash-drawer entry when landing on POS", () => {
    expect(collapseCashDrawerUnderPos(["/pops/home", "/pops/pos/cash-drawer"], "/pops/pos")).toEqual([
      "/pops/home",
      "/pops/pos",
    ]);
  });

  it("appends other routes normally", () => {
    expect(collapseCashDrawerUnderPos(["/pops/pos"], "/pops/orders")).toEqual([
      "/pops/pos",
      "/pops/orders",
    ]);
  });
});
