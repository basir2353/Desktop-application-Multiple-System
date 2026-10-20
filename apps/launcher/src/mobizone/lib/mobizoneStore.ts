import type {
  MobizoneBankAccount,
  MobizoneBankDetails,
  MobizoneBusinessReport,
  MobizoneCustomer,
  MobizoneDashboard,
  MobizoneDevice,
  MobizoneExpense,
  MobizoneExpenseAccount,
  MobizoneLedgerEntry,
  MobizonePurchase,
  MobizoneSale,
  MobizoneShopkeeper,
  MobizoneSplitPayment,
  MobizoneDocumentAttachment,
  MobizoneVoucher,
  MobizoneVoucherLine,
} from "@platform/contracts";
import {
  DEFAULT_MOBIZONE_RECEIPT_SETTINGS,
  loadMobizoneReceiptSettings,
  type MobizoneReceiptSettings,
} from "./mobizoneReceiptSettings";

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

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

/** YYYY-MM-DD for `<input type="date">`, defaults to today. */
export function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First day of the current month (YYYY-MM-DD) — e.g. 2026-10-01. */
export function monthStartDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Convert bill date (YYYY-MM-DD) to ISO, keeping local clock time. */
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

/** Inclusive from/to filter on `createdAt` (or any ISO date field). */
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

export type PeriodMoneyActivity = {
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
  byAccount: Record<string, { inPkr: number; outPkr: number; netPkr: number }>;
};

/** Cash/bank in-out totals between from and to dates (editable range filter). */
export function getCashBankPeriodActivity(
  db: MobizoneDb,
  fromYmd: string,
  toYmd: string,
): PeriodMoneyActivity {
  const byAccount: PeriodMoneyActivity["byAccount"] = {};
  for (const a of db.bankAccounts) {
    byAccount[a.id] = { inPkr: 0, outPkr: 0, netPkr: 0 };
  }
  let cashIn = 0;
  let cashOut = 0;
  let bankIn = 0;
  let bankOut = 0;

  for (const e of filterByDateRange(db.ledger, fromYmd, toYmd)) {
    if (e.method === "cash") {
      if (e.direction === "receive") cashIn += e.amountPkr;
      else cashOut += e.amountPkr;
    } else if (e.bankAccountId) {
      const slot = byAccount[e.bankAccountId] ?? { inPkr: 0, outPkr: 0, netPkr: 0 };
      if (e.direction === "receive") {
        slot.inPkr += e.amountPkr;
        bankIn += e.amountPkr;
      } else {
        slot.outPkr += e.amountPkr;
        bankOut += e.amountPkr;
      }
      slot.netPkr = slot.inPkr - slot.outPkr;
      byAccount[e.bankAccountId] = slot;
    }
  }
  for (const x of filterByDateRange(db.expenses ?? [], fromYmd, toYmd)) {
    if (x.method === "cash") {
      cashOut += x.amountPkr;
    } else if (x.bankAccountId) {
      const slot = byAccount[x.bankAccountId] ?? { inPkr: 0, outPkr: 0, netPkr: 0 };
      slot.outPkr += x.amountPkr;
      slot.netPkr = slot.inPkr - slot.outPkr;
      byAccount[x.bankAccountId] = slot;
      bankOut += x.amountPkr;
    }
  }
  for (const v of filterByDateRange(db.vouchers ?? [], fromYmd, toYmd)) {
    for (const line of v.lines) {
      if (line.accountKind === "cash") {
        if (line.side === "debit") cashIn += line.amountPkr;
        else cashOut += line.amountPkr;
      } else if (line.accountKind === "bank" && line.accountId) {
        const slot = byAccount[line.accountId] ?? { inPkr: 0, outPkr: 0, netPkr: 0 };
        if (line.side === "debit") {
          slot.inPkr += line.amountPkr;
          bankIn += line.amountPkr;
        } else {
          slot.outPkr += line.amountPkr;
          bankOut += line.amountPkr;
        }
        slot.netPkr = slot.inPkr - slot.outPkr;
        byAccount[line.accountId] = slot;
      }
    }
  }
  return { cashIn, cashOut, bankIn, bankOut, byAccount };
}

function isoInDateRange(iso: string, fromYmd: string | null | undefined, toYmd: string | null | undefined): boolean {
  if (!iso) return false;
  const from = fromYmd ? startOfDayLocal(fromYmd) : null;
  const to = toYmd ? endOfDayLocal(toYmd) : null;
  if (!from && !to) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export function loadMobizoneDb(branchCode: string): MobizoneDb {
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
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
    const legacy = localStorage.getItem(legacyKey(branchCode));
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
  localStorage.setItem(storageKey(branchCode), JSON.stringify(db));
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
  // Contra / General voucher cash & bank lines (debit = in, credit = out).
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      const sign = line.side === "debit" ? 1 : -1;
      if (line.accountKind === "cash") {
        cash += sign * line.amountPkr;
      } else if (line.accountKind === "bank" && line.accountId) {
        byAccount[line.accountId] = (byAccount[line.accountId] || 0) + sign * line.amountPkr;
      }
    }
  }
  const bank = Object.values(byAccount).reduce((a, n) => a + n, 0);
  return { cash, bank, byAccount };
}

function voucherMoneyLabel(v: MobizoneVoucher, line: MobizoneVoucherLine): string {
  const kindLabel = v.kind === "contra" ? "Contra" : "General voucher";
  const ref = v.reference ? ` · Ref ${v.reference}` : "";
  const note = v.note ? ` — ${v.note}` : "";
  return `${kindLabel}: ${line.accountName}${ref}${note}`;
}

/** Expense total from posted expenses plus General voucher expense debits (− credits). */
export function voucherExpenseDeltaPkr(db: MobizoneDb): number {
  let total = 0;
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      if (line.accountKind !== "expense") continue;
      total += line.side === "debit" ? line.amountPkr : -line.amountPkr;
    }
  }
  return total;
}

/** Display name for a bank ledger report (account title / bank). */
export function bankLedgerName(account: MobizoneBankAccount): string {
  const title = account.accountTitle?.trim();
  const bank = account.bankName?.trim();
  if (title && bank && title.toLowerCase() !== bank.toLowerCase()) {
    return `${title} (${bank})`;
  }
  return title || bank || "Bank ledger";
}

export type MoneyLedgerRow = {
  id: string;
  at: string;
  label: string;
  inPkr: number;
  outPkr: number;
  balanceAfter: number;
};

export type MoneyLedgerReport = {
  kind: "cash" | "bank";
  accountId: string | null;
  title: string;
  balancePkr: number;
  rows: MoneyLedgerRow[];
  fromDate?: string | null;
  toDate?: string | null;
  periodInPkr?: number;
  periodOutPkr?: number;
};

type RawMoneyMove = {
  id: string;
  at: string;
  label: string;
  delta: number;
};

function buildRunningRows(opening: number, moves: RawMoneyMove[]): MoneyLedgerRow[] {
  const sorted = [...moves].sort((a, b) => a.at.localeCompare(b.at));
  let bal = opening;
  const rows: MoneyLedgerRow[] = [];
  if (opening !== 0) {
    rows.push({
      id: "opening",
      at: "",
      label: "Opening balance",
      inPkr: opening > 0 ? opening : 0,
      outPkr: opening < 0 ? Math.abs(opening) : 0,
      balanceAfter: opening,
    });
  }
  for (const m of sorted) {
    bal += m.delta;
    rows.push({
      id: m.id,
      at: m.at,
      label: m.label,
      inPkr: m.delta > 0 ? m.delta : 0,
      outPkr: m.delta < 0 ? Math.abs(m.delta) : 0,
      balanceAfter: bal,
    });
  }
  return rows.reverse();
}

function filterLedgerRowsByDate(
  rows: MoneyLedgerRow[],
  fromYmd?: string | null,
  toYmd?: string | null,
): { rows: MoneyLedgerRow[]; periodInPkr: number; periodOutPkr: number } {
  if (!fromYmd && !toYmd) {
    const periodInPkr = rows.reduce((s, r) => s + (r.inPkr || 0), 0);
    const periodOutPkr = rows.reduce((s, r) => s + (r.outPkr || 0), 0);
    return { rows, periodInPkr, periodOutPkr };
  }
  const filtered = rows.filter((r) => !r.at || isoInDateRange(r.at, fromYmd, toYmd));
  const periodInPkr = filtered.reduce((s, r) => s + (r.inPkr || 0), 0);
  const periodOutPkr = filtered.reduce((s, r) => s + (r.outPkr || 0), 0);
  return { rows: filtered, periodInPkr, periodOutPkr };
}

