import {
  accountingAuditLogSchema,
  accountingDashboardSchema,
  accountingReportSchema,
  accountSchema,
  bankAccountSchema,
  bankTransactionSchema,
  cashSessionSchema,
  cashSessionLiveSchema,
  customerInvoiceSchema,
  expenseSchema,
  inventoryAccountingSchema,
  journalEntrySchema,
  payrollRunSchema,
  popsCashMovementSchema,
  salesAccountingSchema,
  taxSettingsSchema,
  vendorBillSchema,
  type AccountingAuditLog,
  type AccountingDashboard,
  type AccountingReport,
  type Account,
  type BankAccount,
  type BankTransaction,
  type CashSession,
  type CashSessionLive,
  type CloseCashSession,
  type CreateBankAccount,
  type CreateBankTransaction,
  type CreateCustomerInvoice,
  type CreateExpense,
  type CreateJournalEntry,
  type CreatePayrollRun,
  type CreatePopsCashMovement,
  type CustomerInvoice,
  type Expense,
  type InventoryAccounting,
  type JournalEntry,
  type OpenCashSession,
  type PayrollRun,
  type PopsCashMovement,
  type RecordPayment,
  type SalesAccounting,
  type TaxSettings,
  type UpdateTaxSettings,
  type VendorBill,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new Error(err?.message ?? `${fallback}: ${res.status}`);
}

function branchParams(branchCode: string, extra?: Record<string, string>): URLSearchParams {
  return new URLSearchParams({ branchCode, ...extra });
}

