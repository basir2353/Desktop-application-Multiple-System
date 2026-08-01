import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@platform/contracts";
import { createEmployee, fetchEmployees, syncEmployeesFromUsers, updateEmployee } from "../../../api/hr";
import { formatPkr, hrInputClass, useHrAccess } from "../../../hooks/useHr";
import { linkDangerClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrFormPanel, HrLoading } from "../hr/HrUi";

type EmployeeForm = {
  employeeCode: string;
  displayName: string;
  jobTitle: string;
  shiftLabel: string;
  baseSalaryPkr: string;
  joinDate: string;
  employmentStatus: "active" | "on_leave" | "terminated";
};

const emptyForm = (): EmployeeForm => ({
  employeeCode: "",
  displayName: "",
  jobTitle: "",
  shiftLabel: "",
  baseSalaryPkr: "",
  joinDate: "",
  employmentStatus: "active",
});

function formFromEmployee(e: Employee): EmployeeForm {
  return {
    employeeCode: e.employeeCode,
    displayName: e.displayName,
    jobTitle: e.jobTitle,
    shiftLabel: e.shiftLabel ?? "",
    baseSalaryPkr: String(e.baseSalaryPkr ?? 0),
    joinDate: e.joinDate ?? "",
    employmentStatus: e.employmentStatus,
  };
}

export function BillManagementEmployeesPanel(): JSX.Element {
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

  if (!branch?.code) {
    return <p className="text-sm text-slate-500">Select a branch to manage employees.</p>;
  }
  if (employeesQuery.isLoading) return <HrLoading />;
  if (employeesQuery.isError) return <HrError message={(employeesQuery.error as Error).message} />;

  const employees = employeesQuery.data ?? [];
  const isEditing = Boolean(editingId);
  const saving = createMutation.isPending || updateMutation.isPending;

  function startEdit(emp: Employee): void {
    setEditingId(emp.id);
    setForm(formFromEmployee(emp));
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
          shiftLabel: form.shiftLabel.trim() || undefined,
          baseSalaryPkr: Math.round(salary),
          joinDate: form.joinDate || undefined,
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
      shiftLabel: form.shiftLabel.trim() || undefined,
      baseSalaryPkr: Math.round(salary),
      joinDate: form.joinDate || undefined,
    });
  }

  function confirmTerminate(name: string, id: string): void {
    if (!confirm(`Terminate employee "${name}"?\n\nTheir record will be marked as terminated.`)) return;
    terminateMutation.mutate(id);
  }

  const formDisabled =
    saving ||
    !form.employeeCode.trim() ||
    !form.displayName.trim() ||
    !form.jobTitle.trim() ||
    form.baseSalaryPkr === "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Staff records for this branch. Sync from Users &amp; access or add employees manually. Use Edit to update salary and other details.
      </p>

      {canManage ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-indigo-500/40 hover:text-white disabled:opacity-50"
            >
              {syncMutation.isPending ? "Syncing…" : "Sync from users"}
            </button>
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
      ) : (
        <p className="text-xs text-slate-500">You need pops.hr.manage permission to add or edit employees.</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "employeeCode", header: "ID" },
            { key: "displayName", header: "Name" },
            { key: "jobTitle", header: "Role" },
            { key: "shiftLabel", header: "Shift", render: (r) => String(r.shiftLabel ?? "—") },
            { key: "baseSalaryPkr", header: "Salary", render: (r) => formatPkr(Number(r.baseSalaryPkr)) },
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
                        className={`text-xs ${linkDangerClass}`}
                        onClick={() => confirmTerminate(String(r.displayName), String(r.id))}
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