export function getCashLedgerReport(
  branchCode: string,
  opts?: { fromDate?: string | null; toDate?: string | null },
): MoneyLedgerReport {
  const db = loadMobizoneDb(branchCode);
  const moves: RawMoneyMove[] = [];
  for (const e of db.ledger) {
    if (e.method !== "cash") continue;
    const sign = e.direction === "receive" ? 1 : -1;
    moves.push({
      id: e.id,
      at: e.createdAt,
      label: `${e.partyName}${e.note ? ` — ${e.note}` : ""} (${e.direction})`,
      delta: sign * e.amountPkr,
    });
  }
  for (const x of db.expenses ?? []) {
    if (x.method !== "cash") continue;
    moves.push({
      id: x.id,
      at: x.createdAt,
      label: `Expense: ${x.title}${x.note ? ` — ${x.note}` : ""}`,
      delta: -x.amountPkr,
    });
  }
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      if (line.accountKind !== "cash") continue;
      moves.push({
        id: `${v.id}:cash:${line.side}`,
        at: v.createdAt,
        label: voucherMoneyLabel(v, line),
        delta: (line.side === "debit" ? 1 : -1) * line.amountPkr,
      });
    }
  }
  const allRows = buildRunningRows(0, moves);
  const { rows, periodInPkr, periodOutPkr } = filterLedgerRowsByDate(
    allRows,
    opts?.fromDate,
    opts?.toDate,
  );
  const balances = getCashBankBalances(db);
  return {
    kind: "cash",
    accountId: null,
    title: "Cash Ledger",
    balancePkr: balances.cash,
    rows,
    fromDate: opts?.fromDate ?? null,
    toDate: opts?.toDate ?? null,
    periodInPkr,
    periodOutPkr,
  };
}

export function getBankLedgerReport(
  branchCode: string,
  accountId: string,
  opts?: { fromDate?: string | null; toDate?: string | null },
): MoneyLedgerReport {
  const db = loadMobizoneDb(branchCode);
  const account = db.bankAccounts.find((a) => a.id === accountId);
  if (!account) {
    return {
      kind: "bank",
      accountId,
      title: "Bank ledger",
      balancePkr: 0,
      rows: [],
      fromDate: opts?.fromDate ?? null,
      toDate: opts?.toDate ?? null,
      periodInPkr: 0,
      periodOutPkr: 0,
    };
  }
  const moves: RawMoneyMove[] = [];
  for (const e of db.ledger) {
    if (e.method !== "bank" || e.bankAccountId !== accountId) continue;
    const sign = e.direction === "receive" ? 1 : -1;
    moves.push({
      id: e.id,
      at: e.createdAt,
      label: `${e.partyName}${e.note ? ` — ${e.note}` : ""}${e.txnRef ? ` · Ref ${e.txnRef}` : ""} (${e.direction})`,
      delta: sign * e.amountPkr,
    });
  }
  for (const x of db.expenses ?? []) {
    if (x.method !== "bank" || x.bankAccountId !== accountId) continue;
    moves.push({
      id: x.id,
      at: x.createdAt,
      label: `Expense: ${x.title}${x.note ? ` — ${x.note}` : ""}`,
      delta: -x.amountPkr,
    });
  }
  for (const v of db.vouchers ?? []) {
    for (const line of v.lines) {
      if (line.accountKind !== "bank" || line.accountId !== accountId) continue;
      moves.push({
        id: `${v.id}:bank:${line.side}`,
        at: v.createdAt,
        label: voucherMoneyLabel(v, line),
        delta: (line.side === "debit" ? 1 : -1) * line.amountPkr,
      });
    }
  }
  const opening = account.openingBalancePkr || 0;
  const allRows = buildRunningRows(opening, moves);
  const { rows, periodInPkr, periodOutPkr } = filterLedgerRowsByDate(
    allRows,
    opts?.fromDate,
    opts?.toDate,
  );
  const balances = getCashBankBalances(db);
  return {
    kind: "bank",
    accountId,
    title: `${bankLedgerName(account)} Ledger`,
    balancePkr: balances.byAccount[accountId] ?? opening,
    rows,
    fromDate: opts?.fromDate ?? null,
    toDate: opts?.toDate ?? null,
    periodInPkr,
    periodOutPkr,
  };
}

