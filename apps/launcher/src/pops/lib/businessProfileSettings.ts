/** Business identity content (logo, address, phone, tax ID) — per branch, editable from Content Updation. */

export type BusinessProfile = {
  logoUrl: string | null;
  address: string;
  phone: string;
  taxId: string;
};

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  logoUrl: null,
  address: "",
  phone: "",
  taxId: "",
};

export const BUSINESS_PROFILE_CHANGED_EVENT = "pops-business-profile-changed";

const STORAGE_KEY = "pops-business-profile-v1";

export function normalizeBusinessProfile(input: Partial<BusinessProfile>): BusinessProfile {
  return {
    logoUrl: input.logoUrl?.trim() || null,
    address: (input.address ?? "").trim().slice(0, 160),
    phone: (input.phone ?? "").trim().slice(0, 32),
    taxId: (input.taxId ?? "").trim().slice(0, 32),
  };
}

export function loadBusinessProfile(branchCode: string | undefined): BusinessProfile {
  if (!branchCode) return DEFAULT_BUSINESS_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUSINESS_PROFILE;
    const parsed = JSON.parse(raw) as Record<string, Partial<BusinessProfile>>;
    const stored = parsed[branchCode];
    return stored ? normalizeBusinessProfile(stored) : DEFAULT_BUSINESS_PROFILE;
  } catch {
    return DEFAULT_BUSINESS_PROFILE;
  }
}

export function saveBusinessProfile(branchCode: string, profile: BusinessProfile): void {
  const next = normalizeBusinessProfile(profile);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, BusinessProfile>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(BUSINESS_PROFILE_CHANGED_EVENT, { detail: { branchCode, profile: next } }),
    );
  } catch {
    // ignore storage errors
  }
}
