import type { SessionContext } from "@platform/shared-types";

export function hasAllPermissions(
  session: SessionContext | null,
  required: readonly string[],
): boolean {
  if (!session || required.length === 0) return required.length === 0;
  const set = new Set(session.permissions);
  return required.every((p) => set.has(p));
}

export function filterByPermissions<T extends { requiredPermissions?: string[] }>(
  session: SessionContext | null,
  items: readonly T[],
): T[] {
  return items.filter((item) => hasAllPermissions(session, item.requiredPermissions ?? []));
}
