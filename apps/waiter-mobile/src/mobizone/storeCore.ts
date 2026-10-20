import type {
  MobizoneBankAccount,
  MobizoneBankDetails,
  MobizoneBusinessReport,
  MobizoneCustomer,
  MobizoneDashboard,
  MobizoneDevice,
  MobizoneDocumentAttachment,
  MobizoneExpense,
  MobizoneExpenseAccount,
  MobizoneLedgerEntry,
  MobizonePurchase,
  MobizoneSale,
  MobizoneShopkeeper,
  MobizoneSplitPayment,
  MobizoneVoucher,
  MobizoneVoucherLine,
} from "@platform/contracts";
import { Linking } from "react-native";
import {
  DEFAULT_MOBIZONE_RECEIPT_SETTINGS,
  loadMobizoneReceiptSettings,
  type MobizoneReceiptSettings,
} from "./receiptSettings";
import { mzStorageGet, mzStorageSet } from "./storage";

export type MobizoneDb = {
  customers: MobizoneCustomer[];
  devices: MobizoneDevice[];
  sales: MobizoneSale[];
  purchases: MobizonePurchase[];
  bankAccounts: MobizoneBankAccount[];
  shopkeepers: MobizoneShopkeeper[];
  ledger: MobizoneLedgerEntry[];
  expenses: MobizoneExpense[];
  expenseAccounts: MobizoneExpenseAccount[];
  vouchers: MobizoneVoucher[];
};

function storageKey(branchCode: string): string {
  return `mobizone-db-v2:${branchCode}`;
}

function legacyKey(branchCode: string): string {
  return `mobizone-db-v1:${branchCode}`;
}

function emptyDb(): MobizoneDb {
  return {
    customers: [],
    devices: [],
    sales: [],
    purchases: [],
    bankAccounts: [],
    shopkeepers: [],
    ledger: [],
    expenses: [],
    expenseAccounts: [],
    vouchers: [],
  };
}

export function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthStartDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function startOfDayLocal(dateYmd: string): Date | null {
  const raw = (dateYmd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [ys, ms, ds] = raw.split("-");
  const dt = new Date(Number(ys), Number(ms) - 1, Number(ds), 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function endOfDayLocal(dateYmd: string): Date | null {
  const raw = (dateYmd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [ys, ms, ds] = raw.split("-");
  const dt = new Date(Number(ys), Number(ms) - 1, Number(ds), 23, 59, 59, 999);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function filterByDateRange<T extends { createdAt: string }>(
  rows: T[],
  fromYmd: string | null | undefined,
  toYmd: string | null | undefined,
): T[] {
  const from = fromYmd ? startOfDayLocal(fromYmd) : null;
  const to = toYmd ? endOfDayLocal(toYmd) : null;
  if (!from && !to) return rows;
  return rows.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    if (Number.isNaN(t)) return false;
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime()) return false;
    return true;
  });
}

export function billDateToIso(dateYmd: string | null | undefined): string {
  const raw = (dateYmd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return nowIso();
  const [ys, ms, ds] = raw.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return nowIso();
  const now = new Date();
  const dt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  if (Number.isNaN(dt.getTime())) return nowIso();
  return dt.toISOString();
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

export function loadMobizoneDb(branchCode: string): MobizoneDb {
  try {
    const raw = mzStorageGet(storageKey(branchCode));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MobizoneDb>;
      return {
        customers: parsed.customers ?? [],
        devices: parsed.devices ?? [],
        sales: parsed.sales ?? [],
        purchases: parsed.purchases ?? [],
        bankAccounts: parsed.bankAccounts ?? [],
        shopkeepers: parsed.shopkeepers ?? [],
        ledger: parsed.ledger ?? [],
        expenses: parsed.expenses ?? [],
        expenseAccounts: parsed.expenseAccounts ?? [],
        vouchers: parsed.vouchers ?? [],
      };
    }
    const legacy = mzStorageGet(legacyKey(branchCode));
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<MobizoneDb>;
      const migrated: MobizoneDb = {
        customers: parsed.customers ?? [],
        devices: parsed.devices ?? [],
        sales: (parsed.sales ?? []).map((s) => ({
          ...s,
          customerAddress: (s as MobizoneSale).customerAddress ?? null,
          customerCnic: (s as MobizoneSale).customerCnic ?? null,
          cnicFrontDataUrl: (s as MobizoneSale).cnicFrontDataUrl ?? null,
          cnicBackDataUrl: (s as MobizoneSale).cnicBackDataUrl ?? null,
          shopkeeperId: (s as MobizoneSale).shopkeeperId ?? null,
          dueDate: (s as MobizoneSale).dueDate ?? null,
          warrantyDays: (s as MobizoneSale).warrantyDays ?? 0,
          returnedAt: (s as MobizoneSale).returnedAt ?? null,
        })),
        purchases: (parsed.purchases ?? []).map((p) => {
          const paid = sumPayment(p.payment);
          return {
            ...p,
            shopkeeperId: (p as MobizonePurchase).shopkeeperId ?? null,
            paidPkr: (p as MobizonePurchase).paidPkr ?? paid,
            remainingPkr: (p as MobizonePurchase).remainingPkr ?? Math.max(0, p.purchasePricePkr - paid),
            dueDate: (p as MobizonePurchase).dueDate ?? null,
          };
        }),
        bankAccounts: [],
        shopkeepers: [],
        ledger: [],
        expenses: [],
        expenseAccounts: [],
        vouchers: [],
      };
      saveMobizoneDb(branchCode, migrated);
      return migrated;
    }
    return emptyDb();
  } catch {
    return emptyDb();
  }
}

export function saveMobizoneDb(branchCode: string, db: MobizoneDb): void {
  mzStorageSet(storageKey(branchCode), JSON.stringify(db));
}

export function formatPkr(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}

function sumPayment(p: MobizoneSplitPayment): number {
  return (p.cashPkr || 0) + (p.bankPkr || 0);
}

function applyBankSnapshot(
  db: MobizoneDb,
  bankPkr: number,
  bank?: MobizoneBankDetails | null,
): MobizoneBankDetails | undefined {
  if (!bank && !(bankPkr > 0)) return bank ?? undefined;
  const acc = bank?.bankAccountId
    ? db.bankAccounts.find((a) => a.id === bank.bankAccountId)
    : undefined;
  return {
    bankAccountId: bank?.bankAccountId ?? null,
    bankName: bank?.bankName ?? acc?.bankName ?? null,
    accountTitle: bank?.accountTitle ?? acc?.accountTitle ?? null,
    accountNumber: bank?.accountNumber ?? acc?.accountNumber ?? null,
    iban: bank?.iban ?? acc?.iban ?? null,
    txnRef: bank?.txnRef ?? null,
    verified: Boolean(bank?.verified),
  };
}

export function getCashBankBalances(db: MobizoneDb): { cash: number; bank: number; byAccount: Record<string, number> } {
  // Money movement is recorded on the ledger (and expenses). Do not also sum
  // sale/purchase.payment — those amounts are already posted as ledger rows.
  let cash = 0;
  const byAccount: Record<string, number> = {};
  for (const a of db.bankAccounts) {
    byAccount[a.id] = a.openingBalancePkr || 0;
  }
  for (const e of db.ledger) {
    if (e.method === "cash") {
      cash += e.direction === "receive" ? e.amountPkr : -e.amountPkr;
    } else if (e.bankAccountId) {
      byAccount[e.bankAccountId] =
        (byAccount[e.bankAccountId] || 0) + (e.direction === "receive" ? e.amountPkr : -e.amountPkr);
    }
  }
  for (const x of db.expenses ?? []) {
    if (x.method === "cash") cash -= x.amountPkr;
    else if (x.bankAccountId) {
      byAccount[x.bankAccountId] = (byAccount[x.bankAccountId] || 0) - x.amountPkr;
    }
  }
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      const sign = line.side === "debit" ? 1 : -1;
      if (line.accountKind === "cash") cash += sign * line.amountPkr;
      else if (line.accountKind === "bank" && line.accountId) {
        byAccount[line.accountId] = (byAccount[line.accountId] || 0) + sign * line.amountPkr;
      }
    }
  }
  const bank = Object.values(byAccount).reduce((a, n) => a + n, 0);
  return { cash, bank, byAccount };
}

