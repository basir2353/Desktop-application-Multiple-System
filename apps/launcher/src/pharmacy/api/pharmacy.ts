import {
  medicineSchema,
  medicineAlternativeSchema,
  medicineBatchSchema,
  pharmacyControlledDrugLogSchema,
  pharmacyDashboardSchema,
  pharmacyDoctorSchema,
  pharmacyExpiredProductsReportSchema,
  pharmacyKhataEntrySchema,
  pharmacyKhataStatementSchema,
  pharmacyPatientSchema,
  pharmacyProfitLossSchema,
  pharmacyPurchaseLineSchema,
  pharmacyRefillReminderSchema,
  pharmacySaleSchema,
  pharmacySalesOfMonthSchema,
  pharmacySalesStatementSchema,
  pharmacyShiftSchema,
  pharmacySupplierPaymentSchema,
  pharmacyTaxComplianceSchema,
  pharmacyReorderSuggestionSchema,
  prescriptionSchema,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    // ignore
  }
  throw new Error(msg);
}

function parseArray<T>(schema: { parse: (v: unknown) => T }, json: unknown): T[] {
  if (!Array.isArray(json)) throw new Error("Invalid response");
  return json.map((row) => schema.parse(row));
}

function qs(branchCode: string): string {
  return new URLSearchParams({ branchCode }).toString();
}

export async function fetchPharmacyDashboard(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/dashboard?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load pharmacy dashboard");
  return pharmacyDashboardSchema.parse(await res.json());
}

export async function fetchPharmacyMedicines(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/medicines?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load medicines");
  return parseArray(medicineSchema, await res.json());
}

