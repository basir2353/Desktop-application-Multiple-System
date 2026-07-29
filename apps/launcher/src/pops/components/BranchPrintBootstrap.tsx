import { useEffect } from "react";
import { usePopsStore } from "../../stores/popsStore";
import { isDesktopAppRuntime } from "../lib/systemPrinters";

/**
 * When a branch is selected in the desktop EXE, auto-start the Branch Print Server,
 * local queue worker, and live/cloud job poller (if settings.enabled).
 */
export function BranchPrintBootstrap(): null {
  const branch = usePopsStore((s) => s.branch);

  useEffect(() => {
    if (!branch?.code || !isDesktopAppRuntime()) return;
    let cancelled = false;
    void (async () => {
      try {
        const { ensureBranchPrintRuntime } = await import("../lib/branchPrintClient");
        if (cancelled) return;
        await ensureBranchPrintRuntime(branch.code, branch.name);
      } catch (err) {
        console.warn("[branch-print] bootstrap failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branch?.code, branch?.name]);

  return null;
}