function customerVoucherAdjustPkr(db: MobizoneDb, customerId: string): number {
  let adj = 0;
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      if (line.accountKind !== "customer" || line.accountId !== customerId) continue;
      adj += line.side === "debit" ? line.amountPkr : -line.amountPkr;
    }
  }
  return adj;
}

function bankLedgerName(account: MobizoneBankAccount): string {
  const title = account.accountTitle?.trim();
  const bank = account.bankName?.trim();
  if (title && bank && title.toLowerCase() !== bank.toLowerCase()) {
    return `${title} (${bank})`;
  }
  return title || bank || "Bank";
}

function normalizeCnic(cnic: string | null | undefined): string {
  return (cnic ?? "").trim().replace(/[-\s]/g, "");
}

function assertBankAccountWhenNeeded(
  db: MobizoneDb,
  bankPkr: number,
  bankAccountId: string | null | undefined,
): void {
  if (!(bankPkr > 0)) return;
  if (!bankAccountId) {
    throw new Error("Select a bank account when bank amount is greater than zero.");
  }
  if (!db.bankAccounts.some((a) => a.id === bankAccountId)) {
    throw new Error("Selected bank account was not found.");
  }
}

function recomputeCustomerPending(db: MobizoneDb, customerId: string): void {
  const fromSales = db.sales
    .filter((s) => s.customerId === customerId && !s.returnedAt)
    .reduce((a, s) => a + (s.remainingPkr || 0), 0);
  const pending = Math.max(0, fromSales + customerVoucherAdjustPkr(db, customerId));
  db.customers = db.customers.map((c) => (c.id === customerId ? { ...c, pendingPkr: pending } : c));
}

function imeiClashInStock(db: MobizoneDb, imei: string, imei2?: string | null): boolean {
  const keys = [imei, imei2]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (keys.length === 0) return false;
  return db.devices.some((d) => {
    if (d.status !== "in_stock") return false;
    const deviceKeys = [d.imei, d.imei2, d.barcode]
      .map((v) => (v ?? "").trim().toLowerCase())
      .filter(Boolean);
    return keys.some((k) => deviceKeys.includes(k));
  });
}

export function stockValuePkr(db: MobizoneDb): number {
  return db.devices
    .filter((d) => d.status === "in_stock")
    .reduce((a, d) => a + (d.purchasePricePkr || 0), 0);
}

export function getMobizoneDashboard(branchCode: string): MobizoneDashboard {
  const db = loadMobizoneDb(branchCode);
  const today = new Date().toISOString().slice(0, 10);
  const inStockDevices = db.devices.filter((d) => d.status === "in_stock");
  const salesToday = db.sales.filter((s) => !s.returnedAt && s.createdAt.startsWith(today));
  const purchasesToday = db.purchases.filter((p) => p.createdAt.startsWith(today));
  const expensesToday = (db.expenses ?? []).filter((x) => x.createdAt.startsWith(today));
  const { cash, bank } = getCashBankBalances(db);
  return {
    inStock: inStockDevices.length,
    stockValuePkr: inStockDevices.reduce((a, d) => a + (d.purchasePricePkr || 0), 0),
    todaySalesPkr: salesToday.reduce((a, s) => a + s.pricePkr, 0),
    todayPurchasesPkr: purchasesToday.reduce((a, p) => a + p.purchasePricePkr, 0),
    todayProfitPkr:
      salesToday.reduce((a, s) => a + s.profitPkr, 0) -
      expensesToday.reduce((a, x) => a + x.amountPkr, 0) -
      (db.vouchers ?? [])
        .filter((v) => v.createdAt.startsWith(today))
        .reduce((a, v) => {
          for (const line of v.lines) {
            if (line.accountKind !== "expense") continue;
            a += line.side === "debit" ? line.amountPkr : -line.amountPkr;
          }
          return a;
        }, 0),
    pendingReceivablesPkr: Math.max(
      0,
      db.sales.filter((s) => !s.returnedAt).reduce((a, s) => a + (s.remainingPkr || 0), 0) +
        (db.vouchers ?? []).reduce((a, v) => {
          for (const line of v.lines) {
            if (line.accountKind !== "customer") continue;
            a += line.side === "debit" ? line.amountPkr : -line.amountPkr;
          }
          return a;
        }, 0),
    ),
    pendingPayablesPkr: Math.max(
      0,
      db.purchases.filter((p) => !p.returnedAt).reduce((a, p) => a + (p.remainingPkr || 0), 0) +
        (db.vouchers ?? []).reduce((a, v) => {
          for (const line of v.lines) {
            if (line.accountKind !== "shopkeeper") continue;
            a += line.side === "credit" ? line.amountPkr : -line.amountPkr;
          }
          return a;
        }, 0),
    ),
    cashBalancePkr: cash,
    bankBalancePkr: bank,
  };
}

export function getBusinessReport(
  branchCode: string,
  from: string,
  to: string,
): MobizoneBusinessReport {
  const db = loadMobizoneDb(branchCode);
  const fromT = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const toT = to ? new Date(`${to}T23:59:59`) : new Date();
  const inRange = (iso: string) => {
    const d = new Date(iso);
    return d >= fromT && d <= toT;
  };
  const sales = db.sales.filter((s) => !s.returnedAt && inRange(s.createdAt));
  const purchases = db.purchases.filter((p) => inRange(p.createdAt));
  const expenses = (db.expenses ?? []).filter((x) => inRange(x.createdAt));
  const voucherExpense = (db.vouchers ?? [])
    .filter((v) => inRange(v.createdAt))
    .reduce((a, v) => {
      for (const line of v.lines) {
        if (line.accountKind !== "expense") continue;
        a += line.side === "debit" ? line.amountPkr : -line.amountPkr;
      }
      return a;
    }, 0);
  const expenseTotal = expenses.reduce((a, x) => a + x.amountPkr, 0) + voucherExpense;
  const grossProfit = sales.reduce((a, s) => a + s.profitPkr, 0);
  const { cash, bank } = getCashBankBalances(db);
  return {
    from: from || "—",
    to: to || "—",
    purchaseCount: purchases.length,
    saleCount: sales.length,
    purchaseAmountPkr: purchases.reduce((a, p) => a + p.purchasePricePkr, 0),
    saleAmountPkr: sales.reduce((a, s) => a + s.pricePkr, 0),
    grossProfitPkr: grossProfit,
    expenseTotalPkr: expenseTotal,
    profitPkr: grossProfit - expenseTotal,
    stockValuePkr: stockValuePkr(db),
    receivablesPkr: db.sales
      .filter((s) => !s.returnedAt)
      .reduce((a, s) => a + (s.remainingPkr || 0), 0),
    payablesPkr: db.purchases.reduce((a, p) => a + (p.remainingPkr || 0), 0),
    cashBalancePkr: cash,
    bankBalancePkr: bank,
  };
}

