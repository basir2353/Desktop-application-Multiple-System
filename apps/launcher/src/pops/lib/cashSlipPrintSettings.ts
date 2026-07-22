/** Pay in / Pay out slip customization (Cash drawer). */

export type CashSlipPrintSettings = {
  titlePayOut: string;
  titlePayIn: string;
  directionPayOut: string;
  directionPayIn: string;
  footerText: string;
  /** Soft typography (less bold). */
  softBold: boolean;
  showSession: boolean;
  showTime: boolean;
  customLines: { id: string; text: string; bold: boolean; enabled: boolean }[];
};

export const DEFAULT_CASH_SLIP_PRINT_SETTINGS: CashSlipPrintSettings = {
  titlePayOut: "PAY OUT",
  titlePayIn: "PAY IN",
  directionPayOut: "CASH GIVEN FROM DRAWER",
  directionPayIn: "CASH RECEIVED INTO DRAWER",
  footerText: "Cash drawer slip · keep with shift report",
  softBold: true,
  showSession: true,
  showTime: true,
  customLines: [],
};

export const CASH_SLIP_PRINT_SETTINGS_CHANGED_EVENT = "pops-cash-slip-print-settings-changed";

const STORAGE_KEY = "pops-cash-slip-print-settings-v1";

function normalizeLines(
  input: unknown,
): CashSlipPrintSettings["customLines"] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw, i) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as { id?: string; text?: string; bold?: boolean; enabled?: boolean };
      const text = String(row.text ?? "").slice(0, 100);
      return {
        id: String(row.id ?? `c-${i}`),
        text,
        bold: Boolean(row.bold),
        enabled: row.enabled !== false,
      };
    })
    .filter((x): x is CashSlipPrintSettings["customLines"][number] => Boolean(x))
    .slice(0, 12);
}

export function normalizeCashSlipPrintSettings(
  input: Partial<CashSlipPrintSettings> | null | undefined,
): CashSlipPrintSettings {
  const base = DEFAULT_CASH_SLIP_PRINT_SETTINGS;
  return {
    titlePayOut: (input?.titlePayOut ?? base.titlePayOut).trim().slice(0, 40) || base.titlePayOut,
    titlePayIn: (input?.titlePayIn ?? base.titlePayIn).trim().slice(0, 40) || base.titlePayIn,
    directionPayOut:
      (input?.directionPayOut ?? base.directionPayOut).trim().slice(0, 60) || base.directionPayOut,
    directionPayIn:
      (input?.directionPayIn ?? base.directionPayIn).trim().slice(0, 60) || base.directionPayIn,
    footerText: (input?.footerText ?? base.footerText).trim().slice(0, 100) || base.footerText,
    softBold: input?.softBold !== false,
    showSession: input?.showSession !== false,
    showTime: input?.showTime !== false,
    customLines: normalizeLines(input?.customLines),
  };
}

function storageKey(branchCode: string): string {
  return `${STORAGE_KEY}.${branchCode.trim().toUpperCase()}`;
}

export function loadCashSlipPrintSettings(
  branchCode: string | undefined | null,
): CashSlipPrintSettings {
  if (!branchCode || typeof localStorage === "undefined") return DEFAULT_CASH_SLIP_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return DEFAULT_CASH_SLIP_PRINT_SETTINGS;
    return normalizeCashSlipPrintSettings(JSON.parse(raw) as Partial<CashSlipPrintSettings>);
  } catch {
    return DEFAULT_CASH_SLIP_PRINT_SETTINGS;
  }
}

export function saveCashSlipPrintSettings(
  branchCode: string,
  settings: Partial<CashSlipPrintSettings>,
): CashSlipPrintSettings {
  const next = normalizeCashSlipPrintSettings({
    ...loadCashSlipPrintSettings(branchCode),
    ...settings,
  });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(branchCode), JSON.stringify(next));
  }
  window.dispatchEvent(
    new CustomEvent(CASH_SLIP_PRINT_SETTINGS_CHANGED_EVENT, { detail: { branchCode } }),
  );
  return next;
}
