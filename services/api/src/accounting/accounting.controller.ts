import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  closeCashSessionSchema,
  createBankAccountSchema,
  createBankTransactionSchema,
  createCustomerInvoiceSchema,
  createExpenseSchema,
  createJournalEntrySchema,
  createPayrollRunSchema,
  openCashSessionSchema,
  recordPaymentSchema,
  updateTaxSettingsSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { AccountingService } from "./accounting.service";

@Controller("v1/accounting")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get("dashboard")
  @RequirePermissions("pops.read")
  getDashboard(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.getDashboard(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("accounts")
  @RequirePermissions("pops.read")
  listAccounts(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listAccounts(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("journal")
  @RequirePermissions("pops.read")
  listJournal(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.accounting.listJournal(user.organizationId, branchCode?.trim() ?? "", { from, to });
  }

  @Post("journal")
  @RequirePermissions("pops.accounting.manage")
  createJournal(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.createJournalEntry(
      user.organizationId,
      user.sub,
      createJournalEntrySchema.parse(body),
    );
  }

  @Get("sales")
  @RequirePermissions("pops.read")
  getSales(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.getSalesAccounting(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("expenses")
  @RequirePermissions("pops.read")
  listExpenses(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listExpenses(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("expenses")
  @RequirePermissions("pops.accounting.manage")
  createExpense(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.createExpense(
      user.organizationId,
      user.sub,
      createExpenseSchema.parse(body),
    );
  }

  @Patch("expenses/:expenseId/approve")
  @RequirePermissions("pops.accounting.manage")
  approveExpense(
    @CurrentUser() user: AccessJwtPayload,
    @Param("expenseId") expenseId: string,
  ) {
    return this.accounting.approveExpense(user.organizationId, user.sub, expenseId);
  }

  @Get("purchases")
  @RequirePermissions("pops.read")
  listPurchases(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listVendorBills(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("vendors")
  @RequirePermissions("pops.read")
  listVendors(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listVendorBills(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("payable")
  @RequirePermissions("pops.read")
  listPayable(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listVendorBills(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("payable/:billId/payment")
  @RequirePermissions("pops.accounting.manage")
  payVendor(
    @CurrentUser() user: AccessJwtPayload,
    @Param("billId") billId: string,
    @Body() body: unknown,
  ) {
    return this.accounting.payVendorBill(
      user.organizationId,
      user.sub,
      billId,
      recordPaymentSchema.parse(body),
    );
  }

  @Get("receivable")
  @RequirePermissions("pops.read")
  listReceivable(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listCustomerInvoices(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("customers")
  @RequirePermissions("pops.read")
  listCustomers(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listCustomerInvoices(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("receivable")
  @RequirePermissions("pops.accounting.manage")
  createInvoice(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.createCustomerInvoice(
      user.organizationId,
      user.sub,
      createCustomerInvoiceSchema.parse(body),
    );
  }

  @Post("receivable/:invoiceId/payment")
  @RequirePermissions("pops.accounting.manage")
  payInvoice(
    @CurrentUser() user: AccessJwtPayload,
    @Param("invoiceId") invoiceId: string,
    @Body() body: unknown,
  ) {
    return this.accounting.payCustomerInvoice(
      user.organizationId,
      user.sub,
      invoiceId,
      recordPaymentSchema.parse(body),
    );
  }

  @Get("inventory")
  @RequirePermissions("pops.read")
  getInventoryAccounting(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
  ) {
    return this.accounting.getInventoryAccounting(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("cash-sessions")
  @RequirePermissions("pops.read")
  listCashSessions(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listCashSessions(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("cash-sessions/open")
  @RequirePermissions("pops.accounting.manage")
  openCashSession(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    const input = openCashSessionSchema.parse(body);
    return this.accounting.openCashSession(
      user.organizationId,
      user.sub,
      input.branchCode,
      input.openingFloat,
    );
  }

  @Post("cash-sessions/:sessionId/close")
  @RequirePermissions("pops.accounting.manage")
  closeCashSession(
    @CurrentUser() user: AccessJwtPayload,
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    return this.accounting.closeCashSession(
      user.organizationId,
      user.sub,
      sessionId,
      closeCashSessionSchema.parse(body),
    );
  }

  @Get("bank-accounts")
  @RequirePermissions("pops.read")
  listBankAccounts(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listBankAccounts(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("bank-accounts")
  @RequirePermissions("pops.accounting.manage")
  createBankAccount(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.createBankAccount(
      user.organizationId,
      user.sub,
      createBankAccountSchema.parse(body),
    );
  }

  @Get("bank-transactions")
  @RequirePermissions("pops.read")
  listBankTransactions(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
  ) {
    return this.accounting.listBankTransactions(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("bank-transactions")
  @RequirePermissions("pops.accounting.manage")
  createBankTransaction(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.createBankTransaction(
      user.organizationId,
      user.sub,
      createBankTransactionSchema.parse(body),
    );
  }

  @Get("tax")
  @RequirePermissions("pops.read")
  getTax(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.getTaxSettings(user.organizationId, branchCode?.trim() ?? "");
  }

  @Patch("tax")
  @RequirePermissions("pops.accounting.manage")
  updateTax(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.updateTaxSettings(
      user.organizationId,
      updateTaxSettingsSchema.parse(body),
    );
  }

  @Get("payroll")
  @RequirePermissions("pops.read")
  listPayroll(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listPayroll(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("payroll")
  @RequirePermissions("pops.accounting.manage")
  createPayroll(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.accounting.createPayrollRun(
      user.organizationId,
      user.sub,
      createPayrollRunSchema.parse(body),
    );
  }

  @Patch("payroll/:payrollId/approve")
  @RequirePermissions("pops.accounting.manage")
  approvePayroll(@CurrentUser() user: AccessJwtPayload, @Param("payrollId") payrollId: string) {
    return this.accounting.approvePayroll(user.organizationId, user.sub, payrollId);
  }

  @Patch("payroll/:payrollId/pay")
  @RequirePermissions("pops.accounting.manage")
  payPayroll(@CurrentUser() user: AccessJwtPayload, @Param("payrollId") payrollId: string) {
    return this.accounting.payPayroll(user.organizationId, user.sub, payrollId);
  }

  @Get("reports/:reportId")
  @RequirePermissions("pops.read")
  getReport(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Param("reportId") reportId: string,
  ) {
    return this.accounting.getReport(user.organizationId, branchCode?.trim() ?? "", reportId);
  }

  @Get("audit-logs")
  @RequirePermissions("pops.read")
  listAuditLogs(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.accounting.listAuditLogs(user.organizationId, branchCode?.trim() ?? "");
  }
}
