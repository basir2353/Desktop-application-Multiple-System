import type { StaffFoodRecord } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createStaffFoodRecord,
  deleteStaffFoodRecord,
  fetchEmployees,
  fetchStaffFood,
} from "../api/hr";
import { formatPkr, hrInputClass, useHrAccess } from "../hooks/useHr";
import { accentValueClass, linkDangerClass, mutedClass, panelClass } from "../lib/themeClasses";
import { Badge } from "../ui/Badge";
import { SimpleTable } from "../ui/SimpleTable";
import { HrError, HrFormPanel, HrLoading } from "../pages/modules/hr/HrUi";

type ConsumerType = "staff" | "guest";

export function StaffFoodPanel(): JSX.Element {
  const { branch, canManage } = useHrAccess();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    consumerType: "staff" as ConsumerType,
    employeeId: "",
    personName: "",
    mealDate: new Date().toISOString().slice(0, 10),
    itemsOrdered: "",
    amountPkr: "",
    notes: "",
  });

  const staffFoodQuery = useQuery({
    queryKey: ["hr", "staff-food", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStaffFood(branch!.code),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code) && canManage,
    queryFn: () => fetchEmployees(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStaffFoodRecord({
        branchCode: branch!.code,
        consumerType: form.consumerType,
        employeeId: form.consumerType === "staff" ? form.employeeId : undefined,
        personName:
          form.consumerType === "guest"
            ? form.personName.trim()
            : employeesQuery.data?.find((e) => e.id === form.employeeId)?.displayName ?? "",
        mealDate: form.mealDate,
        itemsOrdered: form.itemsOrdered.trim(),
        amountPkr: Number(form.amountPkr) || 0,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr", "staff-food"] });
      setForm((current) => ({
        ...current,
        itemsOrdered: "",
        amountPkr: "",
        notes: "",
        personName: "",
      }));
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStaffFoodRecord,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr", "staff-food"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const activeEmployees = useMemo(
    () => (employeesQuery.data ?? []).filter((e) => e.employmentStatus === "active"),
    [employeesQuery.data],
  );

  if (staffFoodQuery.isLoading) return <HrLoading label="Loading staff food records…" />;
  if (staffFoodQuery.isError) {
    return <HrError message={(staffFoodQuery.error as Error).message} />;
  }

  const data = staffFoodQuery.data;
  const records = data?.records ?? [];

  return (
    <div className="space-y-4">
      {!canManage ? (
        <p className={`text-sm ${mutedClass}`}>Only admins and managers can add or remove records.</p>
      ) : null}

      {error ? <HrError message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={panelClass + " p-4"}>
          <div className={`text-xs ${mutedClass}`}>Today</div>
          <div className={`text-xl font-semibold ${accentValueClass}`}>
            {formatPkr(data?.todayTotalPkr ?? 0)}
          </div>
        </div>
        <div className={panelClass + " p-4"}>
          <div className={`text-xs ${mutedClass}`}>This month</div>
          <div className={`text-xl font-semibold ${accentValueClass}`}>
            {formatPkr(data?.monthTotalPkr ?? 0)}
          </div>
        </div>
        <div className={panelClass + " p-4"}>
          <div className={`text-xs ${mutedClass}`}>Records</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">
            {data?.recordCount ?? 0}
          </div>
        </div>
      </div>

      {canManage ? (
        <HrFormPanel
          title="Log staff food"
          submitLabel="Save record"
          disabled={
            createMutation.isPending ||
            !form.mealDate ||
            !form.itemsOrdered.trim() ||
            (form.consumerType === "staff" ? !form.employeeId : !form.personName.trim())
          }
          onSubmit={() => createMutation.mutate()}
        >
          <select
            className={hrInputClass}
            value={form.consumerType}
            onChange={(e) =>
              setForm({
                ...form,
                consumerType: e.target.value as ConsumerType,
                employeeId: "",
                personName: "",
              })
            }
          >
            <option value="staff">Staff meal</option>
            <option value="guest">Staff guest</option>
          </select>

          {form.consumerType === "staff" ? (
            <select
              className={hrInputClass}
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            >
              <option value="">Select staff member</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.displayName} · {employee.jobTitle}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={hrInputClass}
              placeholder="Guest name"
              value={form.personName}
              onChange={(e) => setForm({ ...form, personName: e.target.value })}
            />
          )}

          <input
            className={hrInputClass}
            type="date"
            value={form.mealDate}
            onChange={(e) => setForm({ ...form, mealDate: e.target.value })}
          />

          <input
            className={hrInputClass}
            type="number"
            min={0}
            placeholder="Amount (PKR)"
            value={form.amountPkr}
            onChange={(e) => setForm({ ...form, amountPkr: e.target.value })}
          />

          <input
            className={hrInputClass + " sm:col-span-2 lg:col-span-4"}
            placeholder="What was ordered (e.g. Chicken Karahi x1, Naan x2)"
            value={form.itemsOrdered}
            onChange={(e) => setForm({ ...form, itemsOrdered: e.target.value })}
          />

          <input
            className={hrInputClass + " sm:col-span-2 lg:col-span-4"}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </HrFormPanel>
      ) : null}

      <SimpleTable<StaffFoodRecord>
        rowKey={(r) => r.id}
        columns={[
          { key: "mealDate", header: "Date" },
          {
            key: "consumerType",
            header: "Type",
            render: (r) => (
              <Badge tone={r.consumerType === "staff" ? "info" : "neutral"}>
                {r.consumerType === "staff" ? "Staff" : "Guest"}
              </Badge>
            ),
          },
          {
            key: "personName",
            header: "Name",
            render: (r) => (
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">{r.personName}</div>
                {r.employeeCode ? (
                  <div className={`text-xs ${mutedClass}`}>
                    {r.employeeCode}
                    {r.jobTitle ? ` · ${r.jobTitle}` : ""}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: "itemsOrdered",
            header: "Order",
            render: (r) => <span className="max-w-xs truncate">{r.itemsOrdered}</span>,
          },
          {
            key: "amountPkr",
            header: "Amount",
            render: (r) => <span className={accentValueClass}>{formatPkr(r.amountPkr)}</span>,
          },
          {
            key: "notes",
            header: "Notes",
            render: (r) => r.notes ?? "—",
          },
          {
            key: "recordedBy",
            header: "Logged by",
            render: (r) => r.recordedBy ?? "—",
          },
          ...(canManage
            ? [
                {
                  id: "actions",
                  key: "id" as const,
                  header: "",
                  render: (r: StaffFoodRecord) => (
                    <button
                      type="button"
                      className={`text-xs ${linkDangerClass}`}
                      onClick={() => deleteMutation.mutate(r.id)}
                    >
                      Remove
                    </button>
                  ),
                },
              ]
            : []),
        ]}
        rows={records}
      />
    </div>
  );
}