export function printMoneyLedgerReport(report: MoneyLedgerReport): void {
  const lines = report.rows
    .map((r) => {
      const when = r.at ? new Date(r.at).toLocaleString() : "—";
      const inAmt = r.inPkr ? formatPkr(r.inPkr) : "—";
      const outAmt = r.outPkr ? formatPkr(r.outPkr) : "—";
      return `<tr>
        <td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px">${escapeHtml(when)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px">${escapeHtml(r.label)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #ddd;text-align:right;font-size:11px">${escapeHtml(inAmt)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #ddd;text-align:right;font-size:11px">${escapeHtml(outAmt)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #ddd;text-align:right;font-size:11px;font-weight:700">${escapeHtml(formatPkr(r.balanceAfter))}</td>
      </tr>`;
    })
    .join("");
  const body = `
    <h2 style="margin:0 0 8px;font-family:system-ui,sans-serif">${escapeHtml(report.title)}</h2>
    <p style="margin:0 0 12px;font-family:system-ui,sans-serif">Balance: <strong>${escapeHtml(formatPkr(report.balancePkr))}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-family:system-ui,sans-serif">
      <thead>
        <tr>
          <th style="text-align:left;padding:4px 6px;border-bottom:2px solid #111;font-size:11px">When</th>
          <th style="text-align:left;padding:4px 6px;border-bottom:2px solid #111;font-size:11px">Detail</th>
          <th style="text-align:right;padding:4px 6px;border-bottom:2px solid #111;font-size:11px">In</th>
          <th style="text-align:right;padding:4px 6px;border-bottom:2px solid #111;font-size:11px">Out</th>
          <th style="text-align:right;padding:4px 6px;border-bottom:2px solid #111;font-size:11px">Balance</th>
        </tr>
      </thead>
      <tbody>${lines || `<tr><td colspan="5" style="padding:12px;text-align:center">No entries</td></tr>`}</tbody>
    </table>`;
  printHtmlPage(report.title, body);
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

/** Adjust receivable from General voucher lines (debit ↑ receivable, credit ↓). */
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
  const purchasesToday = db.purchases.filter((p) => !p.returnedAt && p.createdAt.startsWith(today));
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
            // credit ↑ payable, debit ↓ payable
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
  const purchases = db.purchases.filter((p) => !p.returnedAt && inRange(p.createdAt));
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
    payablesPkr: db.purchases
      .filter((p) => !p.returnedAt)
      .reduce((a, p) => a + (p.remainingPkr || 0), 0),
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
  // Photos are permanent once saved — never overwrite existing images.
  const row: MobizoneCustomer = {
    id: existing?.id ?? newId(),
    name: input.name,
    cnic: input.cnic ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    photoDataUrl: existing?.photoDataUrl || input.photoDataUrl || null,
    cnicFrontDataUrl: existing?.cnicFrontDataUrl || input.cnicFrontDataUrl || null,
    cnicBackDataUrl: existing?.cnicBackDataUrl || input.cnicBackDataUrl || null,
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

/** Edit customer text fields only — photos stay locked. */
export function updateCustomerProfile(
  branchCode: string,
  customerId: string,
  input: {
    name: string;
    cnic?: string | null;
    phone?: string | null;
    address?: string | null;
  },
): MobizoneCustomer {
  const db = loadMobizoneDb(branchCode);
  const existing = db.customers.find((c) => c.id === customerId);
  if (!existing) throw new Error("Customer not found.");
  if (!input.name.trim()) throw new Error("Customer name is required.");
  const row: MobizoneCustomer = {
    ...existing,
    name: input.name.trim(),
    cnic: input.cnic?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    // Keep original photos — no replace / change.
    photoDataUrl: existing.photoDataUrl ?? null,
    cnicFrontDataUrl: existing.cnicFrontDataUrl ?? null,
    cnicBackDataUrl: existing.cnicBackDataUrl ?? null,
  };
  db.customers = db.customers.map((c) => (c.id === customerId ? row : c));
  saveMobizoneDb(branchCode, db);
  return row;
}

export function downloadDataUrlFile(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

/**
 * Normalize scanned sticker / wedge input.
 * Stickers often print `*3583…*` — strip stars/spaces so scan matches IMEI.
 */
export function normalizeImeiScan(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  // Support `*IMEI*`, `IMEI / 39`, and scanner wedges with junk around digits.
  const unwrapped = trimmed.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  const beforeSlash = unwrapped.split("/")[0]?.trim() ?? unwrapped;
  const imei15 = beforeSlash.match(/\b\d{15}\b/) || unwrapped.match(/\b\d{15}\b/);
  if (imei15) return imei15[0]!;
  const digits = beforeSlash.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 17) return digits;
  const allDigits = unwrapped.replace(/\D/g, "");
  if (allDigits.length >= 8 && allDigits.length <= 17) return allDigits;
  return beforeSlash;
}

/** Barcode value is always the IMEI so scan → same phone. */
export function deviceBarcodeValue(device: Pick<MobizoneDevice, "imei" | "barcode">): string {
  return (device.barcode || device.imei || "").trim() || device.imei;
}

export function findDeviceByImei(branchCode: string, imei: string): MobizoneDevice | undefined {
  const q = normalizeImeiScan(imei).toLowerCase();
  if (!q) return undefined;
  return loadMobizoneDb(branchCode).devices.find((d) => {
    const keys = [d.imei, d.imei2, d.barcode, deviceBarcodeValue(d)]
      .map((x) => normalizeImeiScan(x).toLowerCase())
      .filter(Boolean);
    return keys.includes(q);
  });
}

/** Display like sample: `358535130366352 / 52` (IMEI + last 2 digits). */
function formatImeiSampleLine(imei: string): string {
  const digits = normalizeImeiScan(imei) || imei.trim();
  if (!digits) return "";
  const tail = digits.length >= 2 ? digits.slice(-2) : digits;
  return `${digits} / ${tail}`;
}

/**
 * Small sticker window — sample layout:
 * IMEI1 → number → barcode (scanable)
 * IMEI2 → number → barcode (if present)
 * Product + shop
 */
export function printImeiBarcodeSticker(
  device: MobizoneDevice,
  opts?: { shopName?: string | null; copies?: number },
): void {
  const shop = (opts?.shopName ?? loadMobizoneReceiptSettings("MAIN").shopName ?? "MobiZone").trim() || "MobiZone";
  const imei1 = normalizeImeiScan(device.imei) || device.imei.trim();
  const imei2Raw = (device.imei2 ?? "").trim();
  const imei2 = imei2Raw ? normalizeImeiScan(imei2Raw) || imei2Raw : "";
  // Always barcode the primary IMEI digits (same value findDeviceByImei expects).
  const code1 = imei1;
  const code2 = imei2;
  const productLine = [device.brand, device.model, device.storage, device.etc, device.batteryHealth]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const copies = Math.max(1, Math.min(20, opts?.copies ?? 1));

  const labels = Array.from({ length: copies }, (_, i) => {
    const bc1 = `bc1_${i}`;
    const bc2 = `bc2_${i}`;
    return `<div class="label">
  <div class="imei-card">
    <div class="imei-title">IMEI1</div>
    <div class="imei-num">${escapeHtml(formatImeiSampleLine(imei1))}</div>
    <div class="imei-stars">*${escapeHtml(imei1)}*</div>
    <svg id="${bc1}" class="barcode"></svg>
  </div>
  ${
    code2
      ? `<div class="imei-card">
    <div class="imei-title">IMEI2</div>
    <div class="imei-num">${escapeHtml(formatImeiSampleLine(imei2))}</div>
    <div class="imei-stars">*${escapeHtml(imei2)}*</div>
    <svg id="${bc2}" class="barcode"></svg>
  </div>`
      : ""
  }
  <div class="meta">
    <div class="product">${escapeHtml(productLine)}</div>
    <div class="shop">${escapeHtml(shop)}</div>
  </div>
</div>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>IMEI sticker</title>
<style>
  @page { margin: 4mm; size: auto; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #27272a; color: #fff;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  }
  .toolbar {
    display: flex; gap: 8px; align-items: center; justify-content: space-between;
    padding: 10px 12px; background: #09090b; color: #fff;
  }
  .toolbar p { margin: 0; font: 12px/1.3 system-ui, sans-serif; opacity: .9; }
  .toolbar button {
    border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer;
    background: #14b8a6; color: #042f2e; font: 600 13px system-ui, sans-serif;
  }
  .toolbar button.secondary { background: #3f3f46; color: #fafafa; }
  .wrap { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .label {
    width: 320px; max-width: 92vw; background: #18181b; border: 1px solid #3f3f46;
    border-radius: 10px; padding: 14px 14px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }
  .imei-card { margin-bottom: 14px; }
  .imei-title {
    font: 700 13px/1.2 system-ui, sans-serif; letter-spacing: .04em;
    text-transform: uppercase; color: #fafafa; margin-bottom: 4px;
  }
  .imei-num {
    font: 700 15px/1.25 ui-monospace, Consolas, monospace;
    color: #fff; margin-bottom: 2px; word-break: break-all;
  }
  .imei-stars {
    font: 600 11px/1.2 ui-monospace, Consolas, monospace;
    color: #a1a1aa; margin-bottom: 8px;
  }
  .barcode {
    display: block; width: 100%; height: auto;
    background: #fff; padding: 8px 6px; border-radius: 4px;
  }
  .meta {
    border-top: 1px solid #3f3f46; padding-top: 10px; margin-top: 2px;
  }
  .product {
    font: 700 13px/1.25 system-ui, sans-serif; text-transform: uppercase; color: #fff;
  }
  .shop { font: 700 14px/1.3 Georgia, "Times New Roman", serif; color: #e4e4e7; margin-top: 4px; }
  @media print {
    html, body { background: #fff; color: #000; }
    .toolbar { display: none !important; }
    .wrap { padding: 0; }
    .label {
      width: 70mm; box-shadow: none; border: none; border-radius: 0;
      background: #fff; color: #000; padding: 2mm;
    }
    .imei-title, .imei-num, .product, .shop { color: #000; }
    .imei-stars { color: #333; }
    .barcode { padding: 2mm 1mm; }
    .meta { border-top: 1px solid #999; }
  }
</style></head><body>
  <div class="toolbar">
    <p>Sample sticker · scan barcode = IMEI number</p>
    <div style="display:flex;gap:8px">
      <button type="button" class="secondary" onclick="window.close()">Close</button>
      <button type="button" id="btnPrint" onclick="window.print()">Print sticker</button>
    </div>
  </div>
  <div class="wrap">${labels}</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
(function(){
  var code1 = ${JSON.stringify(code1)};
  var code2 = ${JSON.stringify(code2)};
  var n = ${copies};
  var status = document.querySelector(".toolbar p");

  function drawOne(id, value) {
    if (!value) return;
    // Prefer CODE128 (clean digits). Fallback CODE39 with *value* for older scanners.
    try {
      JsBarcode("#" + id, value, {
        format: "CODE128",
        width: 2.4,
        height: 64,
        displayValue: false,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000"
      });
      return;
    } catch (e1) {}
    try {
      JsBarcode("#" + id, value, {
        format: "CODE39",
        width: 1.8,
        height: 64,
        displayValue: false,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000"
      });
    } catch (e2) {
      if (status) status.textContent = "Barcode failed for " + value;
    }
  }

  function draw() {
    if (typeof JsBarcode !== "function") {
      setTimeout(draw, 50);
      return;
    }
    for (var i = 0; i < n; i++) {
      drawOne("bc1_" + i, code1);
      if (code2) drawOne("bc2_" + i, code2);
    }
    if (status) status.textContent = "Ready — scan barcode to open this mobile";
  }
  draw();
})();
<\/script>
</body></html>`;

  const popup = window.open(
    "",
    "mz_imei_sticker",
    "popup=yes,width=400,height=560,left=100,top=60,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes",
  );
  if (!popup) {
    window.alert("Popup blocked — allow popups for barcode sticker, then try again.");
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  try {
    popup.focus();
  } catch {
    // ignore
  }
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
  const customer = db.customers.find((c) => c.id === customerId);
  const nameKey = (customer?.name ?? "").trim().toLowerCase();
  const cnicKey = normalizeCnic(customer?.cnic);
  const phoneKey = digitsOnly(customer?.phone);
  const purchases = db.purchases.filter((p) => {
    if (p.customerId === customerId) return true;
    if (nameKey && (p.sellerName ?? "").toLowerCase().includes(nameKey)) return true;
    if (cnicKey && normalizeCnic(p.sellerCnic) === cnicKey) return true;
    if (phoneKey.length >= 7 && digitsOnly(p.sellerPhone) === phoneKey) return true;
    return false;
  });
  const sales = db.sales.filter((s) => {
    if (s.customerId === customerId) return true;
    if (nameKey && (s.customerName ?? "").toLowerCase().includes(nameKey)) return true;
    if (cnicKey && normalizeCnic(s.customerCnic) === cnicKey) return true;
    if (phoneKey.length >= 7 && digitsOnly(s.customerPhone) === phoneKey) return true;
    return false;
  });
  return {
    customer,
    purchases,
    sales,
    ledger: db.ledger.filter((e) => e.partyKind === "customer" && e.partyId === customerId),
  };
}

/** Person report by typed name / phone / CNIC (even if not linked by id). */
export function personReportByQuery(
  branchCode: string,
  query: string,
): {
  label: string;
  purchases: MobizonePurchase[];
  sales: MobizoneSale[];
  ledger: MobizoneLedgerEntry[];
  pendingPkr: number;
} {
  const raw = query.trim().toLowerCase();
  const cnicQ = normalizeCnic(query);
  const phoneQ = digitsOnly(query);
  const db = loadMobizoneDb(branchCode);
  const purchases = db.purchases.filter((p) => {
    if (raw && (p.sellerName ?? "").toLowerCase().includes(raw)) return true;
    if (cnicQ.length >= 5 && normalizeCnic(p.sellerCnic).includes(cnicQ)) return true;
    if (phoneQ.length >= 7 && digitsOnly(p.sellerPhone).includes(phoneQ)) return true;
    return false;
  });
  const sales = db.sales.filter((s) => {
    if (raw && (s.customerName ?? "").toLowerCase().includes(raw)) return true;
    if (cnicQ.length >= 5 && normalizeCnic(s.customerCnic).includes(cnicQ)) return true;
    if (phoneQ.length >= 7 && digitsOnly(s.customerPhone).includes(phoneQ)) return true;
    return false;
  });
  const ledger = db.ledger.filter((e) => {
    if (e.partyKind !== "customer") return false;
    if (raw && (e.partyName ?? "").toLowerCase().includes(raw)) return true;
    return false;
  });
  const pendingPkr = sales.reduce((s, x) => s + (x.remainingPkr || 0), 0);
  return {
    label: query.trim(),
    purchases,
    sales,
    ledger,
    pendingPkr,
  };
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function textBlob(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Match customers by name, phone, CNIC, or address (+ names seen on bills). */
export function searchCustomers(branchCode: string, query: string): MobizoneCustomer[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  const cnicQ = normalizeCnic(query);
  const phoneQ = digitsOnly(query);
  const db = loadMobizoneDb(branchCode);
  const byId = new Map<string, MobizoneCustomer>();

  for (const c of db.customers) {
    const hit =
      c.name.toLowerCase().includes(raw) ||
      (c.address ?? "").toLowerCase().includes(raw) ||
      (cnicQ.length >= 5 && normalizeCnic(c.cnic).includes(cnicQ)) ||
      (phoneQ.length >= 3 && digitsOnly(c.phone).includes(phoneQ));
    if (hit) byId.set(c.id, c);
  }

  // Also surface people who appear on buy/sell bills by name/phone/CNIC.
  for (const p of db.purchases) {
    const hit =
      (p.sellerName ?? "").toLowerCase().includes(raw) ||
      (cnicQ.length >= 5 && normalizeCnic(p.sellerCnic).includes(cnicQ)) ||
      (phoneQ.length >= 7 && digitsOnly(p.sellerPhone).includes(phoneQ));
    if (!hit) continue;
    if (p.customerId && db.customers.find((c) => c.id === p.customerId)) {
      byId.set(p.customerId, db.customers.find((c) => c.id === p.customerId)!);
    }
  }
  for (const s of db.sales) {
    const hit =
      (s.customerName ?? "").toLowerCase().includes(raw) ||
      (cnicQ.length >= 5 && normalizeCnic(s.customerCnic).includes(cnicQ)) ||
      (phoneQ.length >= 7 && digitsOnly(s.customerPhone).includes(phoneQ));
    if (!hit) continue;
    if (s.customerId && db.customers.find((c) => c.id === s.customerId)) {
      byId.set(s.customerId, db.customers.find((c) => c.id === s.customerId)!);
    }
  }

  return [...byId.values()];
}

/** Full buy/sell history for a mobile name (brand/model) or IMEI — not person names. */
export function productHistory(
  branchCode: string,
  query: string,
): {
  query: string;
  devices: MobizoneDevice[];
  purchases: MobizonePurchase[];
  sales: MobizoneSale[];
  boughtPkr: number;
  soldPkr: number;
  profitPkr: number;
} {
  const raw = query.trim().toLowerCase();
  if (!raw) {
    return { query: "", devices: [], purchases: [], sales: [], boughtPkr: 0, soldPkr: 0, profitPkr: 0 };
  }
  const db = loadMobizoneDb(branchCode);
  const devices = db.devices.filter((d) =>
    textBlob(
      d.imei,
      d.imei2,
      d.barcode,
      d.brand,
      d.model,
      d.colour,
      d.storage,
      d.etc,
      d.notes,
      d.batteryHealth,
    ).includes(raw),
  );
  const deviceIds = new Set(devices.map((d) => d.id));
  const imeis = new Set(devices.map((d) => d.imei.toLowerCase()));
  const purchases = db.purchases.filter(
    (p) =>
      deviceIds.has(p.deviceId) ||
      imeis.has(p.imei.toLowerCase()) ||
      textBlob(p.brand, p.model, p.imei, p.colour, p.storage, p.note).includes(raw),
  );
  const sales = db.sales.filter(
    (s) =>
      deviceIds.has(s.deviceId) ||
      imeis.has(s.imei.toLowerCase()) ||
      textBlob(s.brand, s.model, s.imei, s.colour, s.storage, s.note).includes(raw),
  );
  const boughtPkr = purchases.reduce((n, p) => n + (p.purchasePricePkr || 0), 0);
  const soldPkr = sales.filter((s) => !s.returnedAt).reduce((n, s) => n + (s.pricePkr || 0), 0);
  const profitPkr = sales.filter((s) => !s.returnedAt).reduce((n, s) => n + (s.profitPkr || 0), 0);
  return { query: query.trim(), devices, purchases, sales, boughtPkr, soldPkr, profitPkr };
}

export type UniversalSearchResult = {
  query: string;
  customers: MobizoneCustomer[];
  shopkeepers: MobizoneShopkeeper[];
  products: ReturnType<typeof productHistory>;
  imeiExact: ReturnType<typeof imeiHistory> | null;
  personByName: ReturnType<typeof personReportByQuery>;
  hasPersonHits: boolean;
  hasProductHits: boolean;
};

/** One box: person name → person report; mobile name → product report. */
export function universalSearch(branchCode: string, query: string): UniversalSearchResult {
  const q = query.trim();
  const customers = searchCustomers(branchCode, q);
  const raw = q.toLowerCase();
  const db = loadMobizoneDb(branchCode);
  const shopkeepers = db.shopkeepers.filter((s) =>
    textBlob(s.name, s.shopNo, s.phone, s.address, s.notes).includes(raw),
  );
  const products = productHistory(branchCode, q);
  const looksLikeImei = digitsOnly(q).length >= 8;
  const imeiExact = looksLikeImei ? imeiHistory(branchCode, q) : null;
  const personByName = personReportByQuery(branchCode, q);
  const hasPersonHits =
    customers.length > 0 ||
    shopkeepers.length > 0 ||
    personByName.purchases.length > 0 ||
    personByName.sales.length > 0 ||
    personByName.ledger.length > 0;
  const hasProductHits =
    products.devices.length > 0 ||
    products.purchases.length > 0 ||
    products.sales.length > 0 ||
    Boolean(imeiExact?.device) ||
    (imeiExact?.purchases.length ?? 0) > 0 ||
    (imeiExact?.sales.length ?? 0) > 0;
  return {
    query: q,
    customers,
    shopkeepers,
    products,
    imeiExact,
    personByName,
    hasPersonHits,
    hasProductHits,
  };
}

export function shopkeeperHistory(branchCode: string, shopkeeperId: string): {
  shopkeeper?: MobizoneShopkeeper;
  purchases: MobizonePurchase[];
  sales: MobizoneSale[];
  ledger: MobizoneLedgerEntry[];
  balancePkr: number;
} {
  const db = loadMobizoneDb(branchCode);
  return {
    shopkeeper: db.shopkeepers.find((s) => s.id === shopkeeperId),
    purchases: db.purchases.filter((p) => p.shopkeeperId === shopkeeperId),
    sales: db.sales.filter((s) => s.shopkeeperId === shopkeeperId),
    ledger: db.ledger.filter((e) => e.partyKind === "shopkeeper" && e.partyId === shopkeeperId),
    balancePkr: shopkeeperBalance(branchCode, shopkeeperId),
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
  // General voucher: credit ↑ we owe, debit ↓ we owe.
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
  otherPhotoDataUrl?: string | null;
  note?: string | null;
  shopkeeperId?: string | null;
  imei: string;
  imei2?: string | null;
  brand: string;
  model: string;
  colour?: string | null;
  storage?: string | null;
  batteryHealth?: string | null;
  /** Extra tags e.g. JV, Non PTA. */
  etc?: string | null;
  condition: "new" | "used";
  purchasePricePkr: number;
  salePricePkr?: number | null;
  payment: MobizoneSplitPayment;
  dueDate?: string | null;
  /** Bill / voucher date YYYY-MM-DD (defaults to today). */
  billDate?: string | null;
};

export function recordPurchase(branchCode: string, input: PurchaseInput): MobizonePurchase {
  const db = loadMobizoneDb(branchCode);
  const imei = input.imei.trim();
  assertBankAccountWhenNeeded(db, input.payment.bankPkr || 0, input.payment.bank?.bankAccountId);
  if (imeiClashInStock(db, imei, input.imei2)) {
    throw new Error("This IMEI is already in stock.");
  }
  const ts = billDateToIso(input.billDate);
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
  const noteText = input.note?.trim() ? input.note.trim() : null;
  const battery = input.batteryHealth?.trim() ? input.batteryHealth.trim() : null;
  const etcText = input.etc?.trim() ? input.etc.trim() : null;
  const device: MobizoneDevice = {
    id: newId(),
    imei,
    imei2: input.imei2 ?? null,
    brand: input.brand.trim(),
    model: input.model.trim(),
    colour: input.colour ?? null,
    storage: input.storage ?? null,
    batteryHealth: battery,
    etc: etcText,
    condition: input.condition,
    purchasePricePkr: input.purchasePricePkr,
    salePricePkr: input.salePricePkr ?? null,
    barcode: imei,
    status: "in_stock",
    shopkeeperId: input.shopkeeperId ?? null,
    notes: noteText,
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
    otherPhotoDataUrl: input.otherPhotoDataUrl ?? null,
    note: noteText,
    imei,
    brand: device.brand,
    model: device.model,
    colour: device.colour,
    storage: device.storage,
    batteryHealth: battery,
    etc: etcText,
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
    returnedAt: null,
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
  otherPhotoDataUrl?: string | null;
  note?: string | null;
  batteryHealth?: string | null;
  shopkeeperId?: string | null;
  pricePkr: number;
  payment: MobizoneSplitPayment;
  dueDate?: string | null;
  warrantyDays?: number;
  /** Bill / voucher date YYYY-MM-DD (defaults to today). */
  billDate?: string | null;
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
  const ts = billDateToIso(input.billDate);
  const bank = applyBankSnapshot(next, input.payment.bankPkr || 0, input.payment.bank);
  const saleNote = input.note?.trim() ? input.note.trim() : null;
  const battery =
    input.batteryHealth?.trim() || device.batteryHealth?.trim() || null;
  const etcText = device.etc?.trim() || null;
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
    otherPhotoDataUrl: input.otherPhotoDataUrl ?? null,
    note: saleNote,
    batteryHealth: battery,
    etc: etcText,
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
      ? {
          ...d,
          status: "sold" as const,
          salePricePkr: input.pricePkr,
          batteryHealth: battery,
          notes: saleNote
            ? d.notes
              ? `${d.notes} · Sale: ${saleNote}`
              : `Sale: ${saleNote}`
            : d.notes,
          updatedAt: ts,
        }
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

/** Return a purchased phone to seller (remove from stock, reverse paid amount). */
export function returnPurchase(
  branchCode: string,
  purchaseId: string,
  reason?: string,
): MobizonePurchase {
  const db = loadMobizoneDb(branchCode);
  const purchase = db.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.returnedAt) throw new Error("Purchase already returned.");
  const device = db.devices.find((d) => d.id === purchase.deviceId);
  if (!device) throw new Error("Device missing for this purchase.");
  if (device.status !== "in_stock") {
    throw new Error("Phone already sold — do a sale return first, then purchase return.");
  }
  const ts = nowIso();
  const note = `Purchase return ${purchase.imei}${reason ? ` — ${reason}` : ""}`;
  const partyKind = purchase.shopkeeperId ? ("shopkeeper" as const) : ("customer" as const);
  const partyId = (purchase.shopkeeperId ?? purchase.customerId) as string;
  const refundRows: MobizoneLedgerEntry[] = [];
  const cashBack = purchase.payment.cashPkr || 0;
  const bankBack = purchase.payment.bankPkr || 0;
  if (cashBack > 0 && partyId) {
    refundRows.push({
      id: newId(),
      partyKind,
      partyId,
      partyName: purchase.sellerName,
      direction: "receive",
      amountPkr: cashBack,
      method: "cash",
      bankAccountId: null,
      bankName: null,
      txnRef: null,
      note,
      relatedSaleId: null,
      relatedPurchaseId: purchase.id,
      createdAt: ts,
    });
  }
  if (bankBack > 0 && partyId) {
    refundRows.push({
      id: newId(),
      partyKind,
      partyId,
      partyName: purchase.sellerName,
      direction: "receive",
      amountPkr: bankBack,
      method: "bank",
      bankAccountId: purchase.payment.bank?.bankAccountId ?? null,
      bankName: purchase.payment.bank?.bankName ?? null,
      txnRef: purchase.payment.bank?.txnRef ?? null,
      note,
      relatedSaleId: null,
      relatedPurchaseId: purchase.id,
      createdAt: ts,
    });
  }
  db.purchases = db.purchases.map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          returnedAt: ts,
          paidPkr: 0,
          remainingPkr: 0,
          payment: { cashPkr: 0, bankPkr: 0, bankLabel: null, bank: undefined },
        }
      : p,
  );
  db.devices = db.devices.filter((d) => d.id !== purchase.deviceId);
  if (refundRows.length > 0) {
    db.ledger = [...refundRows, ...db.ledger];
  }
  saveMobizoneDb(branchCode, db);
  return db.purchases.find((p) => p.id === purchaseId)!;
}

function isPrimarySaleLedgerNote(note: string | null | undefined): boolean {
  const n = (note ?? "").trim().toLowerCase();
  return n.startsWith("sale ") && !n.startsWith("sale return");
}

function isPrimaryPurchaseLedgerNote(note: string | null | undefined): boolean {
  const n = (note ?? "").trim().toLowerCase();
  return n.startsWith("purchase ") && !n.startsWith("purchase return");
}

export type UpdateSaleInput = {
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerCnic?: string | null;
  note?: string | null;
  brand?: string;
  model?: string;
  pricePkr: number;
  payment: MobizoneSplitPayment;
  dueDate?: string | null;
  warrantyDays?: number;
};

/** Edit an existing sale voucher (party, price, payment, note). */
export function updateSale(branchCode: string, saleId: string, input: UpdateSaleInput): MobizoneSale {
  const db = loadMobizoneDb(branchCode);
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) throw new Error("Sale not found.");
  if (sale.returnedAt) throw new Error("Returned sales cannot be edited.");
  if (!input.customerName.trim()) throw new Error("Customer name required.");
  if (!(input.pricePkr > 0)) throw new Error("Sale price must be greater than zero.");
  assertBankAccountWhenNeeded(db, input.payment.bankPkr || 0, input.payment.bank?.bankAccountId);
  const received = sumPayment(input.payment);
  if (received > input.pricePkr + 0.01) {
    throw new Error("Received amount cannot exceed sale price.");
  }
  const remaining = Math.max(0, input.pricePkr - received);
  const bank = applyBankSnapshot(db, input.payment.bankPkr || 0, input.payment.bank);
  const brand = (input.brand ?? sale.brand).trim() || sale.brand;
  const model = (input.model ?? sale.model).trim() || sale.model;
  const note = input.note?.trim() ? input.note.trim() : null;
  const ts = nowIso();

  db.ledger = db.ledger.filter(
    (e) => !(e.relatedSaleId === saleId && isPrimarySaleLedgerNote(e.note)),
  );

  const partyKind = sale.shopkeeperId ? ("shopkeeper" as const) : ("customer" as const);
  const partyId = (sale.shopkeeperId ?? sale.customerId) as string;
  const partyName = input.customerName.trim();
  const ledgerNote = `Sale ${brand} ${model} (${sale.imei})`;
  if ((input.payment.cashPkr || 0) > 0 && partyId) {
    db.ledger = [
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
        note: ledgerNote,
        relatedSaleId: saleId,
        relatedPurchaseId: null,
        createdAt: sale.createdAt,
      },
      ...db.ledger,
    ];
  }
  if ((input.payment.bankPkr || 0) > 0 && partyId) {
    db.ledger = [
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
        note: ledgerNote,
        relatedSaleId: saleId,
        relatedPurchaseId: null,
        createdAt: sale.createdAt,
      },
      ...db.ledger,
    ];
  }

  db.sales = db.sales.map((s) =>
    s.id === saleId
      ? {
          ...s,
          customerName: partyName,
          customerPhone: input.customerPhone?.trim() || null,
          customerAddress: input.customerAddress?.trim() || null,
          customerCnic: input.customerCnic?.trim() || null,
          note,
          brand,
          model,
          pricePkr: input.pricePkr,
          receivedPkr: received,
          remainingPkr: remaining,
          dueDate: remaining > 0 ? input.dueDate ?? null : null,
          warrantyDays: Math.max(0, Math.floor(input.warrantyDays ?? s.warrantyDays ?? 0)),
          payment: {
            cashPkr: input.payment.cashPkr || 0,
            bankPkr: input.payment.bankPkr || 0,
            bankLabel: input.payment.bankLabel ?? null,
            bank,
          },
          profitPkr: input.pricePkr - s.costPkr,
        }
      : s,
  );

  db.devices = db.devices.map((d) =>
    d.id === sale.deviceId
      ? {
          ...d,
          brand,
          model,
          salePricePkr: input.pricePkr,
          updatedAt: ts,
        }
      : d,
  );

  if (sale.customerId) {
    db.customers = db.customers.map((c) =>
      c.id === sale.customerId
        ? {
            ...c,
            name: partyName,
            phone: input.customerPhone?.trim() || c.phone,
            address: input.customerAddress?.trim() || c.address,
            cnic: input.customerCnic?.trim() || c.cnic,
          }
        : c,
    );
    recomputeCustomerPending(db, sale.customerId);
  }

  saveMobizoneDb(branchCode, db);
  return db.sales.find((s) => s.id === saleId)!;
}

export type UpdatePurchaseInput = {
  sellerName: string;
  sellerCnic?: string | null;
  sellerPhone?: string | null;
  sellerAddress?: string | null;
  note?: string | null;
  brand: string;
  model: string;
  colour?: string | null;
  storage?: string | null;
  batteryHealth?: string | null;
  imei?: string;
  purchasePricePkr: number;
  payment: MobizoneSplitPayment;
  dueDate?: string | null;
};

/** Edit an existing purchase voucher (seller, device, price, payment, note). */
export function updatePurchase(
  branchCode: string,
  purchaseId: string,
  input: UpdatePurchaseInput,
): MobizonePurchase {
  const db = loadMobizoneDb(branchCode);
  const purchase = db.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.returnedAt) throw new Error("Returned purchases cannot be edited.");
  if (!input.sellerName.trim()) throw new Error("Seller name required.");
  if (!(input.purchasePricePkr > 0)) throw new Error("Purchase price must be greater than zero.");
  const brand = input.brand.trim();
  const model = input.model.trim();
  if (!brand || !model) throw new Error("Brand and model are required.");
  assertBankAccountWhenNeeded(db, input.payment.bankPkr || 0, input.payment.bank?.bankAccountId);
  const paid = sumPayment(input.payment);
  if (paid > input.purchasePricePkr + 0.01) {
    throw new Error("Paid amount cannot exceed purchase price.");
  }
  const remaining = Math.max(0, input.purchasePricePkr - paid);
  const bank = applyBankSnapshot(db, input.payment.bankPkr || 0, input.payment.bank);
  const imei = (input.imei ?? purchase.imei).trim() || purchase.imei;
  const note = input.note?.trim() ? input.note.trim() : null;
  const battery = input.batteryHealth?.trim() ? input.batteryHealth.trim() : null;

  if (imei.toLowerCase() !== purchase.imei.toLowerCase()) {
    const clash = db.devices.some(
      (d) =>
        d.id !== purchase.deviceId &&
        d.status === "in_stock" &&
        [d.imei, d.imei2, d.barcode].some((x) => (x ?? "").trim().toLowerCase() === imei.toLowerCase()),
    );
    if (clash) throw new Error("This IMEI is already in stock on another phone.");
  }

  db.ledger = db.ledger.filter(
    (e) => !(e.relatedPurchaseId === purchaseId && isPrimaryPurchaseLedgerNote(e.note)),
  );

  const partyKind = purchase.shopkeeperId ? ("shopkeeper" as const) : ("customer" as const);
  const partyId = (purchase.shopkeeperId ?? purchase.customerId) as string;
  const partyName = input.sellerName.trim();
  const ledgerNote = `Purchase ${brand} ${model} (${imei})`;
  if ((input.payment.cashPkr || 0) > 0 && partyId) {
    db.ledger = [
      {
        id: newId(),
        partyKind,
        partyId,
        partyName,
        direction: "pay",
        amountPkr: input.payment.cashPkr || 0,
        method: "cash",
        bankAccountId: null,
        bankName: null,
        txnRef: null,
        note: ledgerNote,
        relatedSaleId: null,
        relatedPurchaseId: purchaseId,
        createdAt: purchase.createdAt,
      },
      ...db.ledger,
    ];
  }
  if ((input.payment.bankPkr || 0) > 0 && partyId) {
    db.ledger = [
      {
        id: newId(),
        partyKind,
        partyId,
        partyName,
        direction: "pay",
        amountPkr: input.payment.bankPkr || 0,
        method: "bank",
        bankAccountId: bank?.bankAccountId ?? null,
        bankName: bank?.bankName ?? null,
        txnRef: bank?.txnRef ?? null,
        note: ledgerNote,
        relatedSaleId: null,
        relatedPurchaseId: purchaseId,
        createdAt: purchase.createdAt,
      },
      ...db.ledger,
    ];
  }

  db.purchases = db.purchases.map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          sellerName: partyName,
          sellerCnic: input.sellerCnic?.trim() || null,
          sellerPhone: input.sellerPhone?.trim() || null,
          sellerAddress: input.sellerAddress?.trim() || null,
          note,
          brand,
          model,
          colour: input.colour?.trim() || null,
          storage: input.storage?.trim() || null,
          batteryHealth: battery,
          imei,
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
        }
      : p,
  );

  db.devices = db.devices.map((d) =>
    d.id === purchase.deviceId
      ? {
          ...d,
          brand,
          model,
          colour: input.colour?.trim() || null,
          storage: input.storage?.trim() || null,
          batteryHealth: battery,
          notes: note,
          imei,
          barcode: imei,
          purchasePricePkr: input.purchasePricePkr,
          updatedAt: nowIso(),
        }
      : d,
  );

  if (purchase.customerId) {
    db.customers = db.customers.map((c) =>
      c.id === purchase.customerId
        ? {
            ...c,
            name: partyName,
            phone: input.sellerPhone?.trim() || c.phone,
            address: input.sellerAddress?.trim() || c.address,
            cnic: input.sellerCnic?.trim() || c.cnic,
          }
        : c,
    );
  }

  saveMobizoneDb(branchCode, db);
  return db.purchases.find((p) => p.id === purchaseId)!;
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
    : [row, ...db.expenseAccounts];
  saveMobizoneDb(branchCode, db);
  return row;
}

/** Seed common expense accounts once (Rent, Electricity, Food…). */
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
    /** Preferred: select expense account — title becomes the account name. */
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

export type MoneyAccountRef =
  | { kind: "cash" }
  | { kind: "bank"; accountId: string };

function resolveMoneyAccountName(db: MobizoneDb, ref: MoneyAccountRef): string {
  if (ref.kind === "cash") return "Cash on hand";
  const acc = db.bankAccounts.find((a) => a.id === ref.accountId);
  if (!acc) throw new Error("Bank account not found.");
  return bankLedgerName(acc);
}

function assertBalancedLines(lines: MobizoneVoucherLine[]): void {
  const debit = lines.filter((l) => l.side === "debit").reduce((a, l) => a + l.amountPkr, 0);
  const credit = lines.filter((l) => l.side === "credit").reduce((a, l) => a + l.amountPkr, 0);
  if (Math.abs(debit - credit) > 0.001) {
    throw new Error(`Voucher must balance (debit ${debit} ≠ credit ${credit}).`);
  }
  if (!(debit > 0)) throw new Error("Amount must be greater than zero.");
}

function touchCustomerPendingFromVoucher(db: MobizoneDb, lines: MobizoneVoucherLine[]): void {
  const ids = new Set(
    lines.filter((l) => l.accountKind === "customer" && l.accountId).map((l) => l.accountId!),
  );
  for (const id of ids) recomputeCustomerPending(db, id);
}

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

/** Cash ↔ Bank transfer (Contra Entry). */
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
  if (input.from.kind === "bank" && !input.from.accountId) {
    throw new Error("Select the bank account money leaves.");
  }
  if (input.to.kind === "bank" && !input.to.accountId) {
    throw new Error("Select the bank account money enters.");
  }
  const db = loadMobizoneDb(branchCode);
  if (input.from.kind === "bank") {
    assertBankAccountWhenNeeded(db, input.amountPkr, input.from.accountId);
  }
  if (input.to.kind === "bank") {
    assertBankAccountWhenNeeded(db, input.amountPkr, input.to.accountId);
  }
  const fromName = resolveMoneyAccountName(db, input.from);
  const toName = resolveMoneyAccountName(db, input.to);
  const amount = input.amountPkr;
  const lines: MobizoneVoucherLine[] = [
    {
      accountKind: input.from.kind,
      accountId: input.from.kind === "bank" ? input.from.accountId : null,
      accountName: fromName,
      side: "credit",
      amountPkr: amount,
    },
    {
      accountKind: input.to.kind,
      accountId: input.to.kind === "bank" ? input.to.accountId : null,
      accountName: toName,
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

/** Double-entry General Voucher across cash, bank, customers, suppliers, expenses. */
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
  touchCustomerPendingFromVoucher(db, lines);
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
    /** YYYY-MM-DD; defaults to today when omitted/invalid. */
    entryDate?: string | null;
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
  const ts = billDateToIso(input.entryDate);
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
    sale.note ? `Note: ${sale.note}` : null,
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
    `Remaining (credit): ${formatPkr(purchase.remainingPkr || 0)}`,
    purchase.dueDate ? `Due: ${purchase.dueDate}` : null,
    `Cash: ${formatPkr(purchase.payment.cashPkr || 0)}`,
    `Bank: ${formatPkr(purchase.payment.bankPkr || 0)}`,
    purchase.note ? `Note: ${purchase.note}` : null,
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

function enrichSaleCustomer(
  sale: MobizoneSale,
  branchCode?: string | null,
): MobizoneSale {
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

function enrichPurchaseSeller(
  purchase: MobizonePurchase,
  branchCode?: string | null,
): MobizonePurchase {
  if (!branchCode || !purchase.customerId) return purchase;
  const customer = loadMobizoneDb(branchCode).customers.find((c) => c.id === purchase.customerId);
  if (!customer) return purchase;
  return {
    ...purchase,
    sellerName: purchase.sellerName || customer.name,
    sellerPhone: purchase.sellerPhone || customer.phone || null,
    sellerAddress: purchase.sellerAddress || customer.address || null,
    sellerCnic: purchase.sellerCnic || customer.cnic || null,
    // Keep purchase photos first; fall back to customer KYC for legal proof.
    sellerPhotoDataUrl: purchase.sellerPhotoDataUrl || customer.photoDataUrl || null,
    cnicFrontDataUrl: purchase.cnicFrontDataUrl || customer.cnicFrontDataUrl || null,
    cnicBackDataUrl: purchase.cnicBackDataUrl || customer.cnicBackDataUrl || null,
  };
}

export type LegalPurchaseRecord = {
  purchase: MobizonePurchase;
  device?: MobizoneDevice;
  sale?: MobizoneSale;
  completeness: {
    hasPhone: boolean;
    hasCnic: boolean;
    hasSellerPhoto: boolean;
    hasCnicFront: boolean;
    hasCnicBack: boolean;
    score: number;
  };
};

/** Find purchase + seller KYC for legal verification by IMEI or seller identity. */
export function findLegalPurchaseRecords(branchCode: string, query: string): LegalPurchaseRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const imeiQ = normalizeImeiScan(query).toLowerCase();
  const cnicQ = normalizeCnic(query);
  const phoneQ = digitsOnly(query);
  const db = loadMobizoneDb(branchCode);

  const matched = db.purchases.filter((p) => {
    const enriched = enrichPurchaseSeller(p, branchCode);
    if (imeiQ && (normalizeImeiScan(p.imei).toLowerCase() === imeiQ || p.imei.toLowerCase().includes(q))) {
      return true;
    }
    if ((enriched.sellerName ?? "").toLowerCase().includes(q)) return true;
    if (cnicQ.length >= 5 && normalizeCnic(enriched.sellerCnic).includes(cnicQ)) return true;
    if (phoneQ.length >= 7 && digitsOnly(enriched.sellerPhone).includes(phoneQ)) return true;
    if ((enriched.sellerAddress ?? "").toLowerCase().includes(q)) return true;
    return false;
  });

  return matched
    .map((p) => {
      const purchase = enrichPurchaseSeller(p, branchCode);
      const device = db.devices.find((d) => d.id === p.deviceId);
      const sale = db.sales.find((s) => s.deviceId === p.deviceId && !s.returnedAt);
      const hasPhone = Boolean((purchase.sellerPhone ?? "").trim());
      const hasCnic = Boolean((purchase.sellerCnic ?? "").trim());
      const hasSellerPhoto = Boolean(purchase.sellerPhotoDataUrl);
      const hasCnicFront = Boolean(purchase.cnicFrontDataUrl);
      const hasCnicBack = Boolean(purchase.cnicBackDataUrl);
      const score = [hasPhone, hasCnic, hasSellerPhoto, hasCnicFront, hasCnicBack].filter(Boolean).length;
      return {
        purchase,
        device,
        sale,
        completeness: { hasPhone, hasCnic, hasSellerPhoto, hasCnicFront, hasCnicBack, score },
      };
    })
    .sort((a, b) => b.purchase.createdAt.localeCompare(a.purchase.createdAt));
}

/** Full printable dossier: purchase invoice + seller identity photos. */
export function printLegalPurchaseDossier(
  branchCode: string,
  purchaseId: string,
): void {
  const db = loadMobizoneDb(branchCode);
  const raw = db.purchases.find((p) => p.id === purchaseId);
  if (!raw) throw new Error("Purchase invoice not found.");
  const purchase = enrichPurchaseSeller(raw, branchCode);
  const device = db.devices.find((d) => d.id === purchase.deviceId);
  const sale = db.sales.find((s) => s.deviceId === purchase.deviceId && !s.returnedAt);
  const settings = loadMobizoneReceiptSettings(branchCode);
  const shop = settings.shopName || "MobiZone";

  const img = (src: string | null | undefined, label: string) =>
    src
      ? `<div class="photo"><img src="${src}" alt="${escapeHtml(label)}"/><p>${escapeHtml(label)}</p></div>`
      : `<div class="photo missing"><p>${escapeHtml(label)} — NOT ON FILE</p></div>`;

  const body = `
<style>
  body{font-family:system-ui,Segoe UI,sans-serif;color:#111;padding:16px;max-width:800px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:15px;margin:18px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
  .sub{color:#444;font-size:12px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f4f4f5;width:32%}
  .photos{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
  .photo{width:220px}
  .photo img{width:100%;height:160px;object-fit:cover;border:1px solid #999;background:#fff}
  .photo p{margin:4px 0 0;font-size:11px;font-weight:700}
  .photo.missing{border:1px dashed #b91c1c;padding:24px 8px;text-align:center;color:#b91c1c;font-size:12px;font-weight:700}
  .stamp{margin-top:20px;font-size:11px;color:#333;border-top:1px solid #999;padding-top:8px}
  @media print{body{padding:0} .noprint{display:none}}
</style>
<h1>Legal purchase record</h1>
<p class="sub">${escapeHtml(shop)} · Generated ${escapeHtml(new Date().toLocaleString())}</p>

<h2>1. Purchase invoice</h2>
<table>
  <tr><th>Bill #</th><td>${escapeHtml(purchase.id.slice(0, 8).toUpperCase())}</td></tr>
  <tr><th>Purchase date</th><td>${escapeHtml(new Date(purchase.createdAt).toLocaleString())}</td></tr>
  <tr><th>Device</th><td>${escapeHtml(`${purchase.brand} ${purchase.model}`)}${purchase.storage ? ` · ${escapeHtml(purchase.storage)}` : ""}${purchase.etc ? ` · ${escapeHtml(purchase.etc)}` : ""}</td></tr>
  <tr><th>IMEI 1</th><td style="font-family:monospace">${escapeHtml(purchase.imei)}</td></tr>
  <tr><th>IMEI 2</th><td style="font-family:monospace">${escapeHtml(device?.imei2 || "—")}</td></tr>
  <tr><th>Colour / condition</th><td>${escapeHtml([purchase.colour, purchase.condition].filter(Boolean).join(" · ") || "—")}</td></tr>
  <tr><th>Battery / etc</th><td>${escapeHtml([purchase.batteryHealth, purchase.etc].filter(Boolean).join(" · ") || "—")}</td></tr>
  <tr><th>Purchase price</th><td>${escapeHtml(formatPkr(purchase.purchasePricePkr))}</td></tr>
  <tr><th>Paid / credit</th><td>${escapeHtml(formatPkr(purchase.paidPkr || 0))} paid · ${escapeHtml(formatPkr(purchase.remainingPkr || 0))} credit</td></tr>
  <tr><th>Cash / bank</th><td>Cash ${escapeHtml(formatPkr(purchase.payment.cashPkr || 0))} · Bank ${escapeHtml(formatPkr(purchase.payment.bankPkr || 0))}</td></tr>
  <tr><th>Note</th><td>${escapeHtml(purchase.note || "—")}</td></tr>
  <tr><th>Stock status now</th><td>${escapeHtml(device?.status?.replace("_", " ") || "—")}${sale ? ` · Sold to ${escapeHtml(sale.customerName)} on ${escapeHtml(new Date(sale.createdAt).toLocaleDateString())}` : ""}</td></tr>
</table>

<h2>2. Seller identity (who sold this phone to the shop)</h2>
<table>
  <tr><th>Full name</th><td>${escapeHtml(purchase.sellerName)}</td></tr>
  <tr><th>Mobile number</th><td>${escapeHtml(purchase.sellerPhone || "— NOT ON FILE —")}</td></tr>
  <tr><th>CNIC / ID</th><td>${escapeHtml(purchase.sellerCnic || "— NOT ON FILE —")}</td></tr>
  <tr><th>Address</th><td>${escapeHtml(purchase.sellerAddress || "—")}</td></tr>
</table>

<h2>3. Seller photo & CNIC copies (proof)</h2>
<div class="photos">
  ${img(purchase.sellerPhotoDataUrl, "Seller photo")}
  ${img(purchase.cnicFrontDataUrl, "CNIC front")}
  ${img(purchase.cnicBackDataUrl, "CNIC back")}
</div>

<p class="stamp">
  This record is produced from ${escapeHtml(shop)} purchase books for verification of the person who sold the above device to the shop.
  Photos and CNIC images were captured / attached at purchase time (or customer KYC on file).
</p>`;

  printHtmlPage(`Legal record · ${purchase.imei}`, body);
}

/** Restaurant-style thermal receipt helpers (dashed lines, mono, left/right rows). */
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
  .rcpt{max-width:${width}px;margin:0 auto;font-family:ui-monospace,"Cascadia Mono","Courier New",monospace;font-size:12px;color:#0f172a;line-height:1.4;padding:6px 4px}
  .rcpt .brand{text-align:center;padding:4px 0 6px;border-bottom:2px solid #0f172a;margin-bottom:6px}
  .rcpt .shop{font-size:17px;font-weight:800;margin:0;letter-spacing:.04em;text-transform:uppercase}
  .rcpt .sub{text-align:center;font-size:11px;margin:2px 0;color:#334155}
  .rcpt .title{text-align:center;font-size:12px;font-weight:800;margin:8px 0 2px;letter-spacing:.12em;text-transform:uppercase}
  .rcpt .pill{display:inline-block;border:1px solid #0f172a;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;margin:4px 0}
  .rcpt .dash{text-align:center;letter-spacing:1px;margin:6px 0;color:#64748b;white-space:pre;overflow:hidden}
  .rcpt .sec{font-size:10px;font-weight:800;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.08em;color:#0f766e}
  .rcpt .kv{display:flex;justify-content:space-between;gap:10px;margin:2px 0}
  .rcpt .kv span:first-child{color:#475569}
  .rcpt .kv span:last-child{text-align:right;font-weight:700;color:#0f172a}
  .rcpt .item{margin:4px 0;padding:4px 0}
  .rcpt .item .name{font-weight:800}
  .rcpt .item .meta{font-size:11px;color:#475569}
  .rcpt .totalbox{margin-top:8px;padding:8px 0;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a}
  .rcpt .totalbox .kv span{font-size:14px;font-weight:800;color:#0f172a}
  .rcpt .foot{text-align:center;margin-top:10px;font-size:11px;color:#334155}
  .rcpt .wa{text-align:center;margin-top:4px;font-size:10px;color:#0f766e;font-weight:700}
  .rcpt .cut{text-align:center;margin-top:8px;font-size:10px;color:#94a3b8}
</style>
<div class="rcpt">${body}</div>`;
}

/** Restaurant-style sale bill — customer block always on. */
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
  const deviceLabel = `${enriched.brand} ${enriched.model}${enriched.etc ? ` ${enriched.etc}` : ""}`;
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
    ${enriched.etc ? `<div class="meta">Etc: ${escapeHtml(enriched.etc)}</div>` : ""}
    ${f.warranty && enriched.warrantyDays ? `<div class="meta">Warranty: ${enriched.warrantyDays} days</div>` : ""}
    <div class="meta">Qty: 1</div>
  </div>
  ${dash}
  <div class="sec">Payment</div>
  ${f.salePrice ? thermalKv("Subtotal", formatPkr(enriched.pricePkr)) : ""}
  ${f.cash ? thermalKv("Cash", formatPkr(enriched.payment.cashPkr || 0)) : ""}
  ${f.bank ? thermalKv("Bank", formatPkr(enriched.payment.bankPkr || 0)) : ""}
  ${f.bankDetails && bank?.bankName ? thermalKv("Bank name", bank.bankName) : ""}
  ${f.bankDetails && bank?.accountTitle ? thermalKv("Account", bank.accountTitle) : ""}
  ${f.bankDetails && bank?.txnRef ? thermalKv("Txn ref", bank.txnRef) : ""}
  ${thermalKv("Received", formatPkr(received))}
  ${f.remaining ? thermalKv("Remaining / Credit", formatPkr(enriched.remainingPkr)) : ""}
  ${f.dueDate && enriched.dueDate ? thermalKv("Due date", enriched.dueDate) : ""}
  ${enriched.note ? `${dash}<div class="sec">Note</div><p class="sub" style="text-align:left;white-space:pre-wrap">${escapeHtml(enriched.note)}</p>` : ""}
  ${f.salePrice ? `<div class="totalbox">${thermalKv("TOTAL", formatPkr(enriched.pricePkr))}</div>` : ""}
  ${f.footer && settings.footerText ? `<p class="foot">${escapeHtml(settings.footerText)}</p>` : `<p class="foot">Thank you — visit again</p>`}
  ${wa ? `<p class="wa">WhatsApp ${escapeHtml(wa)}</p>` : ""}
  <p class="cut">— ${escapeHtml(settings.shopName || "MobiZone")} —</p>`;
  return thermalShell(width, body);
}

/** Restaurant-style purchase bill — seller details always on. */
export function buildPurchaseReceiptHtml(
  purchase: MobizonePurchase,
  branchCode?: string | null,
  settingsOverride?: MobizoneReceiptSettings,
): string {
  const settings = resolveReceiptSettings(branchCode, settingsOverride);
  const f = settings.fields;
  const enriched = enrichPurchaseSeller(purchase, branchCode);
  const width = settings.paperWidthMm === 58 ? 280 : 360;
  const dash = thermalDash(width);
  const deviceLabel = `${enriched.brand} ${enriched.model}${enriched.storage ? ` ${enriched.storage}` : ""}${enriched.etc ? ` ${enriched.etc}` : ""}`;
  const wa = (settings.whatsappNumber || settings.shopPhone || "").trim();
  const body = `
  <div class="brand">
    ${f.shopName ? `<p class="shop">${escapeHtml(settings.shopName)}</p>` : ""}
    ${f.shopPhone && settings.shopPhone ? `<p class="sub">Tel ${escapeHtml(settings.shopPhone)}</p>` : ""}
    ${f.shopAddress && settings.shopAddress ? `<p class="sub">${escapeHtml(settings.shopAddress)}</p>` : ""}
  </div>
  <p class="title">${escapeHtml((settings.documentTitle || "Sale Receipt").replace(/Sale/i, "Purchase"))}</p>
  <div style="text-align:center"><span class="pill">BILL ${escapeHtml(enriched.id.slice(0, 8).toUpperCase())}</span></div>
  ${f.timestamp ? `<p class="sub">${escapeHtml(new Date(enriched.createdAt).toLocaleString())}</p>` : ""}
  ${dash}
  ${thermalPartyBlock("Seller", {
    name: enriched.sellerName,
    phone: enriched.sellerPhone,
    cnic: enriched.sellerCnic,
    address: enriched.sellerAddress,
  })}
  ${dash}
  <div class="sec">Items</div>
  <div class="item">
    <div class="kv"><span class="name">${escapeHtml(f.device ? deviceLabel : "Device")}</span><span>${escapeHtml(f.salePrice ? formatPkr(enriched.purchasePricePkr) : "")}</span></div>
    ${f.imei ? `<div class="meta">IMEI: ${escapeHtml(enriched.imei)}</div>` : ""}
    ${enriched.etc ? `<div class="meta">Etc: ${escapeHtml(enriched.etc)}</div>` : ""}
    ${f.device && enriched.condition ? `<div class="meta">Condition: ${escapeHtml(enriched.condition)}</div>` : ""}
    <div class="meta">Qty: 1</div>
  </div>
  ${dash}
  <div class="sec">Payment</div>
  ${f.salePrice ? thermalKv("Purchase", formatPkr(enriched.purchasePricePkr)) : ""}
  ${f.salePrice ? thermalKv("Paid", formatPkr(enriched.paidPkr || 0)) : ""}
  ${f.cash ? thermalKv("Cash", formatPkr(enriched.payment.cashPkr || 0)) : ""}
  ${f.bank ? thermalKv("Bank", formatPkr(enriched.payment.bankPkr || 0)) : ""}
  ${f.remaining ? thermalKv("Remaining / Credit", formatPkr(enriched.remainingPkr || 0)) : ""}
  ${f.dueDate && enriched.dueDate ? thermalKv("Due date", enriched.dueDate) : ""}
  ${enriched.note ? `${dash}<div class="sec">Note</div><p class="sub" style="text-align:left;white-space:pre-wrap">${escapeHtml(enriched.note)}</p>` : ""}
  ${f.salePrice ? `<div class="totalbox">${thermalKv("TOTAL", formatPkr(enriched.purchasePricePkr))}</div>` : ""}
  ${f.footer && settings.footerText ? `<p class="foot">${escapeHtml(settings.footerText)}</p>` : `<p class="foot">Thank you</p>`}
  ${wa ? `<p class="wa">WhatsApp ${escapeHtml(wa)}</p>` : ""}
  <p class="cut">— ${escapeHtml(settings.shopName || "MobiZone")} —</p>`;
  return thermalShell(width, body);
}

export function printSaleReceipt(sale: MobizoneSale, branchCode?: string | null): void {
  printHtmlPage("MobiZone Sale Receipt", buildSaleReceiptHtml(sale, branchCode));
}

export function printPurchaseReceipt(purchase: MobizonePurchase, branchCode?: string | null): void {
  printHtmlPage("MobiZone Purchase Receipt", buildPurchaseReceiptHtml(purchase, branchCode));
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
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Reliable bill print for desktop/web.
 * `window.open(..., "noopener")` returns null (silent no-print) — use iframe instead.
 */
export function printHtmlPage(title: string, bodyHtml: string): void {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  html,body{margin:0;padding:0;background:#fff;color:#111}
  body{font-family:"Courier New",Courier,monospace;padding:12px}
  @media print{body{padding:0}}
</style></head><body>
${bodyHtml}
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!win || !doc) {
    document.body.removeChild(iframe);
    // Last-resort popup without noopener so we keep a window handle.
    const popup = window.open("", "_blank", "width=480,height=900");
    if (!popup) {
      window.alert("Print blocked — allow popups, or try again.");
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      try {
        popup.print();
      } catch {
        // ignore
      }
    }, 350);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const cleanup = () => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {
      // ignore
    }
  };

  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      window.alert("Print failed — check printer / try again.");
    } finally {
      setTimeout(cleanup, 1200);
    }
  };

  // Wait a tick so layout/fonts settle before the system print dialog.
  iframe.onload = () => setTimeout(triggerPrint, 200);
  setTimeout(triggerPrint, 450);
}
