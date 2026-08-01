import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@platform/contracts";
import {
  createEmployee,
  fetchEmployees,
  syncEmployeesFromUsers,
  updateEmployee,
} from "../../../api/hr";
import { formatPkr, hrInputClass, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrFormPanel, HrLoading } from "./HrUi";

type EmployeeForm = {
  employeeCode: string;
  displayName: string;
  jobTitle: string;
  department: string;
  shiftLabel: string;
  baseSalaryPkr: string;
  joinDate: string;
  phone: string;
  email: string;
  employmentStatus: "active" | "on_leave" | "terminated";
};

const emptyForm = (): EmployeeForm => ({
  employeeCode: "",
  displayName: "",
  jobTitle: "",
  department: "",
  shiftLabel: "",
  baseSalaryPkr: "",
  joinDate: "",
  phone: "",
  email: "",
  employmentStatus: "active",
});

function formFromEmployee(e: Employee): EmployeeForm {
  return {
    employeeCode: e.employeeCode,
    displayName: e.displayName,
    jobTitle: e.jobTitle,
    department: e.department ?? "",
    shiftLabel: e.shiftLabel ?? "",
    baseSalaryPkr: String(e.baseSalaryPkr ?? 0),
    joinDate: e.joinDate ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    employmentStatus: e.employmentStatus,
  };
}

export function EmployeesPage(): JSX.Element {
  const { branch, canManage } = useHrAccess();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEmployees(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      setForm(emptyForm());
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateEmployee>[1] }) =>
      updateEmployee(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      setForm(emptyForm());
      setEditingId(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncEmployeesFromUsers(branch!.code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr"] }),
  });

  const terminateMutation = useMutation({
    mutationFn: (id: string) => updateEmployee(id, { employmentStatus: "terminated" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      if (editingId) {
        setEditingId(null);
        setForm(emptyForm());
      }
    },
  });

  if (employeesQuery.isLoading) return <HrLoading />;
  if (employeesQuery.isError) return <HrError message={(employeesQuery.error as Error).message} />;

  const employees = employeesQuery.data ?? [];
  const isEditing = Boolean(editingId);
  const saving = createMutation.isPending || updateMutation.isPending;

  function startEdit(emp: Employee): void {
    setEditingId(emp.id);
    setForm(formFromEmployee(emp));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit(): void {
    setEditingId(null);
    setForm(emptyForm());
  }

  function submitForm(): void {
    if (!branch?.code) return;
    const salary = Number(form.baseSalaryPkr);
    if (!Number.isFinite(salary) || salary < 0) return;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        input: {
          employeeCode: form.employeeCode.trim() || undefined,
          displayName: form.displayName.trim(),
          jobTitle: form.jobTitle.trim(),
          department: form.department.trim() || undefined,
          shiftLabel: form.shiftLabel.trim() || undefined,
          baseSalaryPkr: Math.round(salary),
          joinDate: form.joinDate || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          employmentStatus: form.employmentStatus,
        },
      });
      return;
    }

    createMutation.mutate({
      branchCode: branch.code,
      employeeCode: form.employeeCode.trim(),
      displayName: form.displayName.trim(),
      jobTitle: form.jobTitle.trim(),
      department: form.department.trim() || undefined,
      shiftLabel: form.shiftLabel.trim() || undefined,
      baseSalaryPkr: Math.round(salary),
      joinDate: form.joinDate || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
    });
  }

  const formDisabled =
    saving ||
    !form.employeeCode.trim() ||
    !form.displayName.trim() ||
    !form.jobTitle.trim() ||
    form.baseSalaryPkr === "" ||
    !branch?.code;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        subtitle="Staff records linked to branch users. Sync from Users & access or add manually. Edit any row to update salary and details."
      />

      {canManage ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={syncMutation.isPending || !branch?.code}
              onClick={() => syncMutation.mutate()}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-indigo-500/40 hover:text-white disabled:opacity-50"
            >
              {syncMutation.isPending ? "Syncing…" : "Sync from users"}
            </button>
            {syncMutation.isSuccess ? (
              <span className="text-[11px] text-slate-500">
                Synced employees start at salary Rs 0 — edit each record to set the correct salary.
              </span>
            ) : null}
          </div>

          <HrFormPanel
            title={isEditing ? "Edit employee" : "Add employee"}
            submitLabel={isEditing ? (saving ? "Saving…" : "Save changes") : "Create employee"}
            disabled={formDisabled}
            onSubmit={submitForm}
            secondaryLabel={isEditing ? "Cancel" : undefined}
            onSecondary={isEditing ? cancelEdit : undefined}
          >
            <input
              className={hrInputClass}
              placeholder="Employee code (E102)"
              value={form.employeeCode}
              onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Full name"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Job title"
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Shift (2pm–10pm)"
              value={form.shiftLabel}
              onChange={(e) => setForm((f) => ({ ...f, shiftLabel: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Base salary (PKR)"
              type="number"
              min={0}
              step={1}
              value={form.baseSalaryPkr}
              onChange={(e) => setForm((f) => ({ ...f, baseSalaryPkr: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Date of joining"
              type="date"
              value={form.joinDate}
              onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className={hrInputClass}
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            {isEditing ? (
              <select
                className={hrInputClass}
                value={form.employmentStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    employmentStatus: e.target.value as EmployeeForm["employmentStatus"],
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="on_leave">On leave</option>
                <option value="terminated">Terminated</option>
              </select>
            ) : null}
          </HrFormPanel>
          {(createMutation.isError || updateMutation.isError) && (
            <HrError
              message={
                ((createMutation.error || updateMutation.error) as Error | null)?.message ??
                "Save failed"
              }
            />
          )}
        </>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "employeeCode", header: "ID" },
            { key: "displayName", header: "Name" },
            { key: "jobTitle", header: "Role" },
            { key: "shiftLabel", header: "Shift", render: (r) => String(r.shiftLabel ?? "—") },
            { key: "baseSalaryPkr", header: "Salary", render: (r) => formatPkr(Number(r.baseSalaryPkr)) },
            { key: "joinDate", header: "Joined", render: (r) => String(r.joinDate ?? "—") },
            {
              key: "employmentStatus",
              header: "Status",
              render: (r) => (
                <Badge
                  tone={
                    r.employmentStatus === "active"
                      ? "success"
                      : r.employmentStatus === "on_leave"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {String(r.employmentStatus)}
                </Badge>
              ),
            },
            {
              key: "userId",
              header: "User link",
              render: (r) =>
                r.userId ? (
                  <span className="text-xs text-emerald-400">Linked</span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                ),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      onClick={() => startEdit(r as unknown as Employee)}
                    >
                      {editingId === r.id ? "Editing…" : "Edit"}
                    </button>
                    {r.employmentStatus === "active" ? (
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (
                            !confirm(
                              `Terminate employee "${String(r.displayName)}"?\n\nTheir record will be marked as terminated.`,
                            )
                          ) {
                            return;
                          }
                          terminateMutation.mutate(String(r.id));
                        }}
                      >
                        Terminate
                      </button>
                    ) : null}
                  </div>
                ) : null,
            },
          ]}
          rows={employees as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