export async function fetchAccountingDashboard(branchCode: string): Promise<AccountingDashboard> {
  const res = await authFetch(`/v1/accounting/dashboard?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Dashboard failed");
  return accountingDashboardSchema.parse(await res.json());
}

export async function fetchAccounts(branchCode: string): Promise<Account[]> {
  const res = await authFetch(`/v1/accounting/accounts?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Accounts failed");
  return accountSchema.array().parse(await res.json());
}

export async function fetchJournal(
  branchCode: string,
  opts?: { from?: string; to?: string },
): Promise<JournalEntry[]> {
  const params = branchParams(branchCode, {
    ...(opts?.from ? { from: opts.from } : {}),
    ...(opts?.to ? { to: opts.to } : {}),
  });
  const res = await authFetch(`/v1/accounting/journal?${params}`);
  if (!res.ok) await parseError(res, "Journal failed");
  return journalEntrySchema.array().parse(await res.json());
}

export async function createJournalEntry(input: CreateJournalEntry): Promise<JournalEntry> {
  const res = await authFetch("/v1/accounting/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create journal failed");
  return journalEntrySchema.parse(await res.json());
}

export async function fetchSalesAccounting(branchCode: string): Promise<SalesAccounting> {
  const res = await authFetch(`/v1/accounting/sales?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Sales accounting failed");
  return salesAccountingSchema.parse(await res.json());
}

export async function fetchExpenses(branchCode: string): Promise<Expense[]> {
  const res = await authFetch(`/v1/accounting/expenses?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Expenses failed");
  return expenseSchema.array().parse(await res.json());
}

export async function createExpense(input: CreateExpense): Promise<Expense> {
  const res = await authFetch("/v1/accounting/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create expense failed");
  return expenseSchema.parse(await res.json());
}

export async function approveExpense(expenseId: string): Promise<Expense> {
  const res = await authFetch(`/v1/accounting/expenses/${expenseId}/approve`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Approve expense failed");
  return expenseSchema.parse(await res.json());
}

export async function fetchVendorBills(branchCode: string): Promise<VendorBill[]> {
  const res = await authFetch(`/v1/accounting/vendors?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Vendor bills failed");
  return vendorBillSchema.array().parse(await res.json());
}

export async function payVendorBill(billId: string, input: RecordPayment): Promise<unknown> {
  const res = await authFetch(`/v1/accounting/payable/${billId}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Vendor payment failed");
  return res.json();
}

export async function fetchCustomerInvoices(branchCode: string): Promise<CustomerInvoice[]> {
  const res = await authFetch(`/v1/accounting/receivable?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Receivable failed");
  return customerInvoiceSchema.array().parse(await res.json());
}

export async function createCustomerInvoice(input: CreateCustomerInvoice): Promise<CustomerInvoice> {
  const res = await authFetch("/v1/accounting/receivable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create invoice failed");
  return customerInvoiceSchema.parse(await res.json());
}

export async function payCustomerInvoice(invoiceId: string, input: RecordPayment): Promise<unknown> {
  const res = await authFetch(`/v1/accounting/receivable/${invoiceId}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Customer payment failed");
  return res.json();
}

export async function fetchInventoryAccounting(branchCode: string): Promise<InventoryAccounting> {
  const res = await authFetch(`/v1/accounting/inventory?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Inventory accounting failed");
  return inventoryAccountingSchema.parse(await res.json());
}

export async function fetchOpenCashSession(branchCode: string): Promise<CashSessionLive | null> {
  const res = await authFetch(`/v1/accounting/cash-sessions/open?${branchParams(branchCode)}`);
  if (res.status === 404) return null;
  if (!res.ok) await parseError(res, "Open cash session failed");
  const json = await res.json();
  return json ? cashSessionLiveSchema.parse(json) : null;
}

export async function fetchCashSessions(branchCode: string): Promise<CashSession[]> {
  const res = await authFetch(`/v1/accounting/cash-sessions?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Cash sessions failed");
  return cashSessionSchema.array().parse(await res.json());
}

export async function openCashSession(input: OpenCashSession): Promise<CashSession> {
  const res = await authFetch("/v1/accounting/cash-sessions/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Open cash session failed");
  return cashSessionSchema.parse(await res.json());
}

export async function closeCashSession(sessionId: string, input: CloseCashSession): Promise<unknown> {
  const res = await authFetch(`/v1/accounting/cash-sessions/${sessionId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Close cash session failed");
  return res.json();
}

export async function fetchCashMovements(sessionId: string): Promise<PopsCashMovement[]> {
  const res = await authFetch(`/v1/accounting/cash-movements?${new URLSearchParams({ sessionId })}`);
  if (!res.ok) await parseError(res, "Cash movements failed");
  return popsCashMovementSchema.array().parse(await res.json());
}

export async function recordCashMovement(input: CreatePopsCashMovement): Promise<PopsCashMovement> {
  const res = await authFetch("/v1/accounting/cash-movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Record cash movement failed");
  return popsCashMovementSchema.parse(await res.json());
}

export async function fetchBankAccounts(branchCode: string): Promise<BankAccount[]> {
  const res = await authFetch(`/v1/accounting/bank-accounts?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Bank accounts failed");
  return bankAccountSchema.array().parse(await res.json());
}

export async function createBankAccount(input: CreateBankAccount): Promise<BankAccount> {
  const res = await authFetch("/v1/accounting/bank-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create bank account failed");
  return bankAccountSchema.parse(await res.json());
}

export async function fetchBankTransactions(branchCode: string): Promise<BankTransaction[]> {
  const res = await authFetch(`/v1/accounting/bank-transactions?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Bank transactions failed");
  return bankTransactionSchema.array().parse(await res.json());
}

export async function createBankTransaction(input: CreateBankTransaction): Promise<unknown> {
  const res = await authFetch("/v1/accounting/bank-transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Bank transaction failed");
  return res.json();
}

export async function fetchTaxSettings(branchCode: string): Promise<TaxSettings> {
  const res = await authFetch(`/v1/accounting/tax?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Tax settings failed");
  return taxSettingsSchema.parse(await res.json());
}

export async function updateTaxSettings(input: UpdateTaxSettings): Promise<TaxSettings> {
  const res = await authFetch("/v1/accounting/tax", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update tax failed");
  return taxSettingsSchema.parse(await res.json());
}

export async function fetchPayrollRuns(branchCode: string): Promise<PayrollRun[]> {
  const res = await authFetch(`/v1/accounting/payroll?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Payroll failed");
  return payrollRunSchema.array().parse(await res.json());
}

export async function createPayrollRun(input: CreatePayrollRun): Promise<PayrollRun> {
  const res = await authFetch("/v1/accounting/payroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create payroll failed");
  return payrollRunSchema.parse(await res.json());
}

export async function approvePayrollRun(payrollId: string): Promise<unknown> {
  const res = await authFetch(`/v1/accounting/payroll/${payrollId}/approve`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Approve payroll failed");
  return res.json();
}

export async function payPayrollRun(payrollId: string): Promise<unknown> {
  const res = await authFetch(`/v1/accounting/payroll/${payrollId}/pay`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Pay payroll failed");
  return res.json();
}

export async function fetchAccountingReport(
  branchCode: string,
  reportId: string,
): Promise<AccountingReport> {
  const res = await authFetch(`/v1/accounting/reports/${reportId}?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Report failed");
  return accountingReportSchema.parse(await res.json());
}

export async function fetchAccountingAuditLogs(branchCode: string): Promise<AccountingAuditLog[]> {
  const res = await authFetch(`/v1/accounting/audit-logs?${branchParams(branchCode)}`);
  if (!res.ok) await parseError(res, "Audit logs failed");
  return accountingAuditLogSchema.array().parse(await res.json());
}
