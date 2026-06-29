import { CHRONIC_DISEASES, type PharmacyPatient } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  createPharmacyPatient,
  fetchPharmacyPatientHistory,
  fetchPharmacyPatients,
  updatePharmacyPatient,
} from "../api/pharmacy";
import { formatPkr, pharmacyInputClass, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { Badge } from "../../pops/ui/Badge";

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
    chronicDiseases: [] as string[],
    creditLimitPkr: "",
    refillReminderEnabled: false,
    refillReminderChannel: "sms" as "sms" | "email" | "whatsapp",
  });
  const [editingPatient, setEditingPatient] = useState<PharmacyPatient | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["pharmacy", "patients", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPatients(branch!.code),
  });

  const historyQuery = useQuery({
    queryKey: ["pharmacy", "patient-history", historyId],
    enabled: Boolean(historyId),
    queryFn: () => fetchPharmacyPatientHistory(historyId!),
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
        chronicDiseases: form.chronicDiseases,
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
        chronicDiseases: [],
        creditLimitPkr: "",
        refillReminderEnabled: false,
        refillReminderChannel: "sms",
      });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePharmacyPatient(editingPatient!.id, {
        allergies: editingPatient!.allergies,
        medicalConditions: editingPatient!.medicalConditions,
        chronicDiseases: editingPatient!.chronicDiseases,
        refillReminderEnabled: editingPatient!.refillReminderEnabled,
        refillReminderChannel: editingPatient!.refillReminderChannel ?? undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditingPatient(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function toggleChronic(disease: string): void {
    setForm((prev) => ({
      ...prev,
      chronicDiseases: prev.chronicDiseases.includes(disease)
        ? prev.chronicDiseases.filter((d) => d !== disease)
        : [...prev.chronicDiseases, disease],
    }));
  }

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading customers…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patient & customer management"
        subtitle="Medical history, allergies, chronic disease records, and purchase tracking."
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
          <input className={pharmacyInputClass} type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Allergies (comma-separated)" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Medical conditions" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} />
          <input className={pharmacyInputClass} type="number" min={0} placeholder="Credit limit (PKR)" value={form.creditLimitPkr} onChange={(e) => setForm({ ...form, creditLimitPkr: e.target.value })} />
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Chronic diseases</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHRONIC_DISEASES.map((d) => (
              <label key={d} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
                <input type="checkbox" checked={form.chronicDiseases.includes(d)} onChange={() => toggleChronic(d)} />
                {d}
              </label>
            ))}
          </div>
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

      {editingPatient ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/20 p-4 dark:bg-emerald-950/20">
          <h2 className="text-sm font-semibold">Edit — {editingPatient.name}</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              className={pharmacyInputClass}
              placeholder="Allergies (comma-separated)"
              value={editingPatient.allergies.join(", ")}
              onChange={(e) =>
                setEditingPatient({
                  ...editingPatient,
                  allergies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
            <input
              className={pharmacyInputClass}
              placeholder="Medical conditions"
              value={editingPatient.medicalConditions.join(", ")}
              onChange={(e) =>
                setEditingPatient({
                  ...editingPatient,
                  medicalConditions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHRONIC_DISEASES.map((d) => (
              <label key={d} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={editingPatient.chronicDiseases.includes(d)}
                  onChange={() =>
                    setEditingPatient({
                      ...editingPatient,
                      chronicDiseases: editingPatient.chronicDiseases.includes(d)
                        ? editingPatient.chronicDiseases.filter((x) => x !== d)
                        : [...editingPatient.chronicDiseases, d],
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white"
              onClick={() => updateMutation.mutate()}
            >
              Save
            </button>
            <button type="button" className="text-xs text-slate-500" onClick={() => setEditingPatient(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {historyId && historyQuery.data ? (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">History — {historyQuery.data.patient.name}</h2>
            <button type="button" className="text-xs text-slate-500" onClick={() => setHistoryId(null)}>
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Allergies: {historyQuery.data.patient.allergies.join(", ") || "None"} · Conditions:{" "}
            {historyQuery.data.patient.medicalConditions.join(", ") || "None"}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {historyQuery.data.sales.map((sale) => (
              <li key={sale.saleId} className="rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <div className="font-medium">
                  {sale.invoiceNumber} — {formatPkr(sale.total)}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(sale.createdAt).toLocaleString()} · {sale.medicines.join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SimpleTable<PharmacyPatient>
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Customer" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "chronicDiseases", header: "Chronic", render: (r) => (r.chronicDiseases.length ? r.chronicDiseases.join(", ") : "—") },
          { key: "medicalConditions", header: "Conditions", render: (r) => (r.medicalConditions.length ? r.medicalConditions.join(", ") : "—") },
          { key: "allergies", header: "Allergies", render: (r) => (r.allergies.length ? <Badge tone="danger">{r.allergies.join(", ")}</Badge> : "—") },
          { key: "loyaltyPoints", header: "Points" },
          { key: "totalPurchases", header: "Purchases", render: (r) => formatPkr(r.totalPurchases) },
          { key: "outstandingPkr", header: "Khata balance", render: (r) => formatPkr(r.outstandingPkr) },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <button type="button" className="text-xs text-emerald-600" onClick={() => setHistoryId(r.id)}>
                  History
                </button>
                <button type="button" className="text-xs text-sky-600" onClick={() => setEditingPatient(r)}>
                  Edit
                </button>
              </div>
            ),
          },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}