export async function createPharmacyMedicine(body: unknown) {
  const res = await authFetch("/v1/pharmacy/medicines", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create medicine");
  return medicineSchema.parse(await res.json());
}

export async function deletePharmacyMedicine(medicineId: string) {
  const res = await authFetch(`/v1/pharmacy/medicines/${medicineId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Failed to delete medicine");
}

export async function fetchPharmacyBatches(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/batches?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load batches");
  return parseArray(medicineBatchSchema, await res.json());
}

export async function fetchPharmacyPatients(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/patients?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load patients");
  return parseArray(pharmacyPatientSchema, await res.json());
}

export async function createPharmacyPatient(body: unknown) {
  const res = await authFetch("/v1/pharmacy/patients", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create patient");
  return pharmacyPatientSchema.parse(await res.json());
}

export async function fetchPharmacyDoctors(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/doctors?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load doctors");
  return parseArray(pharmacyDoctorSchema, await res.json());
}

export async function createPharmacyDoctor(body: unknown) {
  const res = await authFetch("/v1/pharmacy/doctors", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create doctor");
  return pharmacyDoctorSchema.parse(await res.json());
}

export async function fetchPharmacyPrescriptions(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/prescriptions?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load prescriptions");
  return parseArray(prescriptionSchema, await res.json());
}

export async function createPharmacyPrescription(body: unknown) {
  const res = await authFetch("/v1/pharmacy/prescriptions", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create prescription");
  return prescriptionSchema.parse(await res.json());
}

export async function verifyPharmacyPrescription(prescriptionId: string) {
  const res = await authFetch(`/v1/pharmacy/prescriptions/${prescriptionId}/verify`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Failed to verify prescription");
}

export async function dispensePharmacyPrescription(prescriptionId: string, branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/prescriptions/${prescriptionId}/dispense?${qs(branchCode)}`, {
    method: "POST",
  });
  if (!res.ok) await parseError(res, "Failed to dispense prescription");
}

export async function fetchPharmacySales(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/sales?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load sales");
  return parseArray(pharmacySaleSchema, await res.json());
}

export async function createPharmacySale(body: unknown) {
  const res = await authFetch("/v1/pharmacy/sales", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create sale");
  return pharmacySaleSchema.parse(await res.json());
}

export async function fetchPharmacyPurchaseStatement(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/reports/purchase-statement?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load purchase statement");
  return parseArray(pharmacyPurchaseLineSchema, await res.json());
}

export async function fetchPharmacySupplierPayments(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/reports/supplier-payments?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load supplier payments");
  return parseArray(pharmacySupplierPaymentSchema, await res.json());
}

export async function fetchPharmacySalesStatement(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/reports/sales-statement?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load sales statement");
  return parseArray(pharmacySalesStatementSchema, await res.json());
}

export async function fetchPharmacyProfitLoss(branchCode: string, from?: string, to?: string) {
  const params = new URLSearchParams({ branchCode });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/v1/pharmacy/reports/profit-loss?${params.toString()}`);
  if (!res.ok) await parseError(res, "Failed to load profit/loss");
  return pharmacyProfitLossSchema.parse(await res.json());
}

export async function fetchPharmacySalesOfMonth(branchCode: string, from?: string, to?: string) {
  const params = new URLSearchParams({ branchCode });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/v1/pharmacy/reports/sales-of-month?${params.toString()}`);
  if (!res.ok) await parseError(res, "Failed to load monthly sales");
  return pharmacySalesOfMonthSchema.parse(await res.json());
}

export async function fetchPharmacyExpiredProducts(branchCode: string, from?: string, to?: string) {
  const params = new URLSearchParams({ branchCode });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/v1/pharmacy/reports/expired-products?${params.toString()}`);
  if (!res.ok) await parseError(res, "Failed to load expired products");
  return pharmacyExpiredProductsReportSchema.parse(await res.json());
}

export async function fetchPharmacyMedicineBatches(branchCode: string, medicineId: string) {
  const res = await authFetch(`/v1/pharmacy/medicines/${medicineId}/batches?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load batches");
  return parseArray(medicineBatchSchema, await res.json());
}

export async function fetchPharmacyAlternatives(branchCode: string, medicineId: string) {
  const res = await authFetch(`/v1/pharmacy/medicines/${medicineId}/alternatives?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load alternatives");
  return parseArray(medicineAlternativeSchema, await res.json());
}

export async function lookupPharmacyBarcode(branchCode: string, barcode: string) {
  const res = await authFetch(`/v1/pharmacy/medicines/barcode/${encodeURIComponent(barcode)}?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Barcode not found");
  return medicineSchema.parse(await res.json());
}

export async function updatePharmacyPatient(patientId: string, body: unknown) {
  const res = await authFetch(`/v1/pharmacy/patients/${patientId}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to update patient");
  return pharmacyPatientSchema.parse(await res.json());
}

const khataStatementSchema = pharmacyKhataStatementSchema;

export async function fetchPharmacyKhataStatement(patientId: string) {
  const res = await authFetch(`/v1/pharmacy/patients/${patientId}/khata`);
  if (!res.ok) await parseError(res, "Failed to load khata statement");
  return khataStatementSchema.parse(await res.json());
}

export async function recordPharmacyKhataPayment(patientId: string, body: unknown) {
  const res = await authFetch(`/v1/pharmacy/patients/${patientId}/khata-payment`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, "Failed to record payment");
  return khataStatementSchema.parse(await res.json());
}

export async function fetchPharmacyShifts(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/shifts?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load shifts");
  return parseArray(pharmacyShiftSchema, await res.json());
}

export async function fetchPharmacyOpenShift(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/shifts/open?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load open shift");
  const json = await res.json();
  if (json === null) return null;
  return pharmacyShiftSchema.parse(json);
}

export async function openPharmacyShift(body: unknown) {
  const res = await authFetch("/v1/pharmacy/shifts/open", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to open shift");
  return pharmacyShiftSchema.parse(await res.json());
}

export async function closePharmacyShift(shiftId: string, body: unknown) {
  const res = await authFetch(`/v1/pharmacy/shifts/${shiftId}/close`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to close shift");
  return pharmacyShiftSchema.parse(await res.json());
}

export async function fetchPharmacyControlledDrugLogs(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/controlled-drugs?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load controlled drug logs");
  return parseArray(pharmacyControlledDrugLogSchema, await res.json());
}

export async function fetchPharmacyRefillReminders(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/refill-reminders?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load refill reminders");
  return parseArray(pharmacyRefillReminderSchema, await res.json());
}

export async function markPharmacyRefillReminderSent(reminderId: string) {
  const res = await authFetch(`/v1/pharmacy/refill-reminders/${reminderId}/sent`, { method: "POST" });
  if (!res.ok) await parseError(res, "Failed to mark reminder sent");
}

export async function fetchPharmacyTaxCompliance(branchCode: string, from?: string, to?: string) {
  const params = new URLSearchParams({ branchCode });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/v1/pharmacy/reports/tax-compliance?${params.toString()}`);
  if (!res.ok) await parseError(res, "Failed to load tax report");
  return pharmacyTaxComplianceSchema.parse(await res.json());
}

export async function fetchPharmacyReorderSuggestions(branchCode: string) {
  const res = await authFetch(`/v1/pharmacy/reports/reorder-suggestions?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load reorder suggestions");
  return parseArray(pharmacyReorderSuggestionSchema, await res.json());
}

export async function fetchPrescriptionAttachment(prescriptionId: string) {
  const res = await authFetch(`/v1/pharmacy/prescriptions/${prescriptionId}/attachment`);
  if (!res.ok) await parseError(res, "Failed to load attachment");
  return (await res.json()) as { name: string; dataUrl: string };
}
