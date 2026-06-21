/** HQ monitoring branch — no live kitchen; aggregates store branches in ops views. */
export const MONITORING_BRANCH_CODE = "HQ-01";

export function isMonitoringBranch(code: string | undefined): boolean {
  return code === MONITORING_BRANCH_CODE;
}

export function storeBranchCodes(
  selectedCode: string | undefined,
  allBranches: readonly { code: string }[] | undefined,
): string[] {
  if (!selectedCode) return [];
  if (isMonitoringBranch(selectedCode)) {
    return (allBranches ?? [])
      .map((b) => b.code)
      .filter((c) => c !== MONITORING_BRANCH_CODE);
  }
  return [selectedCode];
}
