import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createTradeFlowBookingSchema,
  createTradeFlowContraSchema,
  createTradeFlowCustomerSchema,
  createTradeFlowExpenseSchema,
  createTradeFlowInvoiceSchema,
  createTradeFlowItemSchema,
  createTradeFlowJournalSchema,
  createTradeFlowNoteSchema,
  createTradeFlowPaymentSchema,
  createTradeFlowPurchaseSchema,
  createTradeFlowReturnSchema,
  createTradeFlowSalesPersonSchema,
  createTradeFlowSupplierSchema,
  tradeflowLedgerFilterSchema,
  tradeflowPartyTypeSchema,
  tradeflowWhatsappKindSchema,
  updateTradeFlowCustomerSchema,
  updateTradeFlowItemSchema,
  updateTradeFlowSettingsSchema,
  updateTradeFlowSupplierSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { SystemTypeGuard } from "../users/system-type.guard";
import { RequireSystemType } from "../users/require-system-type.decorator";
import { TradeFlowBooksService } from "./tradeflow-books.service";
import { TradeFlowService } from "./tradeflow.service";

@Controller("v1/tradeflow")
@UseGuards(JwtAuthGuard, PermissionsGuard, SystemTypeGuard)
@RequireSystemType("tradeflow")
export class TradeFlowController {
  constructor(
    private readonly tradeflow: TradeFlowService,
    private readonly books: TradeFlowBooksService,
  ) {}

  @Get("status")
  @RequirePermissions("pops.read")
  getStatus() {
    return this.tradeflow.getStatus();
  }

