/** Persist last POS customer + discount draft so Apply survives UI reset / remount. */

export type PosCustomerDiscountDraft = {
  customer: string;
  phone: string;
  address: string;
  discountEditedAs: "pct" | "amount";
  discountPctInput: number;
  discountAmountInput: number;
  mode: string;
  savedAt: string;
};

function storageKey(branchCode: string): string {
  return `pops-pos-customer-discount-draft:${branchCode}`;
}

export function loadPosCustomerDiscountDraft(
  branchCode: string | undefined,
): PosCustomerDiscountDraft | null {
  if (!branchCode || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosCustomerDiscountDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePosCustomerDiscountDraft(
  branchCode: string,
  draft: Omit<PosCustomerDiscountDraft, "savedAt">,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const payload: PosCustomerDiscountDraft = {
      ...draft,
      customer: draft.customer.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey(branchCode), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearPosCustomerDiscountDraft(branchCode: string | undefined): void {
  if (!branchCode || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(storageKey(branchCode));
  } catch {
    // ignore
  }
}
