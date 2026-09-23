import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTradeFlowBooking,
  CreateTradeFlowCustomer,
  CreateTradeFlowInvoice,
  CreateTradeFlowItem,
  CreateTradeFlowSalesPerson,
  UpdateTradeFlowCustomer,
  UpdateTradeFlowItem,
  TradeFlowBooking,
  TradeFlowCustomer,
  TradeFlowDashboard,
  TradeFlowInvoice,
  TradeFlowItem,
  TradeFlowSalesPerson,
} from "@platform/contracts";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import {
  popsBranches,
  tradeflowAccounts,
  tradeflowBookings,
  tradeflowCustomers,
  tradeflowExpenses,
  tradeflowInvoiceAttachments,
  tradeflowInvoiceExpenses,
  tradeflowInvoiceLines,
  tradeflowInvoices,
  tradeflowItems,
  tradeflowPartyRates,
  tradeflowPayments,
  tradeflowPurchases,
  tradeflowReturns,
  tradeflowSalesPersons,
  tradeflowSettings,
  tradeflowSuppliers,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { toAltQty, toPrimaryQty } from "./tradeflow.units";

const ITEM_SEEDS = [
  { sku: "TF-CEM", name: "Cement bag", unit: "Bag", defaultRatePkr: 1500, onHandQty: 500 },
  { sku: "TF-STL", name: "Steel bar", unit: "Ton", defaultRatePkr: 185000, onHandQty: 40 },
  { sku: "TF-SND", name: "Sand", unit: "Trolley", defaultRatePkr: 8500, onHandQty: 80 },
  { sku: "TF-CRH", name: "Crush", unit: "Trolley", defaultRatePkr: 12000, onHandQty: 60 },
  { sku: "TF-BRK", name: "Brick", unit: "Piece", defaultRatePkr: 18, onHandQty: 20000 },
];

@Injectable()
export class TradeFlowService {
  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  getStatus() {
    return {
      ready: true,
      system: "tradeflow" as const,
      modulesReady: ["pos", "bookings", "stock", "invoices", "ledger", "purchase", "returns", "journal", "contra", "whatsapp", "mobile"],
    };
  }

  async getDashboard(organizationId: string, branchCode: string): Promise<TradeFlowDashboard> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    await this.ensureSeed(organizationId, branch.id);
    const scope = and(eq(tradeflowInvoices.organizationId, organizationId), eq(tradeflowInvoices.branchId, branch.id));
    const [{ invoiceCount }] = await this.db
      .select({ invoiceCount: sql<number>`count(*)::int` })
      .from(tradeflowInvoices)
      .where(scope);
    const [{ openBookings }] = await this.db
      .select({ openBookings: sql<number>`count(*)::int` })
      .from(tradeflowBookings)
      .where(and(eq(tradeflowBookings.organizationId, organizationId), eq(tradeflowBookings.branchId, branch.id), ne(tradeflowBookings.status, "completed"), ne(tradeflowBookings.status, "cancelled")));
    const [{ customerCount }] = await this.db
      .select({ customerCount: sql<number>`count(*)::int` })
      .from(tradeflowCustomers)
      .where(and(eq(tradeflowCustomers.organizationId, organizationId), eq(tradeflowCustomers.branchId, branch.id)));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [{ todaySalesPkr }] = await this.db
      .select({ todaySalesPkr: sql<number>`coalesce(sum(${tradeflowInvoices.totalPkr}),0)::int` })
      .from(tradeflowInvoices)
      .where(and(scope, gte(tradeflowInvoices.createdAt, start)));
    const [{ invoiceExpensePkr }] = await this.db
      .select({ invoiceExpensePkr: sql<number>`coalesce(sum(${tradeflowInvoiceExpenses.amountPkr}),0)::int` })
      .from(tradeflowInvoiceExpenses)
      .innerJoin(tradeflowInvoices, eq(tradeflowInvoices.id, tradeflowInvoiceExpenses.invoiceId))
      .where(and(scope, gte(tradeflowInvoices.createdAt, start)));
    const [{ dayExpensePkr }] = await this.db
      .select({ dayExpensePkr: sql<number>`coalesce(sum(${tradeflowExpenses.amountPkr}),0)::int` })
      .from(tradeflowExpenses)
      .where(and(eq(tradeflowExpenses.organizationId, organizationId), eq(tradeflowExpenses.branchId, branch.id), gte(tradeflowExpenses.createdAt, start)));
    const [{ todayReceiptsPkr }] = await this.db
      .select({ todayReceiptsPkr: sql<number>`coalesce(sum(${tradeflowPayments.amountPkr}),0)::int` })
      .from(tradeflowPayments)
      .where(and(eq(tradeflowPayments.organizationId, organizationId), eq(tradeflowPayments.branchId, branch.id), sql`${tradeflowPayments.kind} in ('receive','advance')`, gte(tradeflowPayments.createdAt, start)));
    const [{ todayPaymentsPkr }] = await this.db
      .select({ todayPaymentsPkr: sql<number>`coalesce(sum(${tradeflowPayments.amountPkr}),0)::int` })
      .from(tradeflowPayments)
      .where(and(eq(tradeflowPayments.organizationId, organizationId), eq(tradeflowPayments.branchId, branch.id), eq(tradeflowPayments.kind, "pay"), gte(tradeflowPayments.createdAt, start)));
    const [{ todayPurchasesPkr }] = await this.db
      .select({ todayPurchasesPkr: sql<number>`coalesce(sum(${tradeflowPurchases.totalPkr}),0)::int` })
      .from(tradeflowPurchases)
      .where(and(eq(tradeflowPurchases.organizationId, organizationId), eq(tradeflowPurchases.branchId, branch.id), gte(tradeflowPurchases.createdAt, start)));
    const [{ todayReturnsPkr }] = await this.db
      .select({ todayReturnsPkr: sql<number>`coalesce(sum(${tradeflowReturns.amountPkr}),0)::int` })
      .from(tradeflowReturns)
      .where(and(eq(tradeflowReturns.organizationId, organizationId), eq(tradeflowReturns.branchId, branch.id), gte(tradeflowReturns.createdAt, start)));
    const todayExpensesPkr = (invoiceExpensePkr ?? 0) + (dayExpensePkr ?? 0);
    return {
      systemName: "MaterialFlow ERP",
      status: "ready",
      invoiceCount: invoiceCount ?? 0,
      openBookings: openBookings ?? 0,
      todaySalesPkr: todaySalesPkr ?? 0,
      todayExpensesPkr,
      todayProfitPkr: (todaySalesPkr ?? 0) - todayExpensesPkr,
      todayReceiptsPkr: todayReceiptsPkr ?? 0,
      todayPaymentsPkr: todayPaymentsPkr ?? 0,
      todayPurchasesPkr: todayPurchasesPkr ?? 0,
      todayReturnsPkr: todayReturnsPkr ?? 0,
      customerCount: customerCount ?? 0,
    };
  }

  async listCustomers(organizationId: string, branchCode: string): Promise<TradeFlowCustomer[]> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    await this.ensureSeed(organizationId, branch.id);
    const rows = await this.db
      .select()
      .from(tradeflowCustomers)
      .where(and(eq(tradeflowCustomers.organizationId, organizationId), eq(tradeflowCustomers.branchId, branch.id)))
      .orderBy(tradeflowCustomers.name);
    return rows.map((r) => this.mapCustomer(r));
  }

  async createCustomer(organizationId: string, input: CreateTradeFlowCustomer): Promise<TradeFlowCustomer> {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const [row] = await this.db
      .insert(tradeflowCustomers)
      .values({
        organizationId,
        branchId: branch.id,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        isCash: 0,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not create customer");
    return this.mapCustomer(row);
  }

  async updateCustomer(organizationId: string, customerId: string, input: UpdateTradeFlowCustomer): Promise<TradeFlowCustomer> {
    const [existing] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, customerId)).limit(1);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundException("Customer not found");
    if (existing.isCash) throw new BadRequestException("Cash party cannot be edited");
    const [row] = await this.db
      .update(tradeflowCustomers)
      .set({
        name: input.name?.trim() || existing.name,
        phone: input.phone !== undefined ? input.phone.trim() || null : existing.phone,
        address: input.address !== undefined ? input.address.trim() || null : existing.address,
      })
      .where(eq(tradeflowCustomers.id, customerId))
      .returning();
    if (!row) throw new BadRequestException("Could not update customer");
    return this.mapCustomer(row);
  }

  async listItems(organizationId: string, branchCode: string, customerId?: string): Promise<TradeFlowItem[]> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    await this.ensureSeed(organizationId, branch.id);
    const items = await this.db
      .select()
      .from(tradeflowItems)
      .where(and(eq(tradeflowItems.organizationId, organizationId), eq(tradeflowItems.branchId, branch.id)))
      .orderBy(tradeflowItems.name);
    const rates = customerId
      ? await this.db
          .select()
          .from(tradeflowPartyRates)
          .where(
            and(
              eq(tradeflowPartyRates.organizationId, organizationId),
              eq(tradeflowPartyRates.branchId, branch.id),
              eq(tradeflowPartyRates.customerId, customerId),
            ),
          )
      : [];
    const bookings = customerId
      ? await this.db
          .select()
          .from(tradeflowBookings)
          .where(
            and(
              eq(tradeflowBookings.organizationId, organizationId),
              eq(tradeflowBookings.branchId, branch.id),
              eq(tradeflowBookings.customerId, customerId),
              ne(tradeflowBookings.status, "completed"),
              ne(tradeflowBookings.status, "cancelled"),
            ),
          )
      : [];
    return items.map((item) => {
      const rate = rates.find((r) => r.itemId === item.id);
      const booking = bookings.find((b) => b.itemId === item.id);
      const remaining = booking ? Math.max(0, booking.qtyBooked - booking.qtyIssued) : 0;
      const freeQty = Math.max(0, item.onHandQty - item.bookedQty);
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        altUnit: item.altUnit || "Amount",
        altFactor: item.altFactor ?? 0,
        defaultRatePkr: item.defaultRatePkr,
        onHandQty: item.onHandQty,
        onHandAlt: toAltQty(item, item.onHandQty),
        bookedQty: item.bookedQty,
        bookedAlt: toAltQty(item, item.bookedQty),
        freeQty,
        freeAlt: toAltQty(item, freeQty),
        lastRatePkr: rate?.lastRatePkr ?? null,
        openBookingId: remaining > 0 ? booking?.id ?? null : null,
        openBookingRemaining: remaining,
        openBookingRemainingValuePkr: remaining * (booking?.bookedRatePkr ?? 0),
        openBookingRatePkr: remaining > 0 ? booking?.bookedRatePkr ?? null : null,
      };
    });
  }

  async createItem(organizationId: string, input: CreateTradeFlowItem): Promise<TradeFlowItem> {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const sku = input.sku?.trim() || `TF-${Date.now().toString(36).toUpperCase()}`;
    const [row] = await this.db
      .insert(tradeflowItems)
      .values({
        organizationId,
        branchId: branch.id,
        sku,
        name: input.name.trim(),
        unit: input.unit?.trim() || "Bag",
        altUnit: input.altUnit?.trim() || "Amount",
        altFactor: Math.round(input.altFactor ?? 0),
        defaultRatePkr: Math.round(input.defaultRatePkr),
        onHandQty: input.onHandQty ?? 0,
        bookedQty: 0,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not create item");
    return this.mapItemRow(row);
  }

  async updateItem(organizationId: string, itemId: string, input: UpdateTradeFlowItem): Promise<TradeFlowItem> {
    const [existing] = await this.db
      .select()
      .from(tradeflowItems)
      .where(and(eq(tradeflowItems.organizationId, organizationId), eq(tradeflowItems.id, itemId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Item not found");
    const [row] = await this.db
      .update(tradeflowItems)
      .set({
        sku: input.sku !== undefined ? input.sku.trim() || existing.sku : existing.sku,
        name: input.name !== undefined ? input.name.trim() || existing.name : existing.name,
        unit: input.unit !== undefined ? input.unit.trim() || existing.unit : existing.unit,
        altUnit: input.altUnit !== undefined ? input.altUnit.trim() || existing.altUnit : existing.altUnit,
        altFactor: input.altFactor !== undefined ? Math.round(input.altFactor) : existing.altFactor,
        defaultRatePkr: input.defaultRatePkr !== undefined ? Math.round(input.defaultRatePkr) : existing.defaultRatePkr,
        onHandQty: input.onHandQty !== undefined ? input.onHandQty : existing.onHandQty,
      })
      .where(eq(tradeflowItems.id, itemId))
      .returning();
    if (!row) throw new BadRequestException("Could not update item");
    return this.mapItemRow(row);
  }

  async listSalesPersons(organizationId: string, branchCode: string): Promise<TradeFlowSalesPerson[]> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    await this.ensureSeed(organizationId, branch.id);
    const rows = await this.db
      .select()
      .from(tradeflowSalesPersons)
      .where(and(eq(tradeflowSalesPersons.organizationId, organizationId), eq(tradeflowSalesPersons.branchId, branch.id)))
      .orderBy(tradeflowSalesPersons.name);
    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, isActive: r.isActive === 1 }));
  }

  async createSalesPerson(organizationId: string, input: CreateTradeFlowSalesPerson): Promise<TradeFlowSalesPerson> {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const [row] = await this.db
      .insert(tradeflowSalesPersons)
      .values({ organizationId, branchId: branch.id, name: input.name.trim(), phone: input.phone?.trim() || null })
      .returning();
    if (!row) throw new BadRequestException("Could not create sales person");
    return { id: row.id, name: row.name, phone: row.phone, isActive: true };
  }

  async listBookings(organizationId: string, branchCode: string): Promise<TradeFlowBooking[]> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select({
        booking: tradeflowBookings,
        customerName: tradeflowCustomers.name,
        itemName: tradeflowItems.name,
        unit: tradeflowItems.unit,
      })
      .from(tradeflowBookings)
      .innerJoin(tradeflowCustomers, eq(tradeflowCustomers.id, tradeflowBookings.customerId))
      .innerJoin(tradeflowItems, eq(tradeflowItems.id, tradeflowBookings.itemId))
      .where(and(eq(tradeflowBookings.organizationId, organizationId), eq(tradeflowBookings.branchId, branch.id)))
      .orderBy(desc(tradeflowBookings.createdAt));
    return rows.map(({ booking, customerName, itemName, unit }) => this.mapBooking(booking, customerName, itemName, unit));
  }

  async createBooking(organizationId: string, input: CreateTradeFlowBooking): Promise<TradeFlowBooking> {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const [item] = await this.db.select().from(tradeflowItems).where(eq(tradeflowItems.id, input.itemId)).limit(1);
    if (!item || item.organizationId !== organizationId) throw new NotFoundException("Item not found");
    const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, input.customerId)).limit(1);
    if (!customer || customer.organizationId !== organizationId) throw new NotFoundException("Customer not found");
    if (customer.isCash === 1) throw new BadRequestException("Cash walk-in cannot hold a booking. Select a party.");
    const free = Math.max(0, item.onHandQty - item.bookedQty);
    if (input.qtyBooked > free) {
      throw new BadRequestException(`Only ${free} ${item.unit} free to book. On hand ${item.onHandQty}, already booked ${item.bookedQty}.`);
    }
    const [row] = await this.db
      .insert(tradeflowBookings)
      .values({
        organizationId,
        branchId: branch.id,
        customerId: input.customerId,
        itemId: input.itemId,
        qtyBooked: input.qtyBooked,
        qtyIssued: 0,
        bookedRatePkr: Math.round(input.bookedRatePkr),
        advancePkr: Math.round(input.advancePkr ?? 0),
        status: "open",
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not create booking");
    await this.db
      .update(tradeflowItems)
      .set({ bookedQty: item.bookedQty + input.qtyBooked })
      .where(eq(tradeflowItems.id, item.id));
    await this.upsertPartyRate(organizationId, branch.id, input.customerId, input.itemId, Math.round(input.bookedRatePkr));
    if ((input.advancePkr ?? 0) > 0) {
      await this.db.insert(tradeflowPayments).values({
        organizationId,
        branchId: branch.id,
        partyType: "customer",
        partyId: input.customerId,
        kind: "advance",
        amountPkr: Math.round(input.advancePkr ?? 0),
        ref: row.id.slice(0, 8),
        notes: "Booking advance",
      });
      await this.db
        .update(tradeflowCustomers)
        .set({ closingBalancePkr: Math.max(0, customer.closingBalancePkr - Math.round(input.advancePkr ?? 0)) })
        .where(eq(tradeflowCustomers.id, customer.id));
    }
    return this.mapBooking(row, customer.name, item.name, item.unit);
  }

  async listInvoices(organizationId: string, branchCode: string): Promise<TradeFlowInvoice[]> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const invoices = await this.db
      .select()
      .from(tradeflowInvoices)
      .where(and(eq(tradeflowInvoices.organizationId, organizationId), eq(tradeflowInvoices.branchId, branch.id)))
      .orderBy(desc(tradeflowInvoices.createdAt));
    const out: TradeFlowInvoice[] = [];
    for (const invoice of invoices) out.push(await this.hydrateInvoice(invoice));
    return out;
  }

  async getInvoice(organizationId: string, invoiceId: string): Promise<TradeFlowInvoice> {
    const [invoice] = await this.db.select().from(tradeflowInvoices).where(eq(tradeflowInvoices.id, invoiceId)).limit(1);
    if (!invoice || invoice.organizationId !== organizationId) throw new NotFoundException("Invoice not found");
    return this.hydrateInvoice(invoice);
  }

  async createInvoice(organizationId: string, input: CreateTradeFlowInvoice): Promise<TradeFlowInvoice> {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    await this.ensureSeed(organizationId, branch.id);
    const cashCustomer = await this.ensureCashCustomer(organizationId, branch.id);
    const customerId = input.customerId || cashCustomer.id;
    const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, customerId)).limit(1);
    if (!customer) throw new NotFoundException("Customer not found");
    const paymentMode = customer.isCash === 1 ? "cash" : (input.paymentMode ?? "credit");

    const priced = [];
    for (const line of input.lines) {
      const [item] = await this.db.select().from(tradeflowItems).where(eq(tradeflowItems.id, line.itemId)).limit(1);
      if (!item || item.organizationId !== organizationId) throw new NotFoundException("Item not found");
      const [lastRate] = await this.db
        .select()
        .from(tradeflowPartyRates)
        .where(
          and(
            eq(tradeflowPartyRates.organizationId, organizationId),
            eq(tradeflowPartyRates.branchId, branch.id),
            eq(tradeflowPartyRates.customerId, customerId),
            eq(tradeflowPartyRates.itemId, line.itemId),
          ),
        )
        .limit(1);
      let booking = line.bookingId
        ? (await this.db.select().from(tradeflowBookings).where(eq(tradeflowBookings.id, line.bookingId)).limit(1))[0]
        : undefined;
      if (!booking && customer.isCash !== 1) {
        const [open] = await this.db
          .select()
          .from(tradeflowBookings)
          .where(
            and(
              eq(tradeflowBookings.organizationId, organizationId),
              eq(tradeflowBookings.branchId, branch.id),
              eq(tradeflowBookings.customerId, customerId),
              eq(tradeflowBookings.itemId, line.itemId),
              ne(tradeflowBookings.status, "completed"),
              ne(tradeflowBookings.status, "cancelled"),
            ),
          )
          .limit(1);
        booking = open;
      }
      const unitKind = line.unitKind === "alt" ? "alt" : "primary";
      const primaryQty = toPrimaryQty(item, line.qty, unitKind);
      const remaining = booking ? Math.max(0, booking.qtyBooked - booking.qtyIssued) : 0;
      const bookingQty = Math.min(primaryQty, remaining);
      if (primaryQty > item.onHandQty) {
        throw new BadRequestException(`${item.name}: only ${item.onHandQty} ${item.unit} on hand.`);
      }
      const discountType = line.discountType ?? "none";
      const discountValue = line.discountValue ?? 0;
      const ratePkr = Math.round(line.ratePkr);
      const gross = unitKind === "alt" ? Math.round(line.qty) : Math.round(primaryQty * ratePkr);
      const discountPkr =
        discountType === "percent" ? Math.round((gross * discountValue) / 100) : discountType === "amount" ? Math.round(discountValue) : 0;
      priced.push({
        item,
        booking,
        bookingQty,
        remainingAfter: booking ? remaining - bookingQty : null,
        qty: line.qty,
        primaryQty,
        unitKind,
        ratePkr,
        lastRatePkr: lastRate?.lastRatePkr ?? item.defaultRatePkr,
        discountType,
        discountValue,
        discountPkr,
        lineTotalPkr: Math.max(0, gross - discountPkr),
      });
    }

    const subtotalPkr = priced.reduce((s, l) => s + l.lineTotalPkr + l.discountPkr, 0);
    const discountPkr = priced.reduce((s, l) => s + l.discountPkr, 0);
    const expensePkr = (input.expenses ?? []).reduce((s, e) => s + Math.round(e.amountPkr), 0);
    const totalPkr = Math.max(0, subtotalPkr - discountPkr);
    const receiveNow = Boolean(input.receiveNow);
    const receivedPkr = receiveNow ? Math.min(totalPkr, Math.round(input.receivedPkr ?? totalPkr)) : 0;
    const status = receivedPkr >= totalPkr && totalPkr > 0 ? "paid" : receivedPkr > 0 ? "partial" : "saved";
    const invoiceNo = `TF-${Date.now().toString(36).toUpperCase()}`;

    const [invoice] = await this.db
      .insert(tradeflowInvoices)
      .values({
        organizationId,
        branchId: branch.id,
        invoiceNo,
        customerId,
        salesPersonId: input.salesPersonId || null,
        paymentMode,
        dueDate: paymentMode === "credit" ? input.dueDate || null : null,
        status,
        subtotalPkr,
        discountPkr,
        expensePkr,
        totalPkr,
        receivedPkr,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!invoice) throw new BadRequestException("Could not save invoice");

    for (const line of priced) {
      await this.db.insert(tradeflowInvoiceLines).values({
        invoiceId: invoice.id,
        itemId: line.item.id,
        bookingId: line.booking?.id ?? null,
        qty: line.qty,
        bookingQty: line.bookingQty,
        unitKind: line.unitKind,
        ratePkr: line.ratePkr,
        lastRatePkr: line.lastRatePkr,
        discountType: line.discountType,
        discountValue: line.discountValue,
        discountPkr: line.discountPkr,
        lineTotalPkr: line.lineTotalPkr,
      });
      await this.db
        .update(tradeflowItems)
        .set({
          onHandQty: line.item.onHandQty - line.primaryQty,
          bookedQty: Math.max(0, line.item.bookedQty - line.bookingQty),
        })
        .where(eq(tradeflowItems.id, line.item.id));
      if (line.booking && line.bookingQty > 0) {
        const qtyIssued = line.booking.qtyIssued + line.bookingQty;
        const nextStatus = qtyIssued >= line.booking.qtyBooked ? "completed" : "partial";
        await this.db
          .update(tradeflowBookings)
          .set({ qtyIssued, status: nextStatus, updatedAt: new Date() })
          .where(eq(tradeflowBookings.id, line.booking.id));
      }
      if (customer.isCash !== 1) {
        await this.upsertPartyRate(organizationId, branch.id, customerId, line.item.id, line.ratePkr);
      }
    }

    for (const expense of input.expenses ?? []) {
      await this.db.insert(tradeflowInvoiceExpenses).values({
        invoiceId: invoice.id,
        label: expense.label.trim(),
        amountPkr: Math.round(expense.amountPkr),
      });
    }
    for (const file of input.attachments ?? []) {
      if (file.dataUrl.length > 2_500_000) throw new BadRequestException("Attachment is too large (max ~2MB).");
      await this.db.insert(tradeflowInvoiceAttachments).values({
        invoiceId: invoice.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        dataUrl: file.dataUrl,
      });
    }

    const due = Math.max(0, totalPkr - receivedPkr);
    if (customer.isCash !== 1 && due > 0) {
      await this.db
        .update(tradeflowCustomers)
        .set({ closingBalancePkr: customer.closingBalancePkr + due })
        .where(eq(tradeflowCustomers.id, customer.id));
    }
    if (receivedPkr > 0) {
      await this.db.insert(tradeflowPayments).values({
        organizationId,
        branchId: branch.id,
        partyType: "customer",
        partyId: customerId,
        kind: "receive",
        amountPkr: receivedPkr,
        ref: invoice.invoiceNo,
        notes: "Invoice receipt",
      });
    }

    return this.getInvoice(organizationId, invoice.id);
  }

  private async hydrateInvoice(invoice: typeof tradeflowInvoices.$inferSelect): Promise<TradeFlowInvoice> {
    const [customer] = invoice.customerId
      ? await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, invoice.customerId)).limit(1)
      : [];
    const [salesPerson] = invoice.salesPersonId
      ? await this.db.select().from(tradeflowSalesPersons).where(eq(tradeflowSalesPersons.id, invoice.salesPersonId)).limit(1)
      : [];
    const lines = await this.db
      .select({ line: tradeflowInvoiceLines, itemName: tradeflowItems.name, unit: tradeflowItems.unit, booking: tradeflowBookings })
      .from(tradeflowInvoiceLines)
      .innerJoin(tradeflowItems, eq(tradeflowItems.id, tradeflowInvoiceLines.itemId))
      .leftJoin(tradeflowBookings, eq(tradeflowBookings.id, tradeflowInvoiceLines.bookingId))
      .where(eq(tradeflowInvoiceLines.invoiceId, invoice.id));
    const expenses = await this.db.select().from(tradeflowInvoiceExpenses).where(eq(tradeflowInvoiceExpenses.invoiceId, invoice.id));
    const attachments = await this.db.select().from(tradeflowInvoiceAttachments).where(eq(tradeflowInvoiceAttachments.invoiceId, invoice.id));
    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customerId: invoice.customerId,
      customerName: customer?.name ?? "Cash",
      customerPhone: customer?.phone ?? null,
      customerBalancePkr: customer?.closingBalancePkr ?? 0,
      salesPersonId: invoice.salesPersonId,
      salesPersonName: salesPerson?.name ?? null,
      paymentMode: invoice.paymentMode === "credit" ? "credit" : "cash",
      dueDate: invoice.dueDate,
      status: invoice.status === "paid" || invoice.status === "partial" ? invoice.status : "saved",
      subtotalPkr: invoice.subtotalPkr,
      discountPkr: invoice.discountPkr,
      expensePkr: invoice.expensePkr,
      totalPkr: invoice.totalPkr,
      receivedPkr: invoice.receivedPkr,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      lines: lines.map(({ line, itemName, unit, booking }) => ({
        id: line.id,
        itemId: line.itemId,
        itemName,
        unit,
        unitKind: line.unitKind === "alt" ? "alt" : "primary",
        bookingId: line.bookingId,
        qty: line.qty,
        bookingQty: line.bookingQty,
        bookingRemainingAfter: booking ? Math.max(0, booking.qtyBooked - booking.qtyIssued) : null,
        bookingRemainingValueAfterPkr: booking ? Math.max(0, booking.qtyBooked - booking.qtyIssued) * booking.bookedRatePkr : null,
        ratePkr: line.ratePkr,
        lastRatePkr: line.lastRatePkr,
        discountType: line.discountType === "percent" || line.discountType === "amount" ? line.discountType : "none",
        discountValue: line.discountValue,
        discountPkr: line.discountPkr,
        lineTotalPkr: line.lineTotalPkr,
      })),
      expenses: expenses.map((e) => ({ id: e.id, label: e.label, amountPkr: e.amountPkr })),
      attachments: attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, dataUrl: a.dataUrl })),
      bookingSummary: invoice.customerId ? await this.customerBookingSummary(invoice.customerId) : undefined,
    };
  }

  private mapItemRow(row: typeof tradeflowItems.$inferSelect): TradeFlowItem {
    const freeQty = Math.max(0, row.onHandQty - row.bookedQty);
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      altUnit: row.altUnit || "Amount",
      altFactor: row.altFactor ?? 0,
      defaultRatePkr: row.defaultRatePkr,
      onHandQty: row.onHandQty,
      onHandAlt: toAltQty(row, row.onHandQty),
      bookedQty: row.bookedQty,
      bookedAlt: toAltQty(row, row.bookedQty),
      freeQty,
      freeAlt: toAltQty(row, freeQty),
      lastRatePkr: null,
      openBookingId: null,
      openBookingRemaining: 0,
      openBookingRemainingValuePkr: 0,
      openBookingRatePkr: null,
    };
  }

  private mapCustomer(row: typeof tradeflowCustomers.$inferSelect): TradeFlowCustomer {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      isCash: row.isCash === 1,
      closingBalancePkr: row.closingBalancePkr,
    };
  }

  private mapBooking(
    row: typeof tradeflowBookings.$inferSelect,
    customerName: string,
    itemName: string,
    unit: string,
  ): TradeFlowBooking {
    return {
      id: row.id,
      customerId: row.customerId,
      customerName,
      itemId: row.itemId,
      itemName,
      unit,
      qtyBooked: row.qtyBooked,
      qtyIssued: row.qtyIssued,
      qtyRemaining: Math.max(0, row.qtyBooked - row.qtyIssued),
      bookedRatePkr: row.bookedRatePkr,
      advancePkr: row.advancePkr ?? 0,
      bookedValuePkr: Math.round(row.qtyBooked * row.bookedRatePkr),
      deliveredValuePkr: Math.round(row.qtyIssued * row.bookedRatePkr),
      remainingValuePkr: Math.round(Math.max(0, row.qtyBooked - row.qtyIssued) * row.bookedRatePkr),
      status: row.status === "partial" || row.status === "completed" || row.status === "cancelled" ? row.status : "open",
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async customerBookingSummary(customerId: string) {
    const rows = await this.db.select().from(tradeflowBookings).where(eq(tradeflowBookings.customerId, customerId));
    return {
      bookedValuePkr: rows.reduce((s, b) => s + Math.round(b.qtyBooked * b.bookedRatePkr), 0),
      deliveredValuePkr: rows.reduce((s, b) => s + Math.round(b.qtyIssued * b.bookedRatePkr), 0),
      remainingValuePkr: rows.reduce((s, b) => s + Math.round(Math.max(0, b.qtyBooked - b.qtyIssued) * b.bookedRatePkr), 0),
      advancePkr: rows.reduce((s, b) => s + (b.advancePkr ?? 0), 0),
    };
  }

  private async upsertPartyRate(organizationId: string, branchId: string, customerId: string, itemId: string, lastRatePkr: number) {
    const [existing] = await this.db
      .select()
      .from(tradeflowPartyRates)
      .where(
        and(
          eq(tradeflowPartyRates.organizationId, organizationId),
          eq(tradeflowPartyRates.branchId, branchId),
          eq(tradeflowPartyRates.customerId, customerId),
          eq(tradeflowPartyRates.itemId, itemId),
        ),
      )
      .limit(1);
    if (existing) {
      await this.db.update(tradeflowPartyRates).set({ lastRatePkr, updatedAt: new Date() }).where(eq(tradeflowPartyRates.id, existing.id));
      return;
    }
    await this.db.insert(tradeflowPartyRates).values({ organizationId, branchId, customerId, itemId, lastRatePkr });
  }

  private async ensureCashCustomer(organizationId: string, branchId: string) {
    const [existing] = await this.db
      .select()
      .from(tradeflowCustomers)
      .where(and(eq(tradeflowCustomers.organizationId, organizationId), eq(tradeflowCustomers.branchId, branchId), eq(tradeflowCustomers.isCash, 1)))
      .limit(1);
    if (existing) return existing;
    const [created] = await this.db
      .insert(tradeflowCustomers)
      .values({ organizationId, branchId, name: "Cash", isCash: 1, closingBalancePkr: 0 })
      .returning();
    if (!created) throw new BadRequestException("Could not create Cash party");
    return created;
  }

  private async ensureSeed(organizationId: string, branchId: string) {
    await this.ensureCashCustomer(organizationId, branchId);
    const [person] = await this.db
      .select()
      .from(tradeflowSalesPersons)
      .where(and(eq(tradeflowSalesPersons.organizationId, organizationId), eq(tradeflowSalesPersons.branchId, branchId)))
      .limit(1);
    if (!person) {
      await this.db.insert(tradeflowSalesPersons).values([
        { organizationId, branchId, name: "Ali Khan" },
        { organizationId, branchId, name: "Sana Malik" },
      ]);
    }
    const [existingItem] = await this.db
      .select()
      .from(tradeflowItems)
      .where(and(eq(tradeflowItems.organizationId, organizationId), eq(tradeflowItems.branchId, branchId)))
      .limit(1);
    if (!existingItem) {
      await this.db.insert(tradeflowItems).values(ITEM_SEEDS.map((item) => ({ organizationId, branchId, ...item })));
    }
    const named = await this.db
      .select()
      .from(tradeflowCustomers)
      .where(and(eq(tradeflowCustomers.organizationId, organizationId), eq(tradeflowCustomers.branchId, branchId), eq(tradeflowCustomers.isCash, 0)))
      .limit(1);
    if (named.length === 0) {
      await this.db.insert(tradeflowCustomers).values([
        { organizationId, branchId, name: "Kashif", phone: "0300-1111111", isCash: 0, closingBalancePkr: 12500 },
        { organizationId, branchId, name: "Rehan", phone: "0300-2222222", isCash: 0, closingBalancePkr: 8400 },
      ]);
    }
    const [supplier] = await this.db
      .select()
      .from(tradeflowSuppliers)
      .where(and(eq(tradeflowSuppliers.organizationId, organizationId), eq(tradeflowSuppliers.branchId, branchId)))
      .limit(1);
    if (!supplier) {
      await this.db.insert(tradeflowSuppliers).values([
        { organizationId, branchId, name: "Lucky Cement", phone: "0300-3333333", closingBalancePkr: 45000 },
        { organizationId, branchId, name: "Steel House", phone: "0300-4444444", closingBalancePkr: 28000 },
      ]);
    }
    const [account] = await this.db
      .select()
      .from(tradeflowAccounts)
      .where(and(eq(tradeflowAccounts.organizationId, organizationId), eq(tradeflowAccounts.branchId, branchId)))
      .limit(1);
    if (!account) {
      await this.db.insert(tradeflowAccounts).values([
        { organizationId, branchId, name: "Cash", kind: "cash" },
        { organizationId, branchId, name: "Bank - HBL", kind: "bank" },
        { organizationId, branchId, name: "Bank - Meezan", kind: "bank" },
      ]);
    }
    await this.ensureSettings(organizationId, branchId);
  }

  private async ensureSettings(organizationId: string, branchId: string) {
    const [existing] = await this.db
      .select()
      .from(tradeflowSettings)
      .where(and(eq(tradeflowSettings.organizationId, organizationId), eq(tradeflowSettings.branchId, branchId)))
      .limit(1);
    if (existing) return existing;
    const [created] = await this.db
      .insert(tradeflowSettings)
      .values({ organizationId, branchId, whatsappTaxMessage: "Thank you. Tax invoice is attached. Please pay on due date." })
      .returning();
    if (!created) throw new BadRequestException("Could not create TradeFlow settings");
    return created;
  }

  resolveBranchPublic(organizationId: string, branchCode: string) {
    return this.resolveBranch(organizationId, branchCode);
  }

  ensureSeedPublic(organizationId: string, branchId: string) {
    return this.ensureSeed(organizationId, branchId);
  }

  ensureSettingsPublic(organizationId: string, branchId: string) {
    return this.ensureSettings(organizationId, branchId);
  }

  mapCustomerPublic(row: typeof tradeflowCustomers.$inferSelect) {
    return this.mapCustomer(row);
  }

  private async resolveBranch(organizationId: string, branchCode: string) {
    const code = branchCode.trim();
    if (!code) throw new BadRequestException("branchCode is required");
    const [branch] = await this.db
      .select()
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, code)))
      .limit(1);
    if (branch) return branch;
    if (code === "MAIN") {
      const [created] = await this.db.insert(popsBranches).values({ organizationId, code: "MAIN", name: "Main System", city: "Head Office" }).returning();
      if (created) return created;
    }
    throw new NotFoundException(`Branch not found: ${code}`);
  }
}