  @Get("dashboard")
  @RequirePermissions("pops.read")
  getDashboard(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tradeflow.getDashboard(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("customers")
  @RequirePermissions("pops.read")
  listCustomers(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tradeflow.listCustomers(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("customers")
  @RequirePermissions("pops.read")
  createCustomer(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tradeflow.createCustomer(user.organizationId, createTradeFlowCustomerSchema.parse(body));
  }

  @Patch("customers/:customerId")
  @RequirePermissions("pops.read")
  updateCustomer(@CurrentUser() user: AccessJwtPayload, @Param("customerId") customerId: string, @Body() body: unknown) {
    return this.tradeflow.updateCustomer(user.organizationId, customerId, updateTradeFlowCustomerSchema.parse(body));
  }

  @Get("customers/:customerId/ledger")
  @RequirePermissions("pops.read")
  getLedger(
    @CurrentUser() user: AccessJwtPayload,
    @Param("customerId") customerId: string,
    @Query("branchCode") branchCode: string,
    @Query("filter") filter?: string,
  ) {
    const parsed = tradeflowLedgerFilterSchema.safeParse(filter ?? "all");
    return this.books.getLedger(user.organizationId, branchCode?.trim() ?? "", customerId, parsed.success ? parsed.data : "all");
  }

  @Get("items")
  @RequirePermissions("pops.read")
  listItems(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("customerId") customerId?: string,
  ) {
    return this.tradeflow.listItems(user.organizationId, branchCode?.trim() ?? "", customerId?.trim() || undefined);
  }

  @Post("items")
  @RequirePermissions("pops.read")
  createItem(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tradeflow.createItem(user.organizationId, createTradeFlowItemSchema.parse(body));
  }

  @Patch("items/:itemId")
  @RequirePermissions("pops.read")
  updateItem(@CurrentUser() user: AccessJwtPayload, @Param("itemId") itemId: string, @Body() body: unknown) {
    return this.tradeflow.updateItem(user.organizationId, itemId, updateTradeFlowItemSchema.parse(body));
  }

  @Get("sales-persons")
  @RequirePermissions("pops.read")
  listSalesPersons(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tradeflow.listSalesPersons(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("sales-persons")
  @RequirePermissions("pops.read")
  createSalesPerson(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tradeflow.createSalesPerson(user.organizationId, createTradeFlowSalesPersonSchema.parse(body));
  }

  @Get("bookings")
  @RequirePermissions("pops.read")
  listBookings(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tradeflow.listBookings(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("bookings")
  @RequirePermissions("pops.read")
  createBooking(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tradeflow.createBooking(user.organizationId, createTradeFlowBookingSchema.parse(body));
  }

  @Get("invoices")
  @RequirePermissions("pops.read")
  listInvoices(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tradeflow.listInvoices(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("invoices/:invoiceId")
  @RequirePermissions("pops.read")
  getInvoice(@CurrentUser() user: AccessJwtPayload, @Param("invoiceId") invoiceId: string) {
    return this.tradeflow.getInvoice(user.organizationId, invoiceId);
  }

  @Post("invoices")
  @RequirePermissions("pops.read")
  createInvoice(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tradeflow.createInvoice(user.organizationId, createTradeFlowInvoiceSchema.parse(body));
  }

  @Get("suppliers")
  @RequirePermissions("pops.read")
  listSuppliers(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listSuppliers(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("suppliers")
  @RequirePermissions("pops.read")
  createSupplier(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createSupplier(user.organizationId, createTradeFlowSupplierSchema.parse(body));
  }

  @Patch("suppliers/:supplierId")
  @RequirePermissions("pops.read")
  updateSupplier(@CurrentUser() user: AccessJwtPayload, @Param("supplierId") supplierId: string, @Body() body: unknown) {
    return this.books.updateSupplier(user.organizationId, supplierId, updateTradeFlowSupplierSchema.parse(body));
  }

  @Get("purchases")
  @RequirePermissions("pops.read")
  listPurchases(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listPurchases(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("purchases/:purchaseId")
  @RequirePermissions("pops.read")
  getPurchase(@CurrentUser() user: AccessJwtPayload, @Param("purchaseId") purchaseId: string) {
    return this.books.getPurchase(user.organizationId, purchaseId);
  }

  @Post("purchases")
  @RequirePermissions("pops.read")
  createPurchase(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createPurchase(user.organizationId, createTradeFlowPurchaseSchema.parse(body));
  }

  @Get("payments")
  @RequirePermissions("pops.read")
  listPayments(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("partyType") partyType?: string,
    @Query("partyId") partyId?: string,
  ) {
    return this.books.listPayments(user.organizationId, branchCode?.trim() ?? "", partyType, partyId);
  }

  @Post("payments")
  @RequirePermissions("pops.read")
  createPayment(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createPayment(user.organizationId, createTradeFlowPaymentSchema.parse(body));
  }

  @Get("returns")
  @RequirePermissions("pops.read")
  listReturns(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listReturns(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("returns")
  @RequirePermissions("pops.read")
  createReturn(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createReturn(user.organizationId, createTradeFlowReturnSchema.parse(body));
  }

  @Get("notes")
  @RequirePermissions("pops.read")
  listNotes(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listNotes(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("notes")
  @RequirePermissions("pops.read")
  createNote(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createNote(user.organizationId, createTradeFlowNoteSchema.parse(body));
  }

  @Get("accounts")
  @RequirePermissions("pops.read")
  listAccounts(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listAccounts(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("journal")
  @RequirePermissions("pops.read")
  listJournal(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listJournal(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("journal")
  @RequirePermissions("pops.read")
  createJournal(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createJournal(user.organizationId, createTradeFlowJournalSchema.parse(body));
  }

  @Get("contra")
  @RequirePermissions("pops.read")
  listContra(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listContra(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("contra")
  @RequirePermissions("pops.read")
  createContra(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createContra(user.organizationId, createTradeFlowContraSchema.parse(body));
  }

  @Get("expenses")
  @RequirePermissions("pops.read")
  listExpenses(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.listExpenses(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("expenses")
  @RequirePermissions("pops.read")
  createExpense(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.createExpense(user.organizationId, createTradeFlowExpenseSchema.parse(body));
  }

  @Get("settings")
  @RequirePermissions("pops.read")
  getSettings(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.books.getSettings(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("settings")
  @RequirePermissions("pops.read")
  updateSettings(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.books.updateSettings(user.organizationId, updateTradeFlowSettingsSchema.parse(body));
  }

  @Get("whatsapp")
  @RequirePermissions("pops.read")
  whatsapp(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("kind") kind: string,
    @Query("partyType") partyType: string,
    @Query("partyId") partyId?: string,
    @Query("invoiceId") invoiceId?: string,
    @Query("purchaseId") purchaseId?: string,
  ) {
    const k = tradeflowWhatsappKindSchema.parse(kind);
    const p = tradeflowPartyTypeSchema.parse(partyType || "customer");
    return this.books.whatsapp(user.organizationId, branchCode?.trim() ?? "", k, p, partyId, invoiceId, purchaseId);
  }
}
