import type { Medicine } from "@platform/contracts";

/** Returns allergy strings that may conflict with the given medicine. */
export function findAllergyConflicts(medicine: Medicine, allergies: readonly string[]): string[] {
  if (allergies.length === 0) return [];
  const haystack = [medicine.name, medicine.genericName, medicine.brandName, medicine.presentation]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return allergies.filter((allergy) => {
    const token = allergy.trim().toLowerCase();
    return token.length > 1 && haystack.includes(token);
  });
}
