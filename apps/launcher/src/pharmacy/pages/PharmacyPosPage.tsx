import { PHARMACY_PAYMENT_METHODS, type Medicine, type PharmacySale } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createPharmacySale, fetchPharmacyMedicines, fetchPharmacyPatients } from "../api/pharmacy";
import { printPharmacyInvoice } from "../lib/printPharmacyInvoice";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyField, PharmacyInput, PharmacySelect } from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

type CartLine = { medicine: Medicine; qty: number };

export function PharmacyPosPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PHARMACY_PAYMENT_METHODS)[number]>("Cash");
  const [patientId, setPatientId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<PharmacySale | null>(null);

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

  const saleMutation = useMutation({
    mutationFn: () =>
      createPharmacySale({
        branchCode: branch!.code,
        patientId: patientId || undefined,
        paymentMethod,
        discount: 0,
        lines: cart.map((c) => ({ medicineId: c.medicine.id, qty: c.qty })),
      }),
    onSuccess: (sale) => {
      invalidate();
      setCart([]);
      setSearch("");
      setLastSale(sale);
      setNotice(`Bill ${sale.invoiceNumber} saved — ${formatPkr(sale.total)}`);
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
          (m.barcode ?? "").includes(q),
      )
      .slice(0, 12);
  }, [inStock, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.medicine.sellingPrice * line.qty, 0);
  const tax = cart.reduce(
    (sum, line) => sum + Math.round((line.medicine.sellingPrice * line.qty * line.medicine.taxPct) / 100),
    0,
  );
  const total = subtotal + tax;
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  function addToCart(medicine: Medicine): void {
    setCart((prev) => {
      const existing = prev.find((c) => c.medicine.id === medicine.id);
      if (existing) {
        if (existing.qty >= medicine.currentStock) return prev;
        return prev.map((c) => (c.medicine.id === medicine.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { medicine, qty: 1 }];
    });
    setSearch("");
    setError(null);
  }

  function updateQty(medicineId: string, qty: number): void {
    setCart((prev) => {
      const line = prev.find((c) => c.medicine.id === medicineId);
      if (!line) return prev;
      const max = line.medicine.currentStock;
      if (qty <= 0) return prev.filter((c) => c.medicine.id !== medicineId);
      return prev.map((c) => (c.medicine.id === medicineId ? { ...c, qty: Math.min(qty, max) } : c));
    });
  }

  function tryAddFromSearch(): void {
    const q = search.trim();
    if (!q) return;
    const exact = inStock.find((m) => m.barcode === q || m.sku.toLowerCase() === q.toLowerCase());
    if (exact) {
      addToCart(exact);
      return;
    }
    if (matches[0]) addToCart(matches[0]);
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
        title="Quick billing"
        subtitle="Search a medicine, add it to the bill, then print — simple counter sales."
      />

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left — add medicines */}
        <div className="space-y-3 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <PharmacyField label="Find medicine" hint="Type name, SKU, or scan barcode — press Enter to add">
              <PharmacyInput
                placeholder="e.g. Panadol, MED-001, or barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryAddFromSearch();
                  }
                }}
                autoFocus
              />
            </PharmacyField>

            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-slate-500">
                {search.trim() ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : "Tap to add"}
              </p>
              <ul className="max-h-[420px] space-y-1 overflow-y-auto">
                {matches.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                    No medicine in stock for this search.
                  </li>
                ) : (
                  matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => addToCart(m)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-slate-700 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900 dark:text-white">{m.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {m.genericName ?? m.presentation ?? m.sku} · Stock: {m.currentStock}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatPkr(m.sellingPrice)}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right — bill */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Current bill</h2>
              <span className="text-xs text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
            </div>

            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No medicines added yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {cart.map((line) => (
                  <li key={line.medicine.id} className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {line.medicine.name}
                      </div>
                      <div className="text-xs text-slate-500">{formatPkr(line.medicine.sellingPrice)} each</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                        onClick={() => updateQty(line.medicine.id, line.qty - 1)}
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-medium tabular-nums">{line.qty}</span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                        onClick={() => updateQty(line.medicine.id, line.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="w-20 text-right text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                      {formatPkr(line.medicine.sellingPrice * line.qty)}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-600"
                      onClick={() => updateQty(line.medicine.id, 0)}
                      aria-label={`Remove ${line.medicine.name}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              {tax > 0 ? (
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatPkr(subtotal)}</span>
                </div>
              ) : null}
              {tax > 0 ? (
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Tax</span>
                  <span>{formatPkr(tax)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Total to pay</span>
                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatPkr(total)}
                </span>
              </div>

              <PharmacyField label="Customer (optional)">
                <PharmacySelect value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {(patientsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </PharmacySelect>
              </PharmacyField>

              <PharmacyField label="Payment">
                <PharmacySelect
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                >
                  {PHARMACY_PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </PharmacySelect>
              </PharmacyField>

              <button
                type="button"
                disabled={cart.length === 0 || saleMutation.isPending}
                onClick={() => saleMutation.mutate()}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saleMutation.isPending ? "Saving bill…" : "Make bill & print"}
              </button>

              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="w-full rounded-lg py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  Clear bill
                </button>
              ) : null}

              {lastSale ? (
                <button
                  type="button"
                  onClick={() => printPharmacyInvoice(branch?.name ?? "Pharmacy", branch?.code ?? "—", lastSale)}
                  className="w-full rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Reprint last bill
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
