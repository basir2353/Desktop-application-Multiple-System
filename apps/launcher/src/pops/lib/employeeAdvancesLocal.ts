/**
 * Local salary-advance ledger — used when Pay Out goes to an employee.
 * Survives offline; merges with server `/v1/hr/advances` when available.
 * Settled when a payroll run is created for that employee (local mark).
 */

export type LocalAdvance = {
  id: string;
  branchCode: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  amountPkr: number;
  reason: string;
  status: "open" | "settled";
  createdAt: string;
  clientRequestId?: string;
};

const STORAGE_KEY = "pops-employee-advances-v1";

function readAll(): LocalAdvance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAdvance[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: LocalAdvance[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function recordLocalEmployeeAdvance(input: {
  branchCode: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  amountPkr: number;
  reason: string;
  clientRequestId?: string;
}): LocalAdvance {
  const rows = readAll();
  if (input.clientRequestId) {
    const existing = rows.find((r) => r.clientRequestId === input.clientRequestId);
    if (existing) return existing;
  }
  const entry: LocalAdvance = {
    id: `ladv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    branchCode: input.branchCode.trim().toUpperCase(),
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeeCode: input.employeeCode,
    amountPkr: Math.max(0, Math.round(input.amountPkr)),
    reason: input.reason.trim(),
    status: "open",
    createdAt: new Date().toISOString(),
    clientRequestId: input.clientRequestId,
  };
  rows.unshift(entry);
  writeAll(rows);
  return entry;
}

export function listOpenLocalAdvances(branchCode: string): LocalAdvance[] {
  const code = branchCode.trim().toUpperCase();
  return readAll().filter((r) => r.branchCode === code && r.status === "open");
}

/** Sum of open advances per employee for a branch. */
export function openAdvanceTotalsByEmployee(branchCode: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of listOpenLocalAdvances(branchCode)) {
    map.set(row.employeeId, (map.get(row.employeeId) ?? 0) + row.amountPkr);
  }
  return map;
}

/** Mark open advances for these employees as settled (after payroll create). */
export function settleLocalAdvancesForEmployees(
  branchCode: string,
  employeeIds: string[],
): void {
  const code = branchCode.trim().toUpperCase();
  const ids = new Set(employeeIds);
  writeAll(
    readAll().map((r) =>
      r.branchCode === code && r.status === "open" && ids.has(r.employeeId)
        ? { ...r, status: "settled" as const }
        : r,
    ),
  );
}
