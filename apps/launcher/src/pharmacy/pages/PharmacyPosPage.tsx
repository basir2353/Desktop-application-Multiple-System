import {
  computeLinePrice,
  formatMedicineLocation,
  formatStockLabel,
  saleQtyToTablets,
  saleUnitLabel,
  supportsStripSale,
  type Medicine,
  type MedicineAlternative,
  type MedicineBatch,
  type PharmacyPaymentLine,
  type PharmacySale,
  type PharmacySaleUnit,
} from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createPharmacySale,
  fetchPharmacyAlternatives,
  fetchPharmacyMedicineBatches,
  fetchPharmacyMedicines,
  fetchPharmacyOpenShift,
  fetchPharmacyPatients,
  fetchPharmacyPrescriptions,
  lookupPharmacyBarcode,
} from "../api/pharmacy";
import { MedicineWarningsPanel, PharmacyCheckoutModal } from "../components/PharmacyCheckoutModal";
import { printPharmacyInvoice } from "../lib/printPharmacyInvoice";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyField, PharmacyInput, PharmacySelect } from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

type CartLine = {
  medicine: Medicine;
  qty: number;
  saleUnit: PharmacySaleUnit;
  tabletsQty: number;
  lineTotal: number;
  batchId?: string;
  batchNumber?: string;
};

