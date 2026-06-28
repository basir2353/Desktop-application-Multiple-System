import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createPharmacyPatient, fetchPharmacyPatients } from "../api/pharmacy";
import { formatPkr, pharmacyInputClass, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { Badge } from "../../pops/ui/Badge";
import type { PharmacyPatient } from "@platform/contracts";

export function PharmacyCustomersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    dateOfBirth: "",
    allergies: "",
    medicalConditions: "",
    chronicDiseases: "",
    creditLimitPkr: "",
    refillReminderEnabled: false,
    refillReminderChannel: "sms" as "sms" | "email" | "whatsapp",
  });
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["pharmacy", "patients", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPatients(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPharmacyPatient({
        branchCode: branch!.code,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        allergies: form.allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        medicalConditions: form.medicalConditions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        chronicDiseases: form.chronicDiseases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        creditLimitPkr: Number(form.creditLimitPkr) || undefined,
        refillReminderEnabled: form.refillReminderEnabled,
        refillReminderChannel: form.refillReminderEnabled ? form.refillReminderChannel : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        dateOfBirth: "",
        allergies: "",
        medicalConditions: "",
        chronicDiseases: "",
        creditLimitPkr: "",
        refillReminderEnabled: false,
        refillReminderChannel: "sms",
      });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading customers…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patient & customer management"
        subtitle="Profiles with allergies, chronic conditions, Khata credit limits, and purchase history."
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <h2 className="text-sm font-semibold">Add patient / customer</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input className={pharmacyInputClass} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={pharmacyInputClass} type="date" placeholder="Date of birth" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Allergies (comma-separated)" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Medical conditions" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Chronic diseases (diabetes, BP…)" value={form.chronicDiseases} onChange={(e) => setForm({ ...form, chronicDiseases: e.target.value })} />
          <input className={pharmacyInputClass} type="number" min={0} placeholder="Credit limit (PKR)" value={form.creditLimitPkr} onChange={(e) => setForm({ ...form, creditLimitPkr: e.target.value })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.refillReminderEnabled}
            onChange={(e) => setForm({ ...form, refillReminderEnabled: e.target.checked })}
          />
          Enable refill reminders (SMS / email / WhatsApp)
        </label>
        <button type="submit" disabled={!form.name.trim() || createMutation.isPending} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          Save customer
        </button>
      </form>

      <SimpleTable<PharmacyPatient>
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Customer" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "chronicDiseases", header: "Chronic", render: (r) => (r.chronicDiseases.length ? r.chronicDiseases.join(", ") : "—") },
          { key: "allergies", header: "Allergies", render: (r) => (r.allergies.length ? <Badge tone="danger">{r.allergies.join(", ")}</Badge> : "—") },
          { key: "loyaltyPoints", header: "Points" },
          { key: "totalPurchases", header: "Purchases", render: (r) => formatPkr(r.totalPurchases) },
          { key: "outstandingPkr", header: "Khata balance", render: (r) => formatPkr(r.outstandingPkr) },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}
