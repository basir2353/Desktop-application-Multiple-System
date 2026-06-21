import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@platform/contracts";
import { createAttendance, fetchAttendance, fetchEmployees, updateAttendance } from "../../../api/hr";
import { hrInputClass, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrFormPanel, HrLoading } from "./HrUi";

export function AttendancePage(): JSX.Element {
  const { branch, canManage } = useHrAccess();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<"present" | "late" | "absent">("present");
  const [clockIn, setClockIn] = useState("09:00");

  const attendanceQuery = useQuery({
    queryKey: ["hr", "attendance", branch?.code, date],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAttendance(branch!.code, date),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEmployees(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createAttendance,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "present" | "late" | "absent" }) =>
      updateAttendance(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr"] }),
  });

  if (attendanceQuery.isLoading || employeesQuery.isLoading) return <HrLoading />;
  if (attendanceQuery.isError) return <HrError message={(attendanceQuery.error as Error).message} />;

  const records = attendanceQuery.data?.records ?? [];
  const employees = employeesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" subtitle="Daily clock-in records for branch staff." />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500">
          Date{" "}
          <input
            type="date"
            className={hrInputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {canManage ? (
        <HrFormPanel
          title="Mark attendance"
          submitLabel="Record"
          disabled={createMutation.isPending || !employeeId || !branch?.code}
          onSubmit={() => {
            if (!branch?.code) return;
            createMutation.mutate({
              branchCode: branch.code,
              employeeId,
              attendanceDate: date,
              status,
              clockIn,
            });
          }}
        >
          <select className={hrInputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee</option>
            {employees
              .filter((e: Employee) => e.employmentStatus === "active")
              .map((e: Employee) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} — {e.displayName}
                </option>
              ))}
          </select>
          <select className={hrInputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>
          <input className={hrInputClass} type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        </HrFormPanel>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "employeeCode", header: "ID" },
            { key: "employeeName", header: "Name" },
            { key: "jobTitle", header: "Role" },
            { key: "clockIn", header: "In", render: (r) => String(r.clockIn ?? "—") },
            { key: "clockOut", header: "Out", render: (r) => String(r.clockOut ?? "—") },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "present" ? "success" : r.status === "late" ? "warning" : "neutral"}>
                  {String(r.status)}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage ? (
                  <span className="flex gap-2">
                    {r.status !== "present" ? (
                      <button type="button" className="text-xs text-emerald-400" onClick={() => updateMutation.mutate({ id: String(r.id), status: "present" })}>
                        Mark present
                      </button>
                    ) : null}
                    {r.status !== "late" ? (
                      <button type="button" className="text-xs text-amber-400" onClick={() => updateMutation.mutate({ id: String(r.id), status: "late" })}>
                        Mark late
                      </button>
                    ) : null}
                  </span>
                ) : null,
            },
          ]}
          rows={records as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
