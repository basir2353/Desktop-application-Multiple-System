/** Local directory of customers typed on POS (auto-saved on place order). */

export type PosKnownCustomerRecord = {
  name: string;
  phone: string;
  address: string;
  savedAt: string;
};

function storageKey(branchCode: string): string {
  return `pops-pos-known-customers:${branchCode}`;
}

export function loadPosKnownCustomers(branchCode: string | undefined): PosKnownCustomerRecord[] {
  if (!branchCode || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PosKnownCustomerRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) => row && typeof row === "object" && (row.name?.trim() || row.phone?.trim()),
    );
  } catch {
    return [];
  }
}

/** Upsert by phone (preferred) or name so place-order without Apply still remembers the guest. */
export function savePosKnownCustomer(
  branchCode: string | undefined,
  input: { name?: string; phone?: string; address?: string },
): void {
  if (!branchCode || typeof localStorage === "undefined") return;
  const name = (input.name ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const address = (input.address ?? "").trim();
  if (!name && !phone) return;
  try {
    const key = (phone || name).toLowerCase();
    const prev = loadPosKnownCustomers(branchCode);
    const next: PosKnownCustomerRecord[] = [
      { name: name || "Customer", phone, address, savedAt: new Date().toISOString() },
      ...prev.filter((row) => (row.phone || row.name).trim().toLowerCase() !== key),
    ].slice(0, 80);
    localStorage.setItem(storageKey(branchCode), JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