export function PharmacyPosPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [patientId, setPatientId] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<PharmacySale | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingMedicine, setPendingMedicine] = useState<Medicine | null>(null);
  const [batchOptions, setBatchOptions] = useState<MedicineBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [saleUnit, setSaleUnit] = useState<PharmacySaleUnit>("strip");
  const [saleQtyInput, setSaleQtyInput] = useState("1");
  const [alternatives, setAlternatives] = useState<MedicineAlternative[]>([]);

  const medicinesQuery = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });

  const patientsQuery = useQuery({
    queryKey: ["pharmacy", "patients", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPatients(branch!.code),
  });

  const prescriptionsQuery = useQuery({
    queryKey: ["pharmacy", "prescriptions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPrescriptions(branch!.code),
  });

  const shiftQuery = useQuery({
    queryKey: ["pharmacy", "shift-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyOpenShift(branch!.code),
  });

  const selectedPatient = useMemo(
    () => (patientsQuery.data ?? []).find((p) => p.id === patientId),
    [patientsQuery.data, patientId],
  );

  const linkablePrescriptions = useMemo(() => {
    const list = prescriptionsQuery.data ?? [];
    return list.filter(
      (rx) =>
        (rx.status === "Verified" || rx.status === "Pending") &&
        (!patientId || rx.patientId === patientId),
    );
  }, [prescriptionsQuery.data, patientId]);

  const saleMutation = useMutation({
    mutationFn: (payload: {
      paymentMethod: PharmacySale["paymentMethod"];
      payments: PharmacyPaymentLine[];
      controlledApproved: boolean;
    }) =>
      createPharmacySale({
        branchCode: branch!.code,
        patientId: patientId || undefined,
        prescriptionId: prescriptionId || undefined,
        shiftId: shiftQuery.data?.id,
        paymentMethod: payload.paymentMethod,
        payments: payload.payments,
        controlledApproved: payload.controlledApproved,
        discount: 0,
        lines: cart.map((c) => ({
          medicineId: c.medicine.id,
          qty: c.qty,
          saleUnit: c.saleUnit,
          batchId: c.batchId,
        })),
      }),
    onSuccess: (sale) => {
      invalidate();
      setCart([]);
      setSearch("");
      setPrescriptionId("");
      setCheckoutOpen(false);
      setLastSale(sale);
      setNotice(`Bill ${sale.invoiceNumber} saved — ${formatPkr(sale.total)}${sale.amountDue > 0 ? ` (${formatPkr(sale.amountDue)} on Khata)` : ""}`);
      setError(null);
      printPharmacyInvoice(branch?.name ?? "Pharmacy", branch?.code ?? "—", sale);
    },
    onError: (e: Error) => setError(e.message),
  });

  const inStock = useMemo(
    () => (medicinesQuery.data ?? []).filter((m) => m.currentStock > 0),
    [medicinesQuery.data],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inStock.slice(0, 12);
    return inStock
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          (m.genericName ?? "").toLowerCase().includes(q) ||
          (m.brandName ?? "").toLowerCase().includes(q) ||
          (m.barcode ?? "").includes(q),
      )
      .slice(0, 12);
  }, [inStock, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.lineTotal, 0);
  const tax = cart.reduce(
    (sum, line) => sum + Math.round((line.lineTotal * line.medicine.taxPct) / 100),
    0,
  );
  const total = subtotal + tax;
  const itemCount = cart.length;
  const hasControlled = cart.some((c) => c.medicine.isControlled);

  const pendingPreview = useMemo(() => {
    if (!pendingMedicine) return null;
    const qty = Math.max(1, Number(saleQtyInput) || 1);
    const tablets = saleQtyToTablets(pendingMedicine, saleUnit, qty);
    const lineTotal = computeLinePrice(pendingMedicine, saleUnit, qty);
    return { qty, tablets, lineTotal };
  }, [pendingMedicine, saleUnit, saleQtyInput]);

  async function openAddModal(medicine: Medicine): Promise<void> {
    const batches = await fetchPharmacyMedicineBatches(branch!.code, medicine.id);
    setPendingMedicine(medicine);
    setBatchOptions(batches);
    setSelectedBatchId(batches[0]?.id ?? "");
    setSaleUnit(supportsStripSale(medicine) ? "strip" : "piece");
    setSaleQtyInput(supportsStripSale(medicine) ? "1" : "1");
  }

  function confirmAddToCart(): void {
    if (!pendingMedicine || !pendingPreview) return;
    const batch = batchOptions.find((b) => b.id === selectedBatchId);
    const { qty, tablets, lineTotal } = pendingPreview;

    if (tablets > pendingMedicine.currentStock) {
      setError(`Only ${formatStockLabel(pendingMedicine)} available.`);
      return;
    }

    const lineKey = `${pendingMedicine.id}:${batch?.id ?? ""}:${saleUnit}`;
    setCart((prev) => {
      const existing = prev.find(
        (c) => `${c.medicine.id}:${c.batchId ?? ""}:${c.saleUnit}` === lineKey,
      );
      if (existing) {
        const newQty = existing.qty + qty;
        const newTablets = saleQtyToTablets(pendingMedicine, saleUnit, newQty);
        if (newTablets > pendingMedicine.currentStock) return prev;
        const newTotal = computeLinePrice(pendingMedicine, saleUnit, newQty);
        return prev.map((c) =>
          `${c.medicine.id}:${c.batchId ?? ""}:${c.saleUnit}` === lineKey
            ? { ...c, qty: newQty, tabletsQty: newTablets, lineTotal: newTotal }
            : c,
        );
      }
      return [
        ...prev,
        {
          medicine: pendingMedicine,
          qty,
          saleUnit,
          tabletsQty: tablets,
          lineTotal,
          batchId: batch?.id,
          batchNumber: batch?.batchNumber,
        },
      ];
    });
    setPendingMedicine(null);
    setBatchOptions([]);
    setSearch("");
    setError(null);
  }

  async function pickMedicine(medicine: Medicine): Promise<void> {
    if (medicine.currentStock <= 0) {
      const alts = await fetchPharmacyAlternatives(branch!.code, medicine.id);
      setAlternatives(alts);
      setError(`${medicine.name} is out of stock — salt/generic alternatives below.`);
      return;
    }
    setAlternatives([]);
    await openAddModal(medicine);
  }

  function removeLine(index: number): void {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  async function tryAddFromSearch(): Promise<void> {
    const q = search.trim();
    if (!q) return;
    try {
      const byBarcode = await lookupPharmacyBarcode(branch!.code, q);
      await pickMedicine(byBarcode);
      return;
    } catch {
      // fall through
    }
    const exact = inStock.find((m) => m.barcode === q || m.sku.toLowerCase() === q.toLowerCase());
    if (exact) {
      await pickMedicine(exact);
      return;
    }
    if (matches[0]) await pickMedicine(matches[0]);
  }

  if (medicinesQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading medicines…</p>;
  }

  if (medicinesQuery.isError) {
    return <div className={noticeErrorClass}>{(medicinesQuery.error as Error).message}</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & sales (POS)"
        subtitle="Barcode scan · batch/expiry · strip or loose tablets · prescription link · rack location · safety alerts."
        actions={
          shiftQuery.data ? (
            <Badge tone="success">Shift open — {shiftQuery.data.cashierName}</Badge>
          ) : (
            <Badge tone="warning">No active shift</Badge>
          )
        }
      />

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {pendingMedicine ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:bg-emerald-950/20">
          <h2 className="text-sm font-semibold">Add to bill — {pendingMedicine.name}</h2>
          {formatMedicineLocation(pendingMedicine) ? (
            <p className="mt-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Pick from: {formatMedicineLocation(pendingMedicine)}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            Stock: {formatStockLabel(pendingMedicine)}
            {pendingMedicine.genericName ? ` · Salt: ${pendingMedicine.genericName}` : ""}
          </p>

          {batchOptions.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Select batch</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {batchOptions.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBatchId(b.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedBatchId === b.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="font-medium">{b.batchNumber}</div>
                    <div className="text-xs text-slate-500">Exp: {b.expiryDate} · {b.quantity} units</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {supportsStripSale(pendingMedicine) ? (
              <PharmacyField label="Sell as">
                <PharmacySelect value={saleUnit} onChange={(e) => setSaleUnit(e.target.value as PharmacySaleUnit)}>
                  <option value="tablet">Loose tablet</option>
                  <option value="strip">Strip</option>
                  <option value="box">Full box</option>
                </PharmacySelect>
              </PharmacyField>
            ) : (
              <PharmacyField label="Quantity">
                <PharmacyInput type="number" min={1} value={saleQtyInput} onChange={(e) => setSaleQtyInput(e.target.value)} />
              </PharmacyField>
            )}
            {supportsStripSale(pendingMedicine) ? (
              <PharmacyField label="Quantity">
                <PharmacyInput type="number" min={1} value={saleQtyInput} onChange={(e) => setSaleQtyInput(e.target.value)} />
              </PharmacyField>
            ) : null}
            <PharmacyField label="Line total">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                {pendingPreview ? formatPkr(pendingPreview.lineTotal) : "—"}
                {pendingPreview ? (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({saleUnitLabel(saleUnit, pendingPreview.qty)}, {pendingPreview.tablets} tablets)
                  </span>
                ) : null}
              </div>
            </PharmacyField>
          </div>

          <MedicineWarningsPanel medicine={pendingMedicine} />

          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={confirmAddToCart}>
              Add to bill
            </button>
            <button type="button" className="text-sm text-slate-500" onClick={() => setPendingMedicine(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {alternatives.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Generic / salt alternatives</h2>
          <ul className="mt-2 space-y-1">
            {alternatives.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                  onClick={() => {
                    const full = medicinesQuery.data?.find((x) => x.id === m.id);
                    if (full) void pickMedicine(full);
                  }}
                >
                  {m.name} — {formatPkr(m.sellingPrice)} · {m.genericName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <PharmacyField label="Scan barcode or search" hint="Brand, salt/generic name, SKU — Enter to add">
              <PharmacyInput
                placeholder="Scan barcode or type medicine / salt name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void tryAddFromSearch();
                  }
                }}
                autoFocus
              />
            </PharmacyField>

            <ul className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
              {matches.map((m) => {
                const loc = formatMedicineLocation(m);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => void pickMedicine(m)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-slate-700 dark:hover:border-emerald-600"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{m.name}</span>
                          {m.isControlled ? <Badge tone="danger">Controlled</Badge> : null}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {m.genericName ?? m.sku} · {formatStockLabel(m)}
                          {loc ? ` · ${loc}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-600">
                        {supportsStripSale(m) ? `${formatPkr(m.sellingPrice)}/strip` : formatPkr(m.sellingPrice)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <h2 className="text-base font-semibold">Current bill · {itemCount} line{itemCount === 1 ? "" : "s"}</h2>

            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Scan medicines to start the invoice.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {cart.map((line, index) => (
                  <li key={`${line.medicine.id}-${index}`} className="py-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{line.medicine.name}</div>
                        <div className="text-xs text-slate-500">
                          {saleUnitLabel(line.saleUnit, line.qty)}
                          {line.batchNumber ? ` · Batch ${line.batchNumber}` : ""}
                          {formatMedicineLocation(line.medicine) ? ` · ${formatMedicineLocation(line.medicine)}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatPkr(line.lineTotal)}</div>
                        <button type="button" className="text-xs text-red-500" onClick={() => removeLine(index)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <MedicineWarningsPanel medicine={line.medicine} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="flex justify-between text-2xl font-bold">
                <span>Total</span>
                <span>{formatPkr(total)}</span>
              </div>

              <PharmacyField label="Customer">
                <PharmacySelect value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Walk-in</option>
                  {(patientsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </PharmacySelect>
              </PharmacyField>

              <PharmacyField label="Link prescription (optional)">
                <PharmacySelect value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)}>
                  <option value="">No prescription</option>
                  {linkablePrescriptions.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      {rx.prescriptionNumber} — {rx.patientName ?? "Patient"} ({rx.status})
                      {rx.hasAttachment ? " 📎" : ""}
                    </option>
                  ))}
                </PharmacySelect>
              </PharmacyField>

              {selectedPatient && selectedPatient.allergies.length > 0 ? (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/30">
                  <strong>Allergy alert:</strong> {selectedPatient.allergies.join(", ")}
                </div>
              ) : null}

              <button
                type="button"
                disabled={cart.length === 0 || saleMutation.isPending}
                onClick={() => setCheckoutOpen(true)}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Proceed to checkout
              </button>
            </div>
          </div>
        </div>
      </div>

      {checkoutOpen ? (
        <PharmacyCheckoutModal
          total={total}
          subtotal={subtotal}
          tax={tax}
          discount={0}
          patientOutstanding={selectedPatient?.outstandingPkr ?? 0}
          creditLimit={selectedPatient?.creditLimitPkr ?? 0}
          hasControlled={hasControlled}
          isSubmitting={saleMutation.isPending}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={(payload) => saleMutation.mutate(payload)}
        />
      ) : null}
    </div>
  );
}
