import {
  employeeAdvanceSummarySchema,
  employeeSchema,
  type Employee,
  type EmployeeAdvanceSummary,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchEmployees(branchCode: string): Promise<Employee[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/employees?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Employees failed: ${res.status}`);
  }
  return employeeSchema.array().parse(await res.json());
}

/** Salary remaining = base salary − open advances (RPF-style). */
export async function fetchEmployeeAdvances(
  branchCode: string,
  status?: "open" | "reserved" | "settled",
): Promise<EmployeeAdvanceSummary[]> {
  const params = new URLSearchParams({ branchCode });
  if (status) params.set("status", status);
  const res = await authFetch(`/v1/hr/advances?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Salary advances failed: ${res.status}`);
  }
  return employeeAdvanceSummarySchema.array().parse(await res.json());
}