export function upsertCustomer(
  branchCode: string,
  input: Omit<MobizoneCustomer, "id" | "createdAt" | "pendingPkr"> & {
    id?: string;
    pendingPkr?: number;
  },
): MobizoneCustomer {
  const db = loadMobizoneDb(branchCode);
  const cnicKey = normalizeCnic(input.cnic);
  const existing = input.id
    ? db.customers.find((c) => c.id === input.id)
    : cnicKey
      ? db.customers.find((c) => normalizeCnic(c.cnic) === cnicKey)
      : undefined;
  const row: MobizoneCustomer = {
    id: existing?.id ?? newId(),
    name: input.name,
    cnic: input.cnic ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    photoDataUrl: input.photoDataUrl ?? existing?.photoDataUrl ?? null,
    cnicFrontDataUrl: input.cnicFrontDataUrl ?? existing?.cnicFrontDataUrl ?? null,
    cnicBackDataUrl: input.cnicBackDataUrl ?? existing?.cnicBackDataUrl ?? null,
    pendingPkr: input.pendingPkr ?? existing?.pendingPkr ?? 0,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  if (existing) {
    db.customers = db.customers.map((c) => (c.id === row.id ? row : c));
  } else {
    db.customers = [row, ...db.customers];
  }
  saveMobizoneDb(branchCode, db);
  return row;
}

export function upsertShopkeeper(
  branchCode: string,
  input: Omit<MobizoneShopkeeper, "id" | "createdAt"> & { id?: string },
): MobizoneShopkeeper {
  const db = loadMobizoneDb(branchCode);
  const existing = input.id
    ? db.shopkeepers.find((s) => s.id === input.id)
    : db.shopkeepers.find((s) => s.shopNo === input.shopNo.trim());
  const row: MobizoneShopkeeper = {
    id: existing?.id ?? newId(),
    shopNo: input.shopNo.trim(),
    name: input.name.trim(),
    phone: input.phone ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  db.shopkeepers = existing
    ? db.shopkeepers.map((s) => (s.id === row.id ? row : s))
    : [row, ...db.shopkeepers];
  saveMobizoneDb(branchCode, db);
  return row;
}

export function upsertBankAccount(
  branchCode: string,
  input: Omit<MobizoneBankAccount, "id" | "createdAt"> & { id?: string },
): MobizoneBankAccount {
  const db = loadMobizoneDb(branchCode);
  const existing = input.id ? db.bankAccounts.find((a) => a.id === input.id) : undefined;
  const row: MobizoneBankAccount = {
    id: existing?.id ?? newId(),
    bankName: input.bankName.trim(),
    accountTitle: input.accountTitle.trim(),
    accountNumber: input.accountNumber ?? null,
    iban: input.iban ?? null,
    openingBalancePkr: input.openingBalancePkr || 0,
    notes: input.notes ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  db.bankAccounts = existing
    ? db.bankAccounts.map((a) => (a.id === row.id ? row : a))
    : [row, ...db.bankAccounts];
  saveMobizoneDb(branchCode, db);
  return row;
}

export function findDeviceByImei(branchCode: string, imei: string): MobizoneDevice | undefined {
  const q = imei.trim().toLowerCase();
  if (!q) return undefined;
  return loadMobizoneDb(branchCode).devices.find(
    (d) =>
      d.imei.toLowerCase() === q ||
      (d.imei2 && d.imei2.toLowerCase() === q) ||
      (d.barcode && d.barcode.toLowerCase() === q),
  );
}

export function searchByCnic(branchCode: string, cnic: string): MobizoneCustomer | undefined {
  const q = normalizeCnic(cnic);
  if (!q) return undefined;
  return loadMobizoneDb(branchCode).customers.find((c) => normalizeCnic(c.cnic) === q);
}

export function imeiHistory(branchCode: string, imei: string): {
  device?: MobizoneDevice;
  purchases: MobizonePurchase[];
  sales: MobizoneSale[];
} {
  const db = loadMobizoneDb(branchCode);
  const q = imei.trim().toLowerCase();
  const device = findDeviceByImei(branchCode, imei);
  return {
    device,
    purchases: db.purchases.filter((p) => p.imei.toLowerCase() === q),
    sales: db.sales.filter((s) => s.imei.toLowerCase() === q),
  };
}

export function customerHistory(branchCode: string, customerId: string): {
  customer?: MobizoneCustomer;
  purchases: MobizonePurchase[];
  sales: MobizoneSale[];
  ledger: MobizoneLedgerEntry[];
} {
  const db = loadMobizoneDb(branchCode);
  return {
    customer: db.customers.find((c) => c.id === customerId),
    purchases: db.purchases.filter((p) => p.customerId === customerId),
    sales: db.sales.filter((s) => s.customerId === customerId),
    ledger: db.ledger.filter((e) => e.partyKind === "customer" && e.partyId === customerId),
  };
}

export function shopkeeperBalance(branchCode: string, shopkeeperId: string): number {
  const db = loadMobizoneDb(branchCode);
  let bal = 0;
  // Open remainders already reflect paid amounts (ledger apply updates remaining).
  for (const p of db.purchases.filter((x) => x.shopkeeperId === shopkeeperId)) {
    bal += p.remainingPkr || 0;
  }
  for (const s of db.sales.filter((x) => x.shopkeeperId === shopkeeperId && !x.returnedAt)) {
    bal -= s.remainingPkr || 0;
  }
  // Standalone ledger rows (not tied to a deal) still move the running balance.
  for (const e of db.ledger.filter(
    (x) =>
      x.partyKind === "shopkeeper" &&
      x.partyId === shopkeeperId &&
      !x.relatedSaleId &&
      !x.relatedPurchaseId,
  )) {
    bal += e.direction === "receive" ? -e.amountPkr : e.amountPkr;
  }
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      if (line.accountKind !== "shopkeeper" || line.accountId !== shopkeeperId) continue;
      bal += line.side === "credit" ? line.amountPkr : -line.amountPkr;
    }
  }
  return bal;
}

export type PurchaseInput = {
  sellerName: string;
  sellerCnic?: string | null;
  sellerPhone?: string | null;
  sellerAddress?: string | null;
  sellerPhotoDataUrl?: string | null;
  cnicFrontDataUrl?: string | null;
  cnicBackDataUrl?: string | null;
  shopkeeperId?: string | null;
  imei: string;
  imei2?: string | null;
  brand: string;
  model: string;
  colour?: string | null;
  storage?: string | null;
  condition: "new" | "used";
  purchasePricePkr: number;
  salePricePkr?: number | null;
  payment: MobizoneSplitPayment;
  dueDate?: string | null;
};

export function recordPurchase(branchCode: string, input: PurchaseInput): MobizonePurchase {
  const db = loadMobizoneDb(branchCode);
  const imei = input.imei.trim();
  assertBankAccountWhenNeeded(db, input.payment.bankPkr || 0, input.payment.bank?.bankAccountId);
  if (imeiClashInStock(db, imei, input.imei2)) {
    throw new Error("This IMEI is already in stock.");
  }
  const ts = nowIso();
  const customer = upsertCustomer(branchCode, {
    name: input.sellerName,
    cnic: input.sellerCnic,
    phone: input.sellerPhone,
    address: input.sellerAddress,
    photoDataUrl: input.sellerPhotoDataUrl,
    cnicFrontDataUrl: input.cnicFrontDataUrl,
    cnicBackDataUrl: input.cnicBackDataUrl,
  });
  const next = loadMobizoneDb(branchCode);
  const paid = sumPayment(input.payment);
  const remaining = Math.max(0, input.purchasePricePkr - paid);
  const bank = applyBankSnapshot(next, input.payment.bankPkr || 0, input.payment.bank);
  const device: MobizoneDevice = {
    id: newId(),
    imei,
    imei2: input.imei2 ?? null,
    brand: input.brand.trim(),
    model: input.model.trim(),
    colour: input.colour ?? null,
    storage: input.storage ?? null,
    condition: input.condition,
    purchasePricePkr: input.purchasePricePkr,
    salePricePkr: input.salePricePkr ?? null,
    barcode: imei,
    status: "in_stock",
    shopkeeperId: input.shopkeeperId ?? null,
    notes: null,
    createdAt: ts,
    updatedAt: ts,
  };
  const purchase: MobizonePurchase = {
    id: newId(),
    deviceId: device.id,
    customerId: customer.id,
    shopkeeperId: input.shopkeeperId ?? null,
    sellerName: input.sellerName,
    sellerCnic: input.sellerCnic ?? null,
    sellerPhone: input.sellerPhone ?? null,
    sellerAddress: input.sellerAddress ?? null,
    sellerPhotoDataUrl: input.sellerPhotoDataUrl ?? null,
    cnicFrontDataUrl: input.cnicFrontDataUrl ?? null,
    cnicBackDataUrl: input.cnicBackDataUrl ?? null,
    imei,
    brand: device.brand,
    model: device.model,
    colour: device.colour,
    storage: device.storage,
    condition: input.condition,
    purchasePricePkr: input.purchasePricePkr,
    paidPkr: paid,
    remainingPkr: remaining,
    dueDate: remaining > 0 ? input.dueDate ?? null : null,
    payment: {
      cashPkr: input.payment.cashPkr || 0,
      bankPkr: input.payment.bankPkr || 0,
      bankLabel: input.payment.bankLabel ?? null,
      bank,
    },
    createdAt: ts,
  };
  next.devices = [device, ...next.devices];
  next.purchases = [purchase, ...next.purchases];
  if (paid > 0) {
    const party = input.shopkeeperId
      ? next.shopkeepers.find((s) => s.id === input.shopkeeperId)
      : customer;
    const partyName = party
      ? "shopNo" in party
        ? `Shop ${party.shopNo} — ${party.name}`
        : party.name
      : input.sellerName;
    if ((input.payment.cashPkr || 0) > 0) {
      next.ledger = [
        {
          id: newId(),
          partyKind: input.shopkeeperId ? "shopkeeper" : "customer",
          partyId: (input.shopkeeperId ?? customer.id) as string,
          partyName,
          direction: "pay",
          amountPkr: input.payment.cashPkr || 0,
          method: "cash",
          bankAccountId: null,
          bankName: null,
          txnRef: null,
          note: `Purchase ${device.brand} ${device.model} (${imei})`,
          relatedSaleId: null,
          relatedPurchaseId: purchase.id,
          createdAt: ts,
        },
        ...next.ledger,
      ];
    }
    if ((input.payment.bankPkr || 0) > 0) {
      next.ledger = [
        {
          id: newId(),
          partyKind: input.shopkeeperId ? "shopkeeper" : "customer",
          partyId: (input.shopkeeperId ?? customer.id) as string,
          partyName,
          direction: "pay",
          amountPkr: input.payment.bankPkr || 0,
          method: "bank",
          bankAccountId: bank?.bankAccountId ?? null,
          bankName: bank?.bankName ?? null,
          txnRef: bank?.txnRef ?? null,
          note: `Purchase ${device.brand} ${device.model} (${imei})`,
          relatedSaleId: null,
          relatedPurchaseId: purchase.id,
          createdAt: ts,
        },
        ...next.ledger,
      ];
    }
  }
  saveMobizoneDb(branchCode, next);
  return purchase;
}

export type SaleInput = {
  deviceId: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerCnic?: string | null;
  customerPhotoDataUrl?: string | null;
  cnicFrontDataUrl?: string | null;
  cnicBackDataUrl?: string | null;
  shopkeeperId?: string | null;
  pricePkr: number;
  payment: MobizoneSplitPayment;
  dueDate?: string | null;
  warrantyDays?: number;
};

export function recordSale(branchCode: string, input: SaleInput): MobizoneSale {
  const db = loadMobizoneDb(branchCode);
  const device = db.devices.find((d) => d.id === input.deviceId);
  if (!device || device.status !== "in_stock") {
    throw new Error("Device not available in stock.");
  }
  assertBankAccountWhenNeeded(db, input.payment.bankPkr || 0, input.payment.bank?.bankAccountId);
  const received = sumPayment(input.payment);
  if (received > input.pricePkr + 0.01) {
    throw new Error("Received amount cannot exceed sale price.");
  }
  const remaining = Math.max(0, input.pricePkr - received);
  const customer = upsertCustomer(branchCode, {
    name: input.customerName,
    phone: input.customerPhone,
    address: input.customerAddress,
    cnic: input.customerCnic,
    photoDataUrl: input.customerPhotoDataUrl,
    cnicFrontDataUrl: input.cnicFrontDataUrl,
    cnicBackDataUrl: input.cnicBackDataUrl,
  });
  const next = loadMobizoneDb(branchCode);
  const ts = nowIso();
  const bank = applyBankSnapshot(next, input.payment.bankPkr || 0, input.payment.bank);
  const sale: MobizoneSale = {
    id: newId(),
    deviceId: device.id,
    customerId: customer.id,
    shopkeeperId: input.shopkeeperId ?? null,
    customerName: input.customerName,
    customerPhone: input.customerPhone ?? null,
    customerAddress: input.customerAddress ?? null,
    customerCnic: input.customerCnic ?? null,
    customerPhotoDataUrl: input.customerPhotoDataUrl ?? null,
    cnicFrontDataUrl: input.cnicFrontDataUrl ?? null,
    cnicBackDataUrl: input.cnicBackDataUrl ?? null,
    imei: device.imei,
    brand: device.brand,
    model: device.model,
    pricePkr: input.pricePkr,
    receivedPkr: received,
    remainingPkr: remaining,
    dueDate: remaining > 0 ? input.dueDate ?? null : null,
    warrantyDays: Math.max(0, Math.floor(input.warrantyDays ?? 0)),
    returnedAt: null,
    payment: {
      cashPkr: input.payment.cashPkr || 0,
      bankPkr: input.payment.bankPkr || 0,
      bankLabel: input.payment.bankLabel ?? null,
      bank,
    },
    costPkr: device.purchasePricePkr,
    profitPkr: input.pricePkr - device.purchasePricePkr,
    createdAt: ts,
  };
  next.devices = next.devices.map((d) =>
    d.id === device.id
      ? { ...d, status: "sold" as const, salePricePkr: input.pricePkr, updatedAt: ts }
      : d,
  );
  next.sales = [sale, ...next.sales];
  const partyName = input.shopkeeperId
    ? (() => {
        const sk = next.shopkeepers.find((s) => s.id === input.shopkeeperId);
        return sk ? `Shop ${sk.shopNo} — ${sk.name}` : input.customerName;
      })()
    : input.customerName;
  const partyId = (input.shopkeeperId ?? customer.id) as string;
  const partyKind = input.shopkeeperId ? ("shopkeeper" as const) : ("customer" as const);
  if ((input.payment.cashPkr || 0) > 0) {
    next.ledger = [
      {
        id: newId(),
        partyKind,
        partyId,
        partyName,
        direction: "receive",
        amountPkr: input.payment.cashPkr || 0,
        method: "cash",
        bankAccountId: null,
        bankName: null,
        txnRef: null,
        note: `Sale ${device.brand} ${device.model} (${device.imei})`,
        relatedSaleId: sale.id,
        relatedPurchaseId: null,
        createdAt: ts,
      },
      ...next.ledger,
    ];
  }
  if ((input.payment.bankPkr || 0) > 0) {
    next.ledger = [
      {
        id: newId(),
        partyKind,
        partyId,
        partyName,
        direction: "receive",
        amountPkr: input.payment.bankPkr || 0,
        method: "bank",
        bankAccountId: bank?.bankAccountId ?? null,
        bankName: bank?.bankName ?? null,
        txnRef: bank?.txnRef ?? null,
        note: `Sale ${device.brand} ${device.model} (${device.imei})`,
        relatedSaleId: sale.id,
        relatedPurchaseId: null,
        createdAt: ts,
      },
      ...next.ledger,
    ];
  }
  recomputeCustomerPending(next, customer.id);
  saveMobizoneDb(branchCode, next);
  return sale;
}

/** Return a sold phone to stock (warranty / customer return). */
export function returnSale(branchCode: string, saleId: string, reason?: string): MobizoneSale {
  const db = loadMobizoneDb(branchCode);
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) throw new Error("Sale not found.");
  if (sale.returnedAt) throw new Error("Sale already returned.");
  const ts = nowIso();
  const note = `Sale return ${sale.imei}${reason ? ` — ${reason}` : ""}`;
  const partyKind = sale.shopkeeperId ? ("shopkeeper" as const) : ("customer" as const);
  const partyId = (sale.shopkeeperId ?? sale.customerId) as string;
  const refundRows: MobizoneLedgerEntry[] = [];
  const cashRefund = sale.payment.cashPkr || 0;
  const bankRefund = sale.payment.bankPkr || 0;
  if (cashRefund > 0 && partyId) {
    refundRows.push({
      id: newId(),
      partyKind,
      partyId,
      partyName: sale.customerName,
      direction: "pay",
      amountPkr: cashRefund,
      method: "cash",
      bankAccountId: null,
      bankName: null,
      txnRef: null,
      note,
      relatedSaleId: sale.id,
      relatedPurchaseId: null,
      createdAt: ts,
    });
  }
  if (bankRefund > 0 && partyId) {
    refundRows.push({
      id: newId(),
      partyKind,
      partyId,
      partyName: sale.customerName,
      direction: "pay",
      amountPkr: bankRefund,
      method: "bank",
      bankAccountId: sale.payment.bank?.bankAccountId ?? null,
      bankName: sale.payment.bank?.bankName ?? null,
      txnRef: sale.payment.bank?.txnRef ?? null,
      note,
      relatedSaleId: sale.id,
      relatedPurchaseId: null,
      createdAt: ts,
    });
  }
  db.sales = db.sales.map((s) =>
    s.id === saleId
      ? {
          ...s,
          returnedAt: ts,
          remainingPkr: 0,
          profitPkr: 0,
          receivedPkr: 0,
          payment: { cashPkr: 0, bankPkr: 0, bankLabel: null, bank: undefined },
        }
      : s,
  );
  db.devices = db.devices.map((d) =>
    d.id === sale.deviceId
      ? {
          ...d,
          status: "in_stock" as const,
          notes: reason ? `Returned: ${reason}` : d.notes,
          updatedAt: ts,
        }
      : d,
  );
  if (refundRows.length > 0) {
    db.ledger = [...refundRows, ...db.ledger];
  }
  if (sale.customerId) recomputeCustomerPending(db, sale.customerId);
  saveMobizoneDb(branchCode, db);
  return db.sales.find((s) => s.id === saleId)!;
}

