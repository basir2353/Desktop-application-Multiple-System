import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createPharmacyDoctor, fetchPharmacyDoctors } from "../api/pharmacy";
import { pharmacyInputClass, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import type { PharmacyDoctor } from "@platform/contracts";

export function PharmacyDoctorsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [form, setForm] = useState({ name: "", specialization: "", clinic: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["pharmacy", "doctors", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDoctors(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPharmacyDoctor({
        branchCode: branch!.code,
        name: form.name.trim(),
        specialization: form.specialization.trim() || undefined,
        clinic: form.clinic.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ name: "", specialization: "", clinic: "", phone: "", email: "" });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading doctors…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <PageHeader title="Doctor database" subtitle="Doctor profiles, clinics, and prescription referral reports." />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <h2 className="text-sm font-semibold">Add doctor</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input className={pharmacyInputClass} placeholder="Doctor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Specialization" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Clinic" value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <button type="submit" disabled={!form.name.trim() || createMutation.isPending} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          Save doctor
        </button>
      </form>

      <SimpleTable<PharmacyDoctor>
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Doctor" },
          { key: "specialization", header: "Specialization", render: (r) => r.specialization ?? "—" },
          { key: "clinic", header: "Clinic", render: (r) => r.clinic ?? "—" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "prescriptionCount", header: "Prescriptions" },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}
