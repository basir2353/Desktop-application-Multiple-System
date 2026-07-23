import {
  attendanceRecordSchema,
  createAttendanceSchema,
  createEmployeeSchema,
  createHrPayrollRunSchema,
  createLeaveRequestSchema,
  createStaffFoodSchema,
  employeeSchema,
  hrDashboardSchema,
  hrPayrollRunSchema,
  leaveRequestSchema,
  salarySlipSchema,
  staffFoodListSchema,
  staffFoodRecordSchema,
  employeeAdvanceSummarySchema,
  updateAttendanceSchema,
  updateEmployeeSchema,
  updateLeaveRequestSchema,
  type CreateAttendance,
  type CreateEmployee,
  type CreateHrPayrollRun,
  type CreateLeaveRequest,
  type CreateStaffFood,
  type Employee,
  type EmployeeAdvanceSummary,
  type LeaveRequest,
  type SalarySlip,
  type StaffFoodList,
  type UpdateAttendance,
  type UpdateEmployee,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

export async function fetchHrDashboard(branchCode: string) {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/dashboard?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  return hrDashboardSchema.parse(await res.json());
}

export async function fetchEmployees(branchCode: string): Promise<Employee[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/employees?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { employees: unknown[] };
  return employeeSchema.array().parse(json.employees);
}

export async function createEmployee(input: CreateEmployee) {
  const body = createEmployeeSchema.parse(input);
  const res = await authFetch("/v1/hr/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return employeeSchema.parse(await res.json());
}

export async function updateEmployee(employeeId: string, input: UpdateEmployee) {
  const body = updateEmployeeSchema.parse(input);
  const res = await authFetch(`/v1/hr/employees/${employeeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return employeeSchema.parse(await res.json());
}

export async function syncEmployeesFromUsers(branchCode: string): Promise<Employee[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/employees/sync-from-users?${params}`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { employees: unknown[] };
  return employeeSchema.array().parse(json.employees);
}

export async function fetchAttendance(branchCode: string, date?: string) {
  const params = new URLSearchParams({ branchCode });
  if (date) params.set("date", date);
  const res = await authFetch(`/v1/hr/attendance?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { branchCode: string; date: string; records: unknown[] };
  return {
    branchCode: json.branchCode,
    date: json.date,
    records: attendanceRecordSchema.array().parse(json.records),
  };
}

export async function createAttendance(input: CreateAttendance) {
  const body = createAttendanceSchema.parse(input);
  const res = await authFetch("/v1/hr/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return attendanceRecordSchema.parse(await res.json());
}

export async function updateAttendance(attendanceId: string, input: UpdateAttendance) {
  const body = updateAttendanceSchema.parse(input);
  const res = await authFetch(`/v1/hr/attendance/${attendanceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return attendanceRecordSchema.parse(await res.json());
}

export async function fetchLeaveRequests(branchCode: string): Promise<LeaveRequest[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/leave?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { requests: unknown[] };
  return leaveRequestSchema.array().parse(json.requests);
}

export async function createLeaveRequest(input: CreateLeaveRequest) {
  const body = createLeaveRequestSchema.parse(input);
  const res = await authFetch("/v1/hr/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return leaveRequestSchema.parse(await res.json());
}

export async function reviewLeaveRequest(leaveId: string, status: "approved" | "rejected") {
  const body = updateLeaveRequestSchema.parse({ status });
  const res = await authFetch(`/v1/hr/leave/${leaveId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return leaveRequestSchema.parse(await res.json());
}

export async function deleteHrPayrollRun(payrollId: string): Promise<void> {
  const res = await authFetch(`/v1/hr/payroll/${payrollId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}

export async function fetchHrPayrollRuns(branchCode: string) {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/payroll?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { runs: unknown[] };
  return hrPayrollRunSchema.array().parse(json.runs);
}

export async function fetchHrPayrollRun(payrollId: string) {
  const res = await authFetch(`/v1/hr/payroll/${payrollId}`);
  if (!res.ok) throw new Error(await readError(res));
  return hrPayrollRunSchema.parse(await res.json());
}

export async function fetchEmployeeAdvances(
  branchCode: string,
  status?: "open" | "reserved" | "settled",
): Promise<EmployeeAdvanceSummary[]> {
  const params = new URLSearchParams({ branchCode });
  if (status) params.set("status", status);
  try {
    const res = await authFetch(`/v1/hr/advances?${params}`);
    // Older backends / missing migration: treat as empty so local ledger can fill in.
    if (res.status === 404 || res.status === 501) return [];
    if (!res.ok) throw new Error(await readError(res));
    return employeeAdvanceSummarySchema.array().parse(await res.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/404|not found|failed to fetch|network/i.test(msg)) return [];
    throw err;
  }
}

export async function createHrPayrollRun(input: CreateHrPayrollRun) {
  const { isLikelyOfflineError, newClientRequestId, queueOfflinePayrollRun } = await import(
    "../lib/offlineCashQueue"
  );
  const body = createHrPayrollRunSchema.parse({
    ...input,
    clientRequestId: input.clientRequestId ?? newClientRequestId("pay"),
  });
  try {
    const res = await authFetch("/v1/hr/payroll/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readError(res));
    return hrPayrollRunSchema.parse(await res.json());
  } catch (err) {
    if (!isLikelyOfflineError(err)) throw err;
    const queued = queueOfflinePayrollRun(body);
    return {
      id: queued.id,
      payrollRef: `OFFLINE-${queued.id.slice(-6).toUpperCase()}`,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      totalGross: body.employees.reduce((s, e) => s + (e.grossPkr ?? 0) + (e.overtimePkr ?? 0), 0),
      totalDeductions: body.employees.reduce((s, e) => s + (e.deductionsPkr ?? 0), 0),
      totalNet: 0,
      staffCount: body.employees.length,
      status: "draft" as const,
      createdBy: null,
      createdAt: queued.createdAt,
      lines: [],
    };
  }
}

export async function approveHrPayrollRun(payrollId: string) {
  const res = await authFetch(`/v1/hr/payroll/${payrollId}/approve`, { method: "PATCH" });
  if (!res.ok) throw new Error(await readError(res));
  return hrPayrollRunSchema.parse(await res.json());
}

export async function payHrPayrollRun(payrollId: string) {
  const res = await authFetch(`/v1/hr/payroll/${payrollId}/pay`, { method: "PATCH" });
  if (!res.ok) throw new Error(await readError(res));
  return hrPayrollRunSchema.parse(await res.json());
}

export async function fetchSalarySlips(branchCode: string, payrollRunId?: string): Promise<SalarySlip[]> {
  const params = new URLSearchParams({ branchCode });
  if (payrollRunId) params.set("payrollRunId", payrollRunId);
  const res = await authFetch(`/v1/hr/salary-slips?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { slips: unknown[] };
  return salarySlipSchema.array().parse(json.slips);
}

export async function fetchStaffFood(branchCode: string): Promise<StaffFoodList> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/hr/staff-food?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  return staffFoodListSchema.parse(await res.json());
}

export async function createStaffFoodRecord(input: CreateStaffFood) {
  const body = createStaffFoodSchema.parse(input);
  const res = await authFetch("/v1/hr/staff-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return staffFoodRecordSchema.parse(await res.json());
}

export async function deleteStaffFoodRecord(recordId: string) {
  const res = await authFetch(`/v1/hr/staff-food/${recordId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
  return { ok: true as const };
}

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  return err?.message ?? `Request failed: ${res.status}`;
}
