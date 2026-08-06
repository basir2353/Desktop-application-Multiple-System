/** Shift Team / AP selection — which waiter or rider name goes on bills & reports. */

export type PosShiftTeam = {
  waiterId: string;
  waiterName: string;
  riderId: string;
  riderName: string;
};

const EMPTY: PosShiftTeam = {
  waiterId: "",
  waiterName: "",
  riderId: "",
  riderName: "",
};

function storageKey(branchCode: string): string {
  return `pops-pos-shift-team:${branchCode}`;
}

export function loadPosShiftTeam(branchCode: string | undefined): PosShiftTeam {
  if (!branchCode || typeof localStorage === "undefined") return { ...EMPTY };
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PosShiftTeam>;
    return {
      waiterId: String(parsed.waiterId ?? ""),
      waiterName: String(parsed.waiterName ?? ""),
      riderId: String(parsed.riderId ?? ""),
      riderName: String(parsed.riderName ?? ""),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function savePosShiftTeam(branchCode: string, team: PosShiftTeam): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(branchCode), JSON.stringify(team));
  } catch {
    // ignore
  }
}

export const POS_SHIFT_TEAM_CHANGED_EVENT = "pops-pos-shift-team-changed";

export function emitPosShiftTeamChanged(branchCode: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(POS_SHIFT_TEAM_CHANGED_EVENT, { detail: { branchCode } }),
  );
}
