/** General Store cash / pay-in-out local setup (per branch). */

export type StoreCashSetup = {
  defaultOpeningCashPkr: number;
  defaultCashierName: string;
  /** Quick reasons for Pay In */
  payInReasons: string[];
  /** Quick reasons for Pay Out */
  payOutReasons: string[];
  /** Print slip after recording movement */
  autoPrintSlip: boolean;
  /** Require open shift before POS sales */
  requireShiftForPos: boolean;
  /**
   * Customer name auto-selected on Sales (cash / walk-in).
   * Change customer only when processing a credit sale.
   */
  defaultCustomerName: string;
  /** Default tender on Sales — usually Cash */
  defaultPaymentMethod: "Cash" | "Card" | "Bank Transfer" | "Mobile Wallet" | "Credit";
  /** Show Quick Pick product grid beside the sales receipt */
  showQuickPickByDefault: boolean;
};

export const DEFAULT_STORE_CASH_SETUP: StoreCashSetup = {
  defaultOpeningCashPkr: 0,
  defaultCashierName: "",
  payInReasons: ["Change float top-up", "Owner deposit", "Bank withdrawal to till"],
  payOutReasons: ["Vendor payment", "Expense / petty cash", "Cash drop to safe", "Refund cash"],
  autoPrintSlip: true,
  requireShiftForPos: false,
  defaultCustomerName: "Cash Customer",
  defaultPaymentMethod: "Cash",
  showQuickPickByDefault: true,
};

const STORAGE_KEY = "store-cash-setup-v1";

function readAll(): Record<string, StoreCashSetup> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoreCashSetup>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, StoreCashSetup>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadStoreCashSetup(branchCode: string | undefined): StoreCashSetup {
  if (!branchCode) {
    return {
      ...DEFAULT_STORE_CASH_SETUP,
      payInReasons: [...DEFAULT_STORE_CASH_SETUP.payInReasons],
      payOutReasons: [...DEFAULT_STORE_CASH_SETUP.payOutReasons],
    };
  }
  const stored = readAll()[branchCode.trim().toUpperCase()];
  if (!stored) {
    return {
      ...DEFAULT_STORE_CASH_SETUP,
      payInReasons: [...DEFAULT_STORE_CASH_SETUP.payInReasons],
      payOutReasons: [...DEFAULT_STORE_CASH_SETUP.payOutReasons],
    };
  }
  const method = stored.defaultPaymentMethod;
  const validMethod =
    method === "Cash" ||
    method === "Card" ||
    method === "Bank Transfer" ||
    method === "Mobile Wallet" ||
    method === "Credit"
      ? method
      : DEFAULT_STORE_CASH_SETUP.defaultPaymentMethod;
  return {
    ...DEFAULT_STORE_CASH_SETUP,
    ...stored,
    payInReasons:
      Array.isArray(stored.payInReasons) && stored.payInReasons.length > 0
        ? stored.payInReasons
        : [...DEFAULT_STORE_CASH_SETUP.payInReasons],
    payOutReasons:
      Array.isArray(stored.payOutReasons) && stored.payOutReasons.length > 0
        ? stored.payOutReasons
        : [...DEFAULT_STORE_CASH_SETUP.payOutReasons],
    defaultCustomerName:
      (stored.defaultCustomerName ?? DEFAULT_STORE_CASH_SETUP.defaultCustomerName).trim() ||
      DEFAULT_STORE_CASH_SETUP.defaultCustomerName,
    defaultPaymentMethod: validMethod,
    showQuickPickByDefault:
      typeof stored.showQuickPickByDefault === "boolean"
        ? stored.showQuickPickByDefault
        : DEFAULT_STORE_CASH_SETUP.showQuickPickByDefault,
  };
}

export function saveStoreCashSetup(branchCode: string, setup: StoreCashSetup): void {
  const all = readAll();
  all[branchCode.trim().toUpperCase()] = {
    defaultOpeningCashPkr: Math.max(0, Number(setup.defaultOpeningCashPkr) || 0),
    defaultCashierName: setup.defaultCashierName.trim().slice(0, 80),
    payInReasons: setup.payInReasons.map((r) => r.trim()).filter(Boolean).slice(0, 20),
    payOutReasons: setup.payOutReasons.map((r) => r.trim()).filter(Boolean).slice(0, 20),
    autoPrintSlip: Boolean(setup.autoPrintSlip),
    requireShiftForPos: Boolean(setup.requireShiftForPos),
    defaultCustomerName:
      setup.defaultCustomerName.trim().slice(0, 80) || DEFAULT_STORE_CASH_SETUP.defaultCustomerName,
    defaultPaymentMethod: setup.defaultPaymentMethod || "Cash",
    showQuickPickByDefault: Boolean(setup.showQuickPickByDefault),
  };
  writeAll(all);
}

/** Match preferred cash / walk-in customer from the branch list. */
export function findDefaultStoreCustomer<T extends { id: string; name: string }>(
  customers: T[],
  preferredName?: string,
): T | undefined {
  const preferred = (preferredName ?? DEFAULT_STORE_CASH_SETUP.defaultCustomerName).trim().toLowerCase();
  return (
    customers.find((c) => c.name.trim().toLowerCase() === preferred) ??
    customers.find((c) => /^(cash customer|walk-?in|cash)$/i.test(c.name.trim()))
  );
}
