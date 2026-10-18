import type {
  MobizoneBankAccount,
  MobizoneBankDetails,
  MobizoneBusinessReport,
  MobizoneCustomer,
  MobizoneDashboard,
  MobizoneDevice,
  MobizoneExpense,
  MobizoneLedgerEntry,
  MobizonePurchase,
  MobizoneSale,
  MobizoneShopkeeper,
  MobizoneSplitPayment,
} from "@platform/contracts";
import { Linking } from "react-native";
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
  };
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
  const bank = Object.values(byAccount).reduce((a, n) => a + n, 0);
  return { cash, bank, byAccount };
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
  const pending = db.sales
    .filter((s) => s.customerId === customerId && !s.returnedAt)
    .reduce((a, s) => a + (s.remainingPkr || 0), 0);
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

export function getMobizoneDashboard(branchCode: string): MobizoneDashboard {
  const db = loadMobizoneDb(branchCode);
  const today = new Date().toISOString().slice(0, 10);
  const salesToday = db.sales.filter((s) => !s.returnedAt && s.createdAt.startsWith(today));
  const purchasesToday = db.purchases.filter((p) => p.createdAt.startsWith(today));
  const expensesToday = (db.expenses ?? []).filter((x) => x.createdAt.startsWith(today));
  const { cash, bank } = getCashBankBalances(db);
  return {
    inStock: db.devices.filter((d) => d.status === "in_stock").length,
    todaySalesPkr: salesToday.reduce((a, s) => a + s.pricePkr, 0),
    todayPurchasesPkr: purchasesToday.reduce((a, p) => a + p.purchasePricePkr, 0),
    todayProfitPkr:
      salesToday.reduce((a, s) => a + s.profitPkr, 0) -
      expensesToday.reduce((a, x) => a + x.amountPkr, 0),
    pendingReceivablesPkr: db.sales
      .filter((s) => !s.returnedAt)
      .reduce((a, s) => a + (s.remainingPkr || 0), 0),
    pendingPayablesPkr: db.purchases.reduce((a, p) => a + (p.remainingPkr || 0), 0),
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
  const expenseTotal = expenses.reduce((a, x) => a + x.amountPkr, 0);
  const { cash, bank } = getCashBankBalances(db);
  return {
    from: from || "—",
    to: to || "—",
    purchaseCount: purchases.length,
    saleCount: sales.length,
    purchaseAmountPkr: purchases.reduce((a, p) => a + p.purchasePricePkr, 0),
    saleAmountPkr: sales.reduce((a, s) => a + s.pricePkr, 0),
    profitPkr: sales.reduce((a, s) => a + s.profitPkr, 0) - expenseTotal,
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

export function recordExpense(
  branchCode: string,
  input: {
    title: string;
    amountPkr: number;
    method: "cash" | "bank";
    bankAccountId?: string | null;
    note?: string | null;
  },
): MobizoneExpense {
  if (!(input.amountPkr > 0)) throw new Error("Amount must be greater than zero.");
  if (!input.title.trim()) throw new Error("Expense title is required.");
  const db = loadMobizoneDb(branchCode);
  if (input.method === "bank") {
    assertBankAccountWhenNeeded(db, input.amountPkr, input.bankAccountId);
  }
  const row: MobizoneExpense = {
    id: newId(),
    title: input.title.trim(),
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

export function buildWhatsAppSaleText(sale: MobizoneSale): string {
  const bank = sale.payment.bank;
  return [
    `*MobiZone Sale Receipt*`,
    `Customer: ${sale.customerName}`,
    sale.customerPhone ? `Phone: ${sale.customerPhone}` : null,
    sale.customerCnic ? `CNIC: ${sale.customerCnic}` : null,
    `Device: ${sale.brand} ${sale.model}`,
    `IMEI: ${sale.imei}`,
    `Price: ${formatPkr(sale.pricePkr)}`,
    `Cash: ${formatPkr(sale.payment.cashPkr || 0)}`,
    `Bank: ${formatPkr(sale.payment.bankPkr || 0)}`,
    bank?.bankName ? `Bank: ${bank.bankName}` : null,
    bank?.accountTitle ? `Title: ${bank.accountTitle}` : null,
    bank?.txnRef ? `Txn: ${bank.txnRef}` : null,
    `Remaining: ${formatPkr(sale.remainingPkr)}`,
    sale.dueDate ? `Due: ${sale.dueDate}` : null,
    `Date: ${new Date(sale.createdAt).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsAppPurchaseText(purchase: MobizonePurchase): string {
  return [
    `*MobiZone Purchase Receipt*`,
    `Seller: ${purchase.sellerName}`,
    purchase.sellerPhone ? `Phone: ${purchase.sellerPhone}` : null,
    purchase.sellerCnic ? `CNIC: ${purchase.sellerCnic}` : null,
    `Device: ${purchase.brand} ${purchase.model}`,
    `IMEI: ${purchase.imei}`,
    `Purchase: ${formatPkr(purchase.purchasePricePkr)}`,
    `Paid: ${formatPkr(purchase.paidPkr || 0)}`,
    `Remaining (udhaar): ${formatPkr(purchase.remainingPkr || 0)}`,
    purchase.dueDate ? `Due: ${purchase.dueDate}` : null,
    `Cash: ${formatPkr(purchase.payment.cashPkr || 0)}`,
    `Bank: ${formatPkr(purchase.payment.bankPkr || 0)}`,
    `Date: ${new Date(purchase.createdAt).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");
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
  /* Desktop-only helper — no-op on mobile APK. */
}