export function upsertExpenseAccount(
  branchCode: string,
  input: { id?: string; name: string; notes?: string | null },
): MobizoneExpenseAccount {
  const name = input.name.trim();
  if (!name) throw new Error("Account name is required.");
  const db = loadMobizoneDb(branchCode);
  const existing = input.id
    ? db.expenseAccounts.find((a) => a.id === input.id)
    : db.expenseAccounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
  const row: MobizoneExpenseAccount = {
    id: existing?.id ?? newId(),
    name,
    notes: input.notes?.trim() || null,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  db.expenseAccounts = existing
    ? db.expenseAccounts.map((a) => (a.id === row.id ? row : a))
    : [row, ...(db.expenseAccounts ?? [])];
  saveMobizoneDb(branchCode, db);
  return row;
}

export function seedExpenseAccounts(branchCode: string): void {
  const db = loadMobizoneDb(branchCode);
  if ((db.expenseAccounts ?? []).length > 0) return;
  for (const name of ["Rent", "Electricity", "Food", "Salary", "Courier"]) {
    upsertExpenseAccount(branchCode, { name });
  }
}

export function recordExpense(
  branchCode: string,
  input: {
    accountId?: string | null;
    title?: string | null;
    amountPkr: number;
    method: "cash" | "bank";
    bankAccountId?: string | null;
    note?: string | null;
  },
): MobizoneExpense {
  if (!(input.amountPkr > 0)) throw new Error("Amount must be greater than zero.");
  const db = loadMobizoneDb(branchCode);
  const account = input.accountId
    ? db.expenseAccounts.find((a) => a.id === input.accountId)
    : undefined;
  const title = (account?.name || input.title || "").trim();
  if (!title) throw new Error("Select an expense account.");
  if (input.method === "bank") {
    assertBankAccountWhenNeeded(db, input.amountPkr, input.bankAccountId);
  }
  const row: MobizoneExpense = {
    id: newId(),
    title,
    accountId: account?.id ?? input.accountId ?? null,
    amountPkr: input.amountPkr,
    method: input.method,
    bankAccountId: input.method === "bank" ? input.bankAccountId ?? null : null,
    note: input.note ?? null,
    createdAt: nowIso(),
  };
  db.expenses = [row, ...(db.expenses ?? [])];
  saveMobizoneDb(branchCode, db);
  return row;
}

export type MoneyAccountRef = { kind: "cash" } | { kind: "bank"; accountId: string };

function normalizeAttachments(
  files: MobizoneDocumentAttachment[] | null | undefined,
): MobizoneDocumentAttachment[] {
  if (!files?.length) return [];
  if (files.length > 8) throw new Error("Maximum 8 reference documents per voucher.");
  return files.map((f) => ({
    id: f.id,
    fileName: f.fileName.trim() || "document",
    mimeType: f.mimeType ?? null,
    sizeBytes: f.sizeBytes || 0,
    dataUrl: f.dataUrl,
    uploadedAt: f.uploadedAt || nowIso(),
  }));
}

function assertBalancedLines(lines: MobizoneVoucherLine[]): void {
  const debit = lines.filter((l) => l.side === "debit").reduce((a, l) => a + l.amountPkr, 0);
  const credit = lines.filter((l) => l.side === "credit").reduce((a, l) => a + l.amountPkr, 0);
  if (Math.abs(debit - credit) > 0.001) {
    throw new Error(`Voucher must balance (debit ${debit} ≠ credit ${credit}).`);
  }
  if (!(debit > 0)) throw new Error("Amount must be greater than zero.");
}

function resolveMoneyAccountName(db: MobizoneDb, ref: MoneyAccountRef): string {
  if (ref.kind === "cash") return "Cash on hand";
  const acc = db.bankAccounts.find((a) => a.id === ref.accountId);
  if (!acc) throw new Error("Bank account not found.");
  return bankLedgerName(acc);
}

export function recordContraVoucher(
  branchCode: string,
  input: {
    from: MoneyAccountRef;
    to: MoneyAccountRef;
    amountPkr: number;
    entryDate?: string | null;
    reference?: string | null;
    note?: string | null;
    attachments?: MobizoneDocumentAttachment[] | null;
  },
): MobizoneVoucher {
  if (!(input.amountPkr > 0)) throw new Error("Amount must be greater than zero.");
  const fromKey = input.from.kind === "cash" ? "cash" : `bank:${input.from.accountId}`;
  const toKey = input.to.kind === "cash" ? "cash" : `bank:${input.to.accountId}`;
  if (fromKey === toKey) throw new Error("From and To accounts must be different.");
  const db = loadMobizoneDb(branchCode);
  if (input.from.kind === "bank") assertBankAccountWhenNeeded(db, input.amountPkr, input.from.accountId);
  if (input.to.kind === "bank") assertBankAccountWhenNeeded(db, input.amountPkr, input.to.accountId);
  const amount = input.amountPkr;
  const lines: MobizoneVoucherLine[] = [
    {
      accountKind: input.from.kind,
      accountId: input.from.kind === "bank" ? input.from.accountId : null,
      accountName: resolveMoneyAccountName(db, input.from),
      side: "credit",
      amountPkr: amount,
    },
    {
      accountKind: input.to.kind,
      accountId: input.to.kind === "bank" ? input.to.accountId : null,
      accountName: resolveMoneyAccountName(db, input.to),
      side: "debit",
      amountPkr: amount,
    },
  ];
  assertBalancedLines(lines);
  const voucher: MobizoneVoucher = {
    id: newId(),
    kind: "contra",
    createdAt: billDateToIso(input.entryDate),
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    amountPkr: amount,
    lines,
    attachments: normalizeAttachments(input.attachments),
  };
  db.vouchers = [voucher, ...(db.vouchers ?? [])];
  saveMobizoneDb(branchCode, db);
  return voucher;
}

export type GeneralVoucherLineInput = {
  accountKind: MobizoneVoucherLine["accountKind"];
  accountId?: string | null;
  side: "debit" | "credit";
  amountPkr: number;
};

function resolveVoucherAccountName(
  db: MobizoneDb,
  kind: MobizoneVoucherLine["accountKind"],
  accountId: string | null | undefined,
): string {
  if (kind === "cash") return "Cash on hand";
  if (kind === "bank") {
    const acc = db.bankAccounts.find((a) => a.id === accountId);
    if (!acc) throw new Error("Bank account not found.");
    return bankLedgerName(acc);
  }
  if (kind === "customer") {
    const c = db.customers.find((x) => x.id === accountId);
    if (!c) throw new Error("Customer account not found.");
    return c.name;
  }
  if (kind === "shopkeeper") {
    const s = db.shopkeepers.find((x) => x.id === accountId);
    if (!s) throw new Error("Supplier / shopkeeper account not found.");
    return `Shop ${s.shopNo} — ${s.name}`;
  }
  const exp = db.expenseAccounts.find((x) => x.id === accountId);
  if (!exp) throw new Error("Expense account not found.");
  return exp.name;
}

export function recordGeneralVoucher(
  branchCode: string,
  input: {
    lines: GeneralVoucherLineInput[];
    entryDate?: string | null;
    reference?: string | null;
    note?: string | null;
    attachments?: MobizoneDocumentAttachment[] | null;
  },
): MobizoneVoucher {
  if (!input.lines || input.lines.length < 2) {
    throw new Error("Add at least two lines (debit and credit).");
  }
  const db = loadMobizoneDb(branchCode);
  const lines: MobizoneVoucherLine[] = input.lines.map((raw) => {
    if (!(raw.amountPkr > 0)) throw new Error("Each line amount must be greater than zero.");
    if (raw.accountKind !== "cash" && !raw.accountId) {
      throw new Error(`Select an account for ${raw.accountKind}.`);
    }
    if (raw.accountKind === "bank") {
      assertBankAccountWhenNeeded(db, raw.amountPkr, raw.accountId);
    }
    return {
      accountKind: raw.accountKind,
      accountId: raw.accountKind === "cash" ? null : raw.accountId ?? null,
      accountName: resolveVoucherAccountName(db, raw.accountKind, raw.accountId),
      side: raw.side,
      amountPkr: raw.amountPkr,
    };
  });
  assertBalancedLines(lines);
  const amount = lines.filter((l) => l.side === "debit").reduce((a, l) => a + l.amountPkr, 0);
  const voucher: MobizoneVoucher = {
    id: newId(),
    kind: "general",
    createdAt: billDateToIso(input.entryDate),
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    amountPkr: amount,
    lines,
    attachments: normalizeAttachments(input.attachments),
  };
  db.vouchers = [voucher, ...(db.vouchers ?? [])];
  const ids = new Set(
    lines.filter((l) => l.accountKind === "customer" && l.accountId).map((l) => l.accountId!),
  );
  for (const id of ids) recomputeCustomerPending(db, id);
  saveMobizoneDb(branchCode, db);
  return voucher;
}

/** One-click demo starter data for first-time shops (safe to run once). */
export function seedFriendlyDefaults(branchCode: string): void {
  const db = loadMobizoneDb(branchCode);
  if (db.bankAccounts.length === 0) {
    upsertBankAccount(branchCode, {
      bankName: "JazzCash",
      accountTitle: "Shop JazzCash",
      accountNumber: null,
      iban: null,
      openingBalancePkr: 0,
      notes: null,
    });
    upsertBankAccount(branchCode, {
      bankName: "HBL",
      accountTitle: "Shop HBL",
      accountNumber: null,
      iban: null,
      openingBalancePkr: 0,
      notes: null,
    });
  }
  seedExpenseAccounts(branchCode);
}

export function recordLedgerPayment(
  branchCode: string,
  input: {
    partyKind: "customer" | "shopkeeper";
    partyId: string;
    direction: "receive" | "pay";
    amountPkr: number;
    method: "cash" | "bank";
    bankAccountId?: string | null;
    txnRef?: string | null;
    note?: string | null;
    applyToSaleId?: string | null;
    applyToPurchaseId?: string | null;
  },
): MobizoneLedgerEntry {
  const db = loadMobizoneDb(branchCode);
  if (!(input.amountPkr > 0)) throw new Error("Amount must be greater than zero.");
  const party =
    input.partyKind === "customer"
      ? db.customers.find((c) => c.id === input.partyId)
      : db.shopkeepers.find((s) => s.id === input.partyId);
  if (!party) throw new Error("Party not found.");
  const partyName =
    input.partyKind === "shopkeeper" && "shopNo" in party
      ? `Shop ${party.shopNo} — ${party.name}`
      : party.name;
  const acc = input.bankAccountId
    ? db.bankAccounts.find((a) => a.id === input.bankAccountId)
    : undefined;
  const ts = nowIso();
  const entry: MobizoneLedgerEntry = {
    id: newId(),
    partyKind: input.partyKind,
    partyId: input.partyId,
    partyName,
    direction: input.direction,
    amountPkr: input.amountPkr,
    method: input.method,
    bankAccountId: input.bankAccountId ?? null,
    bankName: acc?.bankName ?? null,
    txnRef: input.txnRef ?? null,
    note: input.note ?? null,
    relatedSaleId: input.applyToSaleId ?? null,
    relatedPurchaseId: input.applyToPurchaseId ?? null,
    createdAt: ts,
  };
  if (input.method === "bank") {
    assertBankAccountWhenNeeded(db, input.amountPkr, input.bankAccountId);
  }
  db.ledger = [entry, ...db.ledger];
  let touchedCustomerId: string | null = null;
  if (input.applyToSaleId && input.direction === "receive") {
    db.sales = db.sales.map((s) => {
      if (s.id !== input.applyToSaleId) return s;
      const rem = Math.max(0, (s.remainingPkr || 0) - input.amountPkr);
      touchedCustomerId = s.customerId ?? null;
      return { ...s, remainingPkr: rem, receivedPkr: s.pricePkr - rem };
    });
  }
  if (input.applyToPurchaseId && input.direction === "pay") {
    db.purchases = db.purchases.map((p) => {
      if (p.id !== input.applyToPurchaseId) return p;
      const rem = Math.max(0, (p.remainingPkr || 0) - input.amountPkr);
      return { ...p, remainingPkr: rem, paidPkr: p.purchasePricePkr - rem };
    });
  }
  if (touchedCustomerId) recomputeCustomerPending(db, touchedCustomerId);
  else if (input.partyKind === "customer") recomputeCustomerPending(db, input.partyId);
  saveMobizoneDb(branchCode, db);
  return entry;
}

export function filterByPeriod<T extends { createdAt: string }>(
  rows: T[],
  period: "daily" | "weekly" | "monthly" | "all",
): T[] {
  if (period === "all") return rows;
  const now = new Date();
  const start = new Date(now);
  if (period === "daily") start.setHours(0, 0, 0, 0);
  else if (period === "weekly") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return rows.filter((r) => new Date(r.createdAt) >= start);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWhatsAppSaleText(sale: MobizoneSale, branchCode?: string | null): string {
  const bank = sale.payment.bank;
  const settings = branchCode ? loadMobizoneReceiptSettings(branchCode) : null;
  const shopWa = (settings?.whatsappNumber || settings?.shopPhone || "").trim();
  return [
    `*${settings?.shopName || "MobiZone"} Sale Receipt*`,
    `Customer: ${sale.customerName}`,
    sale.customerPhone ? `Phone: ${sale.customerPhone}` : null,
    sale.customerCnic ? `CNIC: ${sale.customerCnic}` : null,
    sale.customerAddress ? `Address: ${sale.customerAddress}` : null,
    `Device: ${sale.brand} ${sale.model}`,
    `IMEI: ${sale.imei}`,
    `Price: ${formatPkr(sale.pricePkr)}`,
    `Cash: ${formatPkr(sale.payment.cashPkr || 0)}`,
    `Bank: ${formatPkr(sale.payment.bankPkr || 0)}`,
    bank?.bankName ? `Bank name: ${bank.bankName}` : null,
    bank?.accountTitle ? `Title: ${bank.accountTitle}` : null,
    bank?.txnRef ? `Txn: ${bank.txnRef}` : null,
    `Remaining: ${formatPkr(sale.remainingPkr)}`,
    sale.dueDate ? `Due: ${sale.dueDate}` : null,
    sale.warrantyDays ? `Warranty: ${sale.warrantyDays} days` : null,
    `Date: ${new Date(sale.createdAt).toLocaleString()}`,
    shopWa ? `Shop WhatsApp: ${shopWa}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsAppPurchaseText(
  purchase: MobizonePurchase,
  branchCode?: string | null,
): string {
  const settings = branchCode ? loadMobizoneReceiptSettings(branchCode) : null;
  const shopWa = (settings?.whatsappNumber || settings?.shopPhone || "").trim();
  return [
    `*${settings?.shopName || "MobiZone"} Purchase Receipt*`,
    `Seller: ${purchase.sellerName}`,
    purchase.sellerPhone ? `Phone: ${purchase.sellerPhone}` : null,
    purchase.sellerCnic ? `CNIC: ${purchase.sellerCnic}` : null,
    purchase.sellerAddress ? `Address: ${purchase.sellerAddress}` : null,
    `Device: ${purchase.brand} ${purchase.model}`,
    `IMEI: ${purchase.imei}`,
    `Purchase: ${formatPkr(purchase.purchasePricePkr)}`,
    `Paid: ${formatPkr(purchase.paidPkr || 0)}`,
    `Remaining (udhaar): ${formatPkr(purchase.remainingPkr || 0)}`,
    purchase.dueDate ? `Due: ${purchase.dueDate}` : null,
    `Cash: ${formatPkr(purchase.payment.cashPkr || 0)}`,
    `Bank: ${formatPkr(purchase.payment.bankPkr || 0)}`,
    `Date: ${new Date(purchase.createdAt).toLocaleString()}`,
    shopWa ? `Shop WhatsApp: ${shopWa}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveReceiptSettings(
  branchCode?: string | null,
  override?: MobizoneReceiptSettings,
): MobizoneReceiptSettings {
  if (override) return override;
  if (branchCode) return loadMobizoneReceiptSettings(branchCode);
  return DEFAULT_MOBIZONE_RECEIPT_SETTINGS;
}

function enrichSaleCustomer(sale: MobizoneSale, branchCode?: string | null): MobizoneSale {
  if (!branchCode || !sale.customerId) return sale;
  const customer = loadMobizoneDb(branchCode).customers.find((c) => c.id === sale.customerId);
  if (!customer) return sale;
  return {
    ...sale,
    customerName: sale.customerName || customer.name,
    customerPhone: sale.customerPhone || customer.phone || null,
    customerAddress: sale.customerAddress || customer.address || null,
    customerCnic: sale.customerCnic || customer.cnic || null,
  };
}

function thermalDash(widthPx: number): string {
  return `<div class="dash">${"─".repeat(widthPx >= 320 ? 32 : 28)}</div>`;
}

function thermalKv(label: string, value: string): string {
  return `<div class="kv"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function thermalPartyBlock(
  title: string,
  input: {
    name?: string | null;
    phone?: string | null;
    cnic?: string | null;
    address?: string | null;
  },
): string {
  const v = (x?: string | null) => (x ?? "").trim() || "—";
  return `
  <div class="sec">${escapeHtml(title)}</div>
  ${thermalKv("Name", v(input.name))}
  ${thermalKv("Phone", v(input.phone))}
  ${thermalKv("CNIC / ID", v(input.cnic))}
  ${thermalKv("Address", v(input.address))}`;
}

function thermalShell(width: number, body: string): string {
  return `
<style>
  @page{margin:4mm}
  .rcpt{max-width:${width}px;margin:0 auto;font-family:ui-monospace,"Courier New",monospace;font-size:12px;color:#0f172a;line-height:1.4;padding:8px}
  .rcpt .brand{text-align:center;padding-bottom:6px;border-bottom:2px solid #0f172a;margin-bottom:6px}
  .rcpt .shop{font-size:17px;font-weight:800;margin:0;text-transform:uppercase;letter-spacing:.04em}
  .rcpt .sub{text-align:center;font-size:11px;margin:2px 0;color:#334155}
  .rcpt .title{text-align:center;font-size:12px;font-weight:800;margin:8px 0 2px;letter-spacing:.12em;text-transform:uppercase}
  .rcpt .pill{display:inline-block;border:1px solid #0f172a;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700}
  .rcpt .dash{text-align:center;letter-spacing:1px;margin:6px 0;color:#64748b;white-space:pre;overflow:hidden}
  .rcpt .sec{font-size:10px;font-weight:800;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.08em;color:#0f766e}
  .rcpt .kv{display:flex;justify-content:space-between;gap:10px;margin:2px 0}
  .rcpt .kv span:first-child{color:#475569}
  .rcpt .kv span:last-child{text-align:right;font-weight:700}
  .rcpt .item .name{font-weight:800}
  .rcpt .item .meta{font-size:11px;color:#475569}
  .rcpt .totalbox{margin-top:8px;padding:8px 0;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a}
  .rcpt .totalbox .kv span{font-size:14px;font-weight:800}
  .rcpt .foot{text-align:center;margin-top:10px;font-size:11px}
  .rcpt .wa{text-align:center;margin-top:4px;font-size:10px;color:#0f766e;font-weight:700}
  .rcpt .cut{text-align:center;margin-top:8px;font-size:10px;color:#94a3b8}
</style>
<div class="rcpt">${body}</div>`;
}

export function buildSaleReceiptHtml(
  sale: MobizoneSale,
  branchCode?: string | null,
  settingsOverride?: MobizoneReceiptSettings,
): string {
  const settings = resolveReceiptSettings(branchCode, settingsOverride);
  const f = settings.fields;
  const enriched = enrichSaleCustomer(sale, branchCode);
  const bank = enriched.payment.bank;
  const width = settings.paperWidthMm === 58 ? 280 : 360;
  const dash = thermalDash(width);
  const deviceLabel = `${enriched.brand} ${enriched.model}`;
  const received = (enriched.payment.cashPkr || 0) + (enriched.payment.bankPkr || 0);
  const wa = (settings.whatsappNumber || settings.shopPhone || "").trim();
  const body = `
  <div class="brand">
    ${f.shopName ? `<p class="shop">${escapeHtml(settings.shopName)}</p>` : ""}
    ${f.shopPhone && settings.shopPhone ? `<p class="sub">Tel ${escapeHtml(settings.shopPhone)}</p>` : ""}
    ${f.shopAddress && settings.shopAddress ? `<p class="sub">${escapeHtml(settings.shopAddress)}</p>` : ""}
  </div>
  ${f.documentTitle ? `<p class="title">${escapeHtml(settings.documentTitle)}</p>` : ""}
  <div style="text-align:center"><span class="pill">BILL ${escapeHtml(enriched.id.slice(0, 8).toUpperCase())}</span></div>
  ${f.timestamp ? `<p class="sub">${escapeHtml(new Date(enriched.createdAt).toLocaleString())}</p>` : ""}
  ${dash}
  ${thermalPartyBlock("Customer", {
    name: enriched.customerName,
    phone: enriched.customerPhone,
    cnic: enriched.customerCnic,
    address: enriched.customerAddress,
  })}
  ${dash}
  <div class="sec">Items</div>
  <div class="item">
    <div class="kv"><span class="name">${escapeHtml(f.device ? deviceLabel : "Device")}</span><span>${escapeHtml(f.salePrice ? formatPkr(enriched.pricePkr) : "")}</span></div>
    ${f.imei ? `<div class="meta">IMEI: ${escapeHtml(enriched.imei)}</div>` : ""}
    <div class="meta">Qty: 1</div>
  </div>
  ${dash}
  <div class="sec">Payment</div>
  ${f.salePrice ? thermalKv("Subtotal", formatPkr(enriched.pricePkr)) : ""}
  ${f.cash ? thermalKv("Cash", formatPkr(enriched.payment.cashPkr || 0)) : ""}
  ${f.bank ? thermalKv("Bank", formatPkr(enriched.payment.bankPkr || 0)) : ""}
  ${f.bankDetails && bank?.bankName ? thermalKv("Bank name", bank.bankName) : ""}
  ${thermalKv("Received", formatPkr(received))}
  ${f.remaining ? thermalKv("Remaining / Udhaar", formatPkr(enriched.remainingPkr)) : ""}
  ${f.salePrice ? `<div class="totalbox">${thermalKv("TOTAL", formatPkr(enriched.pricePkr))}</div>` : ""}
  ${f.footer && settings.footerText ? `<p class="foot">${escapeHtml(settings.footerText)}</p>` : `<p class="foot">Shukriya — Visit again</p>`}
  ${wa ? `<p class="wa">WhatsApp ${escapeHtml(wa)}</p>` : ""}
  <p class="cut">— ${escapeHtml(settings.shopName || "MobiZone")} —</p>`;
  return thermalShell(width, body);
}

export function buildPurchaseReceiptHtml(
  purchase: MobizonePurchase,
  branchCode?: string | null,
  settingsOverride?: MobizoneReceiptSettings,
): string {
  const settings = resolveReceiptSettings(branchCode, settingsOverride);
  const f = settings.fields;
  const width = settings.paperWidthMm === 58 ? 280 : 360;
  const dash = thermalDash(width);
  const deviceLabel = `${purchase.brand} ${purchase.model}`;
  const wa = (settings.whatsappNumber || settings.shopPhone || "").trim();
  const body = `
  <div class="brand">
    ${f.shopName ? `<p class="shop">${escapeHtml(settings.shopName)}</p>` : ""}
    ${f.shopPhone && settings.shopPhone ? `<p class="sub">Tel ${escapeHtml(settings.shopPhone)}</p>` : ""}
    ${f.shopAddress && settings.shopAddress ? `<p class="sub">${escapeHtml(settings.shopAddress)}</p>` : ""}
  </div>
  <p class="title">${escapeHtml((settings.documentTitle || "Sale Receipt").replace(/Sale/i, "Purchase"))}</p>
  <div style="text-align:center"><span class="pill">BILL ${escapeHtml(purchase.id.slice(0, 8).toUpperCase())}</span></div>
  ${f.timestamp ? `<p class="sub">${escapeHtml(new Date(purchase.createdAt).toLocaleString())}</p>` : ""}
  ${dash}
  ${thermalPartyBlock("Seller", {
    name: purchase.sellerName,
    phone: purchase.sellerPhone,
    cnic: purchase.sellerCnic,
    address: purchase.sellerAddress,
  })}
  ${dash}
  <div class="sec">Items</div>
  <div class="item">
    <div class="kv"><span class="name">${escapeHtml(f.device ? deviceLabel : "Device")}</span><span>${escapeHtml(f.salePrice ? formatPkr(purchase.purchasePricePkr) : "")}</span></div>
    ${f.imei ? `<div class="meta">IMEI: ${escapeHtml(purchase.imei)}</div>` : ""}
    <div class="meta">Qty: 1</div>
  </div>
  ${dash}
  <div class="sec">Payment</div>
  ${f.salePrice ? thermalKv("Purchase", formatPkr(purchase.purchasePricePkr)) : ""}
  ${f.salePrice ? thermalKv("Paid", formatPkr(purchase.paidPkr || 0)) : ""}
  ${f.remaining ? thermalKv("Remaining / Udhaar", formatPkr(purchase.remainingPkr || 0)) : ""}
  ${f.salePrice ? `<div class="totalbox">${thermalKv("TOTAL", formatPkr(purchase.purchasePricePkr))}</div>` : ""}
  ${f.footer && settings.footerText ? `<p class="foot">${escapeHtml(settings.footerText)}</p>` : `<p class="foot">Shukriya</p>`}
  ${wa ? `<p class="wa">WhatsApp ${escapeHtml(wa)}</p>` : ""}
  <p class="cut">— ${escapeHtml(settings.shopName || "MobiZone")} —</p>`;
  return thermalShell(width, body);
}

export async function printSaleReceipt(
  sale: MobizoneSale,
  branchCode?: string | null,
): Promise<void> {
  const Print = await import("expo-print");
  await Print.printAsync({ html: buildSaleReceiptHtml(sale, branchCode) });
}

export async function printPurchaseReceipt(
  purchase: MobizonePurchase,
  branchCode?: string | null,
): Promise<void> {
  const Print = await import("expo-print");
  await Print.printAsync({ html: buildPurchaseReceiptHtml(purchase, branchCode) });
}

export function buildWhatsAppAccountStatement(
  branchCode: string,
  partyKind: "customer" | "shopkeeper",
  partyId: string,
): string {
  const db = loadMobizoneDb(branchCode);
  const entries = db.ledger.filter((e) => e.partyKind === partyKind && e.partyId === partyId);
  const party =
    partyKind === "customer"
      ? db.customers.find((c) => c.id === partyId)
      : db.shopkeepers.find((s) => s.id === partyId);
  const name =
    party && "shopNo" in party ? `Shop ${party.shopNo} — ${party.name}` : party?.name ?? "Account";
  const lines = entries.slice(0, 40).map((e) => {
    const sign = e.direction === "receive" ? "+" : "-";
    return `${new Date(e.createdAt).toLocaleDateString()} ${sign}${formatPkr(e.amountPkr)} (${e.method}) ${e.note ?? ""}`;
  });
  let balanceNote = "";
  if (partyKind === "shopkeeper") {
    balanceNote = `Current balance (positive = we owe): ${formatPkr(shopkeeperBalance(branchCode, partyId))}`;
  } else {
    const recv = db.sales
      .filter((s) => s.customerId === partyId)
      .reduce((a, s) => a + (s.remainingPkr || 0), 0);
    balanceNote = `Receivable: ${formatPkr(recv)}`;
  }
  return [`*MobiZone Account Statement*`, name, balanceNote, "", ...lines].join("\n");
}

export function openWhatsApp(phone: string | null | undefined, text: string): void {
  const digits = (phone ?? "").replace(/\D/g, "");
  const q = encodeURIComponent(text);
  const url = digits
    ? `https://wa.me/${digits.startsWith("92") ? digits : `92${digits.replace(/^0/, "")}`}?text=${q}`
    : `https://wa.me/?text=${q}`;
  void Linking.openURL(url);
}

export function printHtmlPage(_title: string, _bodyHtml: string): void {
  /* Desktop helper — mobile uses printSaleReceipt / printPurchaseReceipt. */
}
