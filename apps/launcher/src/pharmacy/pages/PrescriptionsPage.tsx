import { PRESCRIPTION_STATUSES } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createPharmacyPrescription,
  dispensePharmacyPrescription,
  fetchPharmacyDoctors,
  fetchPharmacyMedicines,
  fetchPharmacyPatients,
  fetchPharmacyPrescriptions,
  fetchPrescriptionAttachment,
  matchPharmacyMedicines,
  verifyPharmacyPrescription,
} from "../api/pharmacy";
import { useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import {
  PharmacyField,
  PharmacyFormSection,
  PharmacyInput,
  PharmacySelect,
  PharmacyStatCard,
} from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass } from "../../pops/lib/themeClasses";

function statusTone(s: string): "success" | "neutral" | "danger" | "warning" {
  if (s === "Dispensed") return "success";
  if (s === "Verified") return "neutral";
  if (s === "Cancelled") return "danger";
  return "warning";
}

export function PrescriptionsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [showForm, setShowForm] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [rxItems, setRxItems] = useState<{ medicineId: string; medicineName: string; dosage: string; quantity: number }[]>([]);
  const [dosage, setDosage] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onAttachmentFile(file: File | null): void {
    if (!file) {
      setAttachmentName(null);
      setAttachmentDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentName(file.name);
      setAttachmentDataUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  async function viewAttachment(prescriptionId: string): Promise<void> {
    try {
      const att = await fetchPrescriptionAttachment(prescriptionId);
      window.open(att.dataUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const rxQuery = useQuery({
    queryKey: ["pharmacy", "prescriptions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPrescriptions(branch!.code),
  });
  const patientsQuery = useQuery({
    queryKey: ["pharmacy", "patients", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPatients(branch!.code),
  });
  const doctorsQuery = useQuery({
    queryKey: ["pharmacy", "doctors", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDoctors(branch!.code),
  });
  const medicinesQuery = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });

  const matchQuery = useQuery({
    queryKey: ["pharmacy", "medicine-match", branch?.code, medicineSearch],
    enabled: Boolean(branch?.code) && medicineSearch.trim().length >= 2,
    queryFn: () => matchPharmacyMedicines(branch!.code, medicineSearch.trim()),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const items =
        rxItems.length > 0
          ? rxItems.map((i) => ({ medicineId: i.medicineId, dosage: i.dosage || undefined, quantity: i.quantity }))
          : [{ medicineId, dosage: dosage.trim() || undefined, quantity: Number(quantity) || 1 }];
      return createPharmacyPrescription({
        branchCode: branch!.code,
        patientId: patientId || undefined,
        doctorId: doctorId || undefined,
        notes: notes.trim() || undefined,
        attachmentName: attachmentName ?? undefined,
        attachmentDataUrl: attachmentDataUrl ?? undefined,
        items,
      });
    },
    onSuccess: () => {
      invalidate();
      setMedicineId("");
      setMedicineSearch("");
      setRxItems([]);
      setDosage("");
      setQuantity("1");
      setNotes("");
      setAttachmentName(null);
      setAttachmentDataUrl(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function addRxItem(id: string, name: string): void {
    setRxItems((prev) => {
      if (prev.some((i) => i.medicineId === id)) return prev;
      return [...prev, { medicineId: id, medicineName: name, dosage: dosage.trim(), quantity: Number(quantity) || 1 }];
    });
    setMedicineId(id);
    setDosage("");
    setQuantity("1");
    setMedicineSearch("");
  }

  const verifyMutation = useMutation({
    mutationFn: verifyPharmacyPrescription,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const dispenseMutation = useMutation({
    mutationFn: (id: string) => dispensePharmacyPrescription(id, branch!.code),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const allPrescriptions = rxQuery.data ?? [];

  const stats = useMemo(() => {
    const pending = allPrescriptions.filter((r) => r.status === "Pending").length;
    const verified = allPrescriptions.filter((r) => r.status === "Verified").length;
    const dispensed = allPrescriptions.filter((r) => r.status === "Dispensed").length;
    return { total: allPrescriptions.length, pending, verified, dispensed };
  }, [allPrescriptions]);

  const prescriptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPrescriptions.filter((rx) => {
      if (statusFilter !== "all" && rx.status !== statusFilter) return false;
      if (!q) return true;
      return (
        rx.prescriptionNumber.toLowerCase().includes(q) ||
        (rx.patientName ?? "").toLowerCase().includes(q) ||
        (rx.doctorName ?? "").toLowerCase().includes(q) ||
        rx.items.some((i) => i.medicineName.toLowerCase().includes(q))
      );
    });
  }, [allPrescriptions, search, statusFilter]);

  if (rxQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading prescriptions…
      </div>
    );
  }

  if (rxQuery.isError) {
    return <div className={noticeErrorClass}>{(rxQuery.error as Error).message}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription management"
        subtitle="Upload or scan doctor prescriptions, verify medicines, and link to patient invoices."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {showForm ? "Hide new form" : "New prescription"}
          </button>
        }
      />

      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Total prescriptions" value={stats.total} />
        <PharmacyStatCard label="Pending verification" value={stats.pending} tone="warning" />
        <PharmacyStatCard label="Ready to dispense" value={stats.verified} tone="default" />
        <PharmacyStatCard label="Dispensed" value={stats.dispensed} tone="success" />
      </div>

      {showForm ? (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            if (!medicineId && rxItems.length === 0) return;
            createMutation.mutate();
          }}
        >
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Register prescription</h2>
            <p className="mt-1 text-sm text-slate-500">
              Link a patient and doctor, then add the medicine with dosage and quantity.
            </p>
          </div>

          <PharmacyFormSection title="Patient & doctor" description="Optional — helps track prescription history.">
            <PharmacyField label="Patient">
              <PharmacySelect value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Walk-in / not linked</option>
                {(patientsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </option>
                ))}
              </PharmacySelect>
            </PharmacyField>
            <PharmacyField label="Prescribing doctor">
              <PharmacySelect value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Not specified</option>
                {(doctorsQuery.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.specialization ? ` · ${d.specialization}` : ""}
                  </option>
                ))}
              </PharmacySelect>
            </PharmacyField>
          </PharmacyFormSection>

          <PharmacyFormSection title="Medicine matching" description="Search by name or salt — system suggests in-stock matches.">
            <PharmacyField label="Search medicine on prescription" hint="Type medicine name as written on Rx">
              <PharmacyInput
                placeholder="e.g. Panadol, Amoxicillin, Metformin…"
                value={medicineSearch}
                onChange={(e) => setMedicineSearch(e.target.value)}
              />
            </PharmacyField>
            {(matchQuery.data ?? []).length > 0 ? (
              <ul className="sm:col-span-2 space-y-1 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                {(matchQuery.data ?? []).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => addRxItem(m.id, m.name)}
                    >
                      {m.name}
                      {m.genericName ? ` (${m.genericName})` : ""} — stock {m.currentStock}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <PharmacyField label="Or select from catalog" required={rxItems.length === 0}>
              <PharmacySelect
                value={medicineId}
                onChange={(e) => {
                  setMedicineId(e.target.value);
                  const med = (medicinesQuery.data ?? []).find((m) => m.id === e.target.value);
                  if (med) addRxItem(med.id, med.name);
                }}
              >
                <option value="">Select medicine…</option>
                {(medicinesQuery.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — stock {m.currentStock}
                  </option>
                ))}
              </PharmacySelect>
            </PharmacyField>
            <PharmacyField label="Dosage" hint="e.g. 1 tablet twice daily">
              <PharmacyInput
                placeholder="e.g. 500mg — 1 tab morning & night"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </PharmacyField>
            <PharmacyField label="Quantity to dispense">
              <PharmacyInput
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </PharmacyField>
            {rxItems.length > 0 ? (
              <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">Matched medicines</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {rxItems.map((item) => (
                    <li key={item.medicineId} className="flex justify-between gap-2">
                      <span>
                        {item.medicineName} × {item.quantity}
                        {item.dosage ? ` — ${item.dosage}` : ""}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-500"
                        onClick={() => setRxItems((prev) => prev.filter((i) => i.medicineId !== item.medicineId))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <PharmacyField label="Notes">
              <PharmacyInput
                placeholder="Special instructions for pharmacist"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </PharmacyField>
          </PharmacyFormSection>

          <PharmacyFormSection title="Prescription attachment" description="Upload or scan the doctor's prescription (camera on mobile).">
            <PharmacyField label="Scan / upload image" hint="JPEG, PNG, or PDF">
              <input
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                onChange={(e) => onAttachmentFile(e.target.files?.[0] ?? null)}
              />
              {attachmentName ? <p className="mt-1 text-xs text-emerald-600">Attached: {attachmentName}</p> : null}
            </PharmacyField>
          </PharmacyFormSection>

          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="submit"
              disabled={(rxItems.length === 0 && !medicineId) || createMutation.isPending}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Save prescription"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPatientId("");
                setDoctorId("");
                setMedicineId("");
                setDosage("");
                setQuantity("1");
                setNotes("");
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Clear form
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Prescription queue</h2>
            <p className="text-xs text-slate-500">
              Showing {prescriptions.length} of {allPrescriptions.length} prescriptions
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <PharmacySelect
              className="sm:w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {PRESCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </PharmacySelect>
            <PharmacyInput
              className="sm:w-64"
              placeholder="Search Rx #, patient, doctor, medicine…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {prescriptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No prescriptions found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || statusFilter !== "all"
                ? "Try changing the search or status filter."
                : "Register a new prescription using the form above."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <article
                key={rx.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{rx.prescriptionNumber}</span>
                      <Badge tone={statusTone(rx.status)}>{rx.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span>Patient: {rx.patientName ?? "Walk-in"}</span>
                      <span>Doctor: {rx.doctorName ?? "—"}</span>
                      <span>
                        {new Date(rx.createdAt).toLocaleString("en-PK", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    {rx.notes ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Note: {rx.notes}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rx.hasAttachment ? (
                      <button
                        type="button"
                        onClick={() => void viewAttachment(rx.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        View attachment
                      </button>
                    ) : null}
                    {rx.status === "Pending" ? (
                      <button
                        type="button"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate(rx.id)}
                        className="rounded-lg border border-sky-500/50 px-3 py-1.5 text-xs font-medium text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                      >
                        Verify
                      </button>
                    ) : null}
                    {rx.status === "Verified" ? (
                        <button
                          type="button"
                          disabled={dispenseMutation.isPending}
                          onClick={() => dispenseMutation.mutate(rx.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Dispense & bill
                        </button>
                      ) : null}
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="pb-2 pr-3">Medicine</th>
                        <th className="pb-2 pr-3">Dosage</th>
                        <th className="pb-2 pr-3">Qty</th>
                        <th className="pb-2">Dispensed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {rx.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{item.medicineName}</td>
                          <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{item.dosage ?? "—"}</td>
                          <td className="py-2 pr-3 tabular-nums">{item.quantity}</td>
                          <td className="py-2 tabular-nums text-slate-600 dark:text-slate-300">
                            {item.dispensedQty}
                            {item.dispensedQty >= item.quantity ? (
                              <span className="ml-2 text-emerald-600 dark:text-emerald-400">Complete</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
