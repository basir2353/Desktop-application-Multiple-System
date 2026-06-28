import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { PharmacyKhataEntry, PharmacyControlledDrugLog, PharmacyShift } from "@platform/contracts";
import {
  closePharmacyShift,
  fetchPharmacyControlledDrugLogs,
  fetchPharmacyKhataStatement,
  fetchPharmacyOpenShift,
  fetchPharmacyPatients,
  fetchPharmacyRefillReminders,
  fetchPharmacyShifts,
  fetchPharmacyTaxCompliance,
  markPharmacyRefillReminderSent,
  openPharmacyShift,
  recordPharmacyKhataPayment,
} from "../api/pharmacy";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyField, PharmacyInput, PharmacySelect, PharmacyStatCard } from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass } from "../../pops/lib/themeClasses";

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function PharmacyKhataPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [patientId, setPatientId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const patientsQuery = useQuery({
    queryKey: ["pharmacy", "patients", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPatients(branch!.code),
  });

  const khataQuery = useQuery({
    queryKey: ["pharmacy", "khata", patientId],
    enabled: Boolean(patientId),
    queryFn: () => fetchPharmacyKhataStatement(patientId),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      recordPharmacyKhataPayment(patientId, {
        branchCode: branch!.code,
        amountPkr: Number(paymentAmount),
        notes: paymentNotes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setPaymentAmount("");
      setPaymentNotes("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const withOutstanding = useMemo(
    () => (patientsQuery.data ?? []).filter((p) => p.outstandingPkr > 0),
    [patientsQuery.data],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Khata & credit accounts"
        subtitle="Partial payments, outstanding balances, credit limits, and customer account statements."
      />
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <PharmacyStatCard label="Customers with balance" value={withOutstanding.length} tone="warning" />
        <PharmacyStatCard
          label="Total outstanding"
          value={formatPkr(withOutstanding.reduce((s, p) => s + p.outstandingPkr, 0))}
          tone="danger"
        />
        <PharmacyStatCard label="Registered customers" value={(patientsQuery.data ?? []).length} />
      </div>

      <PharmacyField label="Select customer">
        <PharmacySelect value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Choose customer…</option>
          {(patientsQuery.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — outstanding {formatPkr(p.outstandingPkr)}
            </option>
          ))}
        </PharmacySelect>
      </PharmacyField>

      {khataQuery.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <PharmacyStatCard label="Outstanding" value={formatPkr(khataQuery.data.outstandingPkr)} tone="warning" />
            <PharmacyStatCard label="Credit limit" value={formatPkr(khataQuery.data.creditLimitPkr)} />
            <PharmacyStatCard
              label="Due date"
              value={khataQuery.data.creditDueDate ?? "Not set"}
              tone={khataQuery.data.creditDueDate ? "default" : "warning"}
            />
          </div>

          <form
            className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            onSubmit={(e) => {
              e.preventDefault();
              paymentMutation.mutate();
            }}
          >
            <h2 className="text-sm font-semibold">Record partial payment</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <PharmacyInput
                type="number"
                min={1}
                placeholder="Amount (PKR)"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
              <PharmacyInput
                placeholder="Notes (optional)"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
              <button
                type="submit"
                disabled={!paymentAmount || paymentMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Post payment
              </button>
            </div>
          </form>

          <SimpleTable<PharmacyKhataEntry>
            rowKey={(r) => r.id}
            columns={[
              { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
              { key: "type", header: "Type", render: (r) => <Badge tone={r.type === "payment" ? "success" : "warning"}>{r.type}</Badge> },
              { key: "invoiceNumber", header: "Invoice", render: (r) => r.invoiceNumber ?? "—" },
              { key: "amountPkr", header: "Amount", render: (r) => formatPkr(Math.abs(r.amountPkr)) },
              { key: "balanceAfterPkr", header: "Balance", render: (r) => formatPkr(r.balanceAfterPkr) },
              { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
            ]}
            rows={khataQuery.data?.entries ?? []}
          />
        </>
      ) : null}
    </div>
  );
}

export function PharmacyShiftPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [cashierName, setCashierName] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openShiftQuery = useQuery({
    queryKey: ["pharmacy", "shift-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyOpenShift(branch!.code),
  });

  const shiftsQuery = useQuery({
    queryKey: ["pharmacy", "shifts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyShifts(branch!.code),
  });

  const openMutation = useMutation({
    mutationFn: () =>
      openPharmacyShift({
        branchCode: branch!.code,
        cashierName: cashierName.trim(),
        openingCashPkr: Number(openingCash) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closePharmacyShift(openShiftQuery.data!.id, { closingCashPkr: Number(closingCash) }),
    onSuccess: () => {
      invalidate();
      setClosingCash("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const openShift = openShiftQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shift management"
        subtitle="Opening/closing cash, sales totals, and cashier accountability at end of shift."
      />
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {openShift ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 dark:bg-emerald-950/20">
          <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Active shift — {openShift.cashierName}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <PharmacyStatCard label="Opening cash" value={formatPkr(openShift.openingCashPkr)} />
            <PharmacyStatCard label="Sales this shift" value={formatPkr(openShift.totalSalesPkr)} tone="success" />
            <PharmacyStatCard label="Transactions" value={openShift.transactionCount} />
            <PharmacyStatCard label="Opened" value={new Date(openShift.openedAt).toLocaleTimeString()} />
          </div>
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              closeMutation.mutate();
            }}
          >
            <PharmacyField label="Closing cash counted">
              <PharmacyInput
                type="number"
                min={0}
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                required
              />
            </PharmacyField>
            <button
              type="submit"
              disabled={!closingCash || closeMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Close shift & reconcile
            </button>
          </form>
        </div>
      ) : (
        <form
          className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
          onSubmit={(e) => {
            e.preventDefault();
            openMutation.mutate();
          }}
        >
          <h2 className="text-sm font-semibold">Open new shift</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <PharmacyInput placeholder="Cashier name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} required />
            <PharmacyInput type="number" min={0} placeholder="Opening cash" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            <button type="submit" disabled={!cashierName.trim() || openMutation.isPending} className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Start shift
            </button>
          </div>
        </form>
      )}

      <SimpleTable<PharmacyShift>
        rowKey={(r) => r.id}
        columns={[
          { key: "cashierName", header: "Cashier" },
          { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "open" ? "success" : "neutral"}>{r.status}</Badge> },
          { key: "totalSalesPkr", header: "Sales", render: (r) => formatPkr(r.totalSalesPkr) },
          { key: "transactionCount", header: "Txns" },
          { key: "cashDifferencePkr", header: "Cash diff.", render: (r) => (r.cashDifferencePkr != null ? formatPkr(r.cashDifferencePkr) : "—") },
          { key: "openedAt", header: "Opened", render: (r) => new Date(r.openedAt).toLocaleString() },
        ]}
        rows={shiftsQuery.data ?? []}
      />
    </div>
  );
}

export function PharmacyControlledDrugsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "controlled-drugs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyControlledDrugLogs(branch!.code),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Controlled substances"
        subtitle="Regulatory compliance logs — buyer info, prescriptions, and pharmacist approvals."
      />
      <SimpleTable<PharmacyControlledDrugLog>
        rowKey={(r) => r.id}
        columns={[
          { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
          { key: "medicineName", header: "Medicine" },
          { key: "qty", header: "Qty" },
          { key: "patientName", header: "Patient", render: (r) => r.patientName ?? "Walk-in" },
          { key: "prescriptionNumber", header: "Prescription", render: (r) => r.prescriptionNumber ?? "—" },
          { key: "approvedByName", header: "Approved by", render: (r) => r.approvedByName ?? "—" },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacyRefillRemindersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();

  const query = useQuery({
    queryKey: ["pharmacy", "refill-reminders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyRefillReminders(branch!.code),
  });

  const markSentMutation = useMutation({
    mutationFn: markPharmacyRefillReminderSent,
    onSuccess: () => invalidate(),
  });

  const pending = (query.data ?? []).filter((r) => r.status === "pending");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Refill reminders"
        subtitle="SMS, email, and WhatsApp reminders for chronic patients (diabetes, hypertension, asthma, etc.)."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <PharmacyStatCard label="Pending reminders" value={pending.length} tone="warning" />
        <PharmacyStatCard label="Sent" value={(query.data ?? []).filter((r) => r.status === "sent").length} tone="success" />
        <PharmacyStatCard label="Total tracked" value={(query.data ?? []).length} />
      </div>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "patientName", header: "Patient" },
          { key: "medicineName", header: "Medicine" },
          { key: "refillDueDate", header: "Due date" },
          { key: "channel", header: "Channel", render: (r) => r.channel.toUpperCase() },
          { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "sent" ? "success" : "warning"}>{r.status}</Badge> },
          {
            id: "action",
            key: "id",
            header: "",
            render: (r) =>
              r.status === "pending" ? (
                <button type="button" className="text-xs text-emerald-600 hover:underline" onClick={() => markSentMutation.mutate(r.id)}>
                  Mark sent
                </button>
              ) : null,
          },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacyTaxCompliancePage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(new Date().toISOString());
  const [appliedFrom, setAppliedFrom] = useState(startOfMonth());
  const [appliedTo, setAppliedTo] = useState(new Date().toISOString());

  const query = useQuery({
    queryKey: ["pharmacy", "tax-compliance", branch?.code, appliedFrom, appliedTo],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyTaxCompliance(branch!.code, appliedFrom, appliedTo),
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading tax report…</p>;
  if (query.isError) return <div className={noticeErrorClass}>{(query.error as Error).message}</div>;

  const report = query.data!;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tax & compliance"
        subtitle="FBR-compliant invoicing, GST/VAT summaries, and audit-ready financial exports."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyField label="From">
          <PharmacyInput type="datetime-local" value={from.slice(0, 16)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} />
        </PharmacyField>
        <PharmacyField label="To">
          <PharmacyInput type="datetime-local" value={to.slice(0, 16)} onChange={(e) => setTo(new Date(e.target.value).toISOString())} />
        </PharmacyField>
        <div className="flex items-end sm:col-span-2">
          <button
            type="button"
            onClick={() => {
              setAppliedFrom(from);
              setAppliedTo(to);
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Apply filter
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Gross sales" value={formatPkr(report.totalSales)} tone="success" />
        <PharmacyStatCard label="Tax collected" value={formatPkr(report.taxCollected)} />
        <PharmacyStatCard label="Taxable sales" value={formatPkr(report.taxableSales)} />
        <PharmacyStatCard label="Invoices" value={report.invoiceCount} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tax summary — {report.periodLabel}</h2>
          {report.fbrCompliant ? <Badge tone="success">FBR compliant</Badge> : <Badge tone="danger">Review required</Badge>}
        </div>
        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {report.summary.map((row) => (
              <tr key={row.label}>
                <td className="py-2 text-slate-600 dark:text-slate-400">{row.label}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatPkr(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
