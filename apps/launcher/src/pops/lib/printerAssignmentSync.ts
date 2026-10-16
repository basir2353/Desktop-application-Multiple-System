import { authFetch } from "../../lib/authFetch";
import {
  applyRemoteUserAssignments,
  snapshotUserAssignments,
  type RemoteUserPrinterAssignment,
} from "./printerRouting";

const pushTimers = new Map<string, number>();

/** Upload this branch's user→printer map so mobile punch/print can use it. */
export function queuePushUserPrinterAssignments(branchCode: string): void {
  const code = branchCode.trim();
  if (!code) return;
  const prev = pushTimers.get(code);
  if (prev) window.clearTimeout(prev);
  pushTimers.set(
    code,
    window.setTimeout(() => {
      pushTimers.delete(code);
      void pushUserPrinterAssignments(code);
    }, 400),
  );
}

export async function pushUserPrinterAssignments(branchCode: string): Promise<void> {
  const code = branchCode.trim();
  if (!code) return;
  const assignments = snapshotUserAssignments(code);
  // Never wipe the branch cloud map with an empty PC (fresh install / 2nd terminal).
  if (assignments.length === 0) return;
  const res = await authFetch("/v1/printing/user-assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode: code, assignments }),
  });
  if (!res.ok) {
    console.warn("[printer-assign] save failed", res.status);
  }
}

/**
 * Load backend user→profile map into local routing before a mobile job is printed.
 * Does not overwrite this PC's Windows printer names (see applyRemoteUserAssignments).
 */
export async function pullUserPrinterAssignments(branchCode: string): Promise<void> {
  const code = branchCode.trim();
  if (!code) return;
  const res = await authFetch(
    `/v1/printing/user-assignments?branchCode=${encodeURIComponent(code)}`,
  );
  if (!res.ok) return;
  const rows = (await res.json()) as RemoteUserPrinterAssignment[];
  if (!Array.isArray(rows)) return;
  if (rows.length === 0 && snapshotUserAssignments(code).length > 0) return;
  applyRemoteUserAssignments(code, rows);
}
