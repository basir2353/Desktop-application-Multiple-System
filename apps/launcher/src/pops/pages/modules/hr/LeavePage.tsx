import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, LeaveRequest } from "@platform/contracts";
import {
  createLeaveRequest,
  fetchEmployees,
  fetchLeaveRequests,
  reviewLeaveRequest,
} from "../../../api/hr";
import { hrInputClass, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrFormPanel, HrLoading } from "./HrUi";

export function LeavePage(): JSX.Element {
  const { branch, canManage } = useHrAccess();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<"annual" | "sick" | "unpaid">("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const leaveQuery = useQuery({
    queryKey: ["hr", "leave", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchLeaveRequests(branch!.code),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEmployees(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      setReason("");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      reviewLeaveRequest(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr"] }),
  });

  if (leaveQuery.isLoading) return <HrLoading />;
  if (leaveQuery.isError) return <HrError message={(leaveQuery.error as Error).message} />;

  const requests = leaveQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const pending = requests.filter((r: LeaveRequest) => r.status === "pending");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leave management"
        subtitle={`${pending.length} pending request${pending.length === 1 ? "" : "s"}. Approve or reject from this screen.`}
      />

      <HrFormPanel
        title="Submit leave request"
        submitLabel="Submit"
        disabled={createMutation.isPending || !employeeId || !startDate || !endDate || !branch?.code}
        onSubmit={() => {
          if (!branch?.code) return;
          createMutation.mutate({
            branchCode: branch.code,
            employeeId,
            leaveType,
            startDate,
            endDate,
            reason: reason || undefined,
          });
        }}
      >
        <select className={hrInputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">Employee</option>
          {employees
            .filter((e: Employee) => e.employmentStatus === "active")
            .map((e: Employee) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
        </select>
        <select className={hrInputClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}>
          <option value="annual">Annual</option>
          <option value="sick">Sick</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <input className={hrInputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className={hrInputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <input className={`${hrInputClass} sm:col-span-2`} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </HrFormPanel>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "employeeName", header: "Employee" },
            { key: "leaveType", header: "Type" },
            { key: "startDate", header: "From" },
            { key: "endDate", header: "To" },
            { key: "reason", header: "Reason", render: (r) => String(r.reason ?? "—") },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
                  {String(r.status)}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage && r.status === "pending" ? (
                  <span className="flex gap-2">
                    <button type="button" className="text-xs text-emerald-400" onClick={() => reviewMutation.mutate({ id: String(r.id), status: "approved" })}>
                      Approve
                    </button>
                    <button type="button" className="text-xs text-red-400" onClick={() => reviewMutation.mutate({ id: String(r.id), status: "rejected" })}>
                      Reject
                    </button>
                  </span>
                ) : null,
            },
          ]}
          rows={requests as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
