import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTradeFlowContra,
  CreateTradeFlowExpense,
  CreateTradeFlowJournal,
  CreateTradeFlowNote,
  CreateTradeFlowPayment,
  CreateTradeFlowPurchase,
  CreateTradeFlowReturn,
  CreateTradeFlowSupplier,
  TradeFlowAccount,
  UpdateTradeFlowSupplier,
  TradeFlowContra,
  TradeFlowExpense,
  TradeFlowJournal,
  TradeFlowLedger,
  TradeFlowNote,
  TradeFlowPayment,
  TradeFlowPurchase,
  TradeFlowReturn,
  TradeFlowSettings,
  TradeFlowSupplier,
  TradeFlowWhatsapp,
  UpdateTradeFlowSettings,
} from "@platform/contracts";
import { and, desc, eq } from "drizzle-orm";
import {
  tradeflowAccounts,
  tradeflowBookings,
  tradeflowContraEntries,
  tradeflowCustomers,
  tradeflowExpenses,
  tradeflowItems,
  tradeflowJournalEntries,
  tradeflowNotes,
  tradeflowPayments,
  tradeflowPurchaseLines,
  tradeflowPurchases,
  tradeflowReturns,
  tradeflowSettings,
  tradeflowSuppliers,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { TradeFlowService } from "./tradeflow.service";
import { roundMoney, toPrimaryQty, waUrl } from "./tradeflow.units";

@Injectable()
export class TradeFlowBooksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly core: TradeFlowService,
  ) {}

  async listSuppliers(organizationId: string, branchCode: string): Promise<TradeFlowSupplier[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    await this.core.ensureSeedPublic(organizationId, branch.id);
    const rows = await this.db
      .select()
      .from(tradeflowSuppliers)
      .where(and(eq(tradeflowSuppliers.organizationId, organizationId), eq(tradeflowSuppliers.branchId, branch.id)))
      .orderBy(tradeflowSuppliers.name);
    return rows.map((r) => this.mapSupplier(r));
  }

  async createSupplier(organizationId: string, input: CreateTradeFlowSupplier): Promise<TradeFlowSupplier> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    const [row] = await this.db
      .insert(tradeflowSuppliers)
      .values({
        organizationId,
        branchId: branch.id,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not create supplier");
    return this.mapSupplier(row);
  }

  async updateSupplier(organizationId: string, supplierId: string, input: UpdateTradeFlowSupplier): Promise<TradeFlowSupplier> {
    const [existing] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, supplierId)).limit(1);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundException("Supplier not found");
    const [row] = await this.db
      .update(tradeflowSuppliers)
      .set({
        name: input.name?.trim() || existing.name,
        phone: input.phone !== undefined ? input.phone.trim() || null : existing.phone,
        address: input.address !== undefined ? input.address.trim() || null : existing.address,
      })
      .where(eq(tradeflowSuppliers.id, supplierId))
      .returning();
    if (!row) throw new BadRequestException("Could not update supplier");
    return this.mapSupplier(row);
  }

  async listAccounts(organizationId: string, branchCode: string): Promise<TradeFlowAccount[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    await this.core.ensureSeedPublic(organizationId, branch.id);
    const rows = await this.db
      .select()
      .from(tradeflowAccounts)
      .where(and(eq(tradeflowAccounts.organizationId, organizationId), eq(tradeflowAccounts.branchId, branch.id)))
      .orderBy(tradeflowAccounts.name);
    return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind }));
  }

  async getSettings(organizationId: string, branchCode: string): Promise<TradeFlowSettings> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const row = await this.core.ensureSettingsPublic(organizationId, branch.id);
    return { whatsappTaxMessage: row.whatsappTaxMessage };
  }

  async updateSettings(organizationId: string, input: UpdateTradeFlowSettings): Promise<TradeFlowSettings> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    const existing = await this.core.ensureSettingsPublic(organizationId, branch.id);
    const [row] = await this.db
      .update(tradeflowSettings)
      .set({ whatsappTaxMessage: input.whatsappTaxMessage.trim(), updatedAt: new Date() })
      .where(eq(tradeflowSettings.id, existing.id))
      .returning();
    return { whatsappTaxMessage: row?.whatsappTaxMessage ?? input.whatsappTaxMessage };
  }

  async getLedger(organizationId: string, branchCode: string, customerId: string, filter = "all"): Promise<TradeFlowLedger> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, customerId)).limit(1);
    if (!customer || customer.organizationId !== organizationId) throw new NotFoundException("Customer not found");
    const bookings = await this.core.listBookings(organizationId, branchCode);
    const partyBookings = bookings.filter((b) => b.customerId === customerId);
    const invoices = (await this.core.listInvoices(organizationId, branchCode)).filter((i) => i.customerId === customerId);
    const payments = await this.listPayments(organizationId, branchCode, "customer", customerId);
    const returns = (await this.listReturns(organizationId, branchCode)).filter((r) => r.partyType === "customer" && r.partyId === customerId);

    const bookingValuePkr = partyBookings.reduce((s, b) => s + b.bookedValuePkr, 0);
    const advanceFromBookings = partyBookings.reduce((s, b) => s + b.advancePkr, 0);
    const advanceFromPayments = payments.filter((p) => p.kind === "advance").reduce((s, p) => s + p.amountPkr, 0);
    const advancePkr = Math.max(advanceFromBookings, advanceFromPayments);
    const deliveredValuePkr = partyBookings.reduce((s, b) => s + b.deliveredValuePkr, 0);
    const remainingValuePkr = partyBookings.reduce((s, b) => s + b.remainingValuePkr, 0);
    const salesPkr = invoices.reduce((s, i) => s + i.totalPkr, 0);
    const paymentsPkr = payments.filter((p) => p.kind === "receive" || p.kind === "advance").reduce((s, p) => s + p.amountPkr, 0);
    const returnsPkr = returns.reduce((s, r) => s + r.amountPkr, 0);

    const deliveredItems = invoices.flatMap((inv) =>
      inv.lines.map((line) => ({
        at: inv.createdAt,
        type: "delivered",
        title: `${inv.invoiceNo} · ${line.itemName}`,
        amountPkr: line.lineTotalPkr,
        qty: line.qty,
        itemName: line.itemName,
        unit: line.unit,
        ref: inv.invoiceNo,
      })),
    );

    const entries = [
      ...partyBookings.map((b) => ({
        at: b.createdAt,
        type: "booking",
        title: `Booking ${b.itemName}`,
        amountPkr: b.bookedValuePkr,
        qty: b.qtyBooked,
        itemName: b.itemName,
        unit: b.unit,
        ref: b.id.slice(0, 8),
      })),
      ...invoices.map((i) => ({
        at: i.createdAt,
        type: "sale",
        title: `Invoice ${i.invoiceNo}`,
        amountPkr: i.totalPkr,
        qty: null,
        itemName: i.lines.map((l) => l.itemName).join(", ") || null,
        unit: null,
        ref: i.invoiceNo,
      })),
      ...deliveredItems,
      ...payments.map((p) => ({
        at: p.createdAt,
        type: p.kind === "advance" ? "advance" : "payment",
        title: p.kind === "advance" ? "Advance payment" : "Payment received",
        amountPkr: p.amountPkr,
        qty: null,
        itemName: null,
        unit: null,
        ref: p.ref,
      })),
      ...returns.map((r) => ({
        at: r.createdAt,
        type: "return",
        title: `Sales return${r.itemName ? ` · ${r.itemName}` : ""}`,
        amountPkr: r.amountPkr,
        qty: r.qty,
        itemName: r.itemName,
        unit: null,
        ref: r.id.slice(0, 8),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const filtered = filter === "item"
      ? entries.filter((e) => e.type === "delivered" || e.type === "booking")
      : filter === "payments"
        ? entries.filter((e) => e.type === "payment" || e.type === "advance")
        : filter === "sales"
          ? entries.filter((e) => e.type === "sale")
          : filter === "returns"
            ? entries.filter((e) => e.type === "return")
            : filter === "bookings"
              ? entries.filter((e) => e.type === "booking")
              : entries;

    return {
      customer: this.core.mapCustomerPublic(customer),
      summary: {
        bookingValuePkr,
        advancePkr,
        deliveredValuePkr,
        remainingValuePkr,
        salesPkr,
        paymentsPkr,
        returnsPkr,
        closingBalancePkr: customer.closingBalancePkr,
      },
      bookings: partyBookings,
      deliveredItems,
      remainingBookings: partyBookings.filter((b) => b.qtyRemaining > 0),
      payments,
      invoices,
      returns,
      entries: filtered,
    };
  }

  async listPayments(organizationId: string, branchCode: string, partyType?: string, partyId?: string): Promise<TradeFlowPayment[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowPayments)
      .where(and(eq(tradeflowPayments.organizationId, organizationId), eq(tradeflowPayments.branchId, branch.id)))
      .orderBy(desc(tradeflowPayments.createdAt));
    const out: TradeFlowPayment[] = [];
    for (const row of rows) {
      if (partyType && row.partyType !== partyType) continue;
      if (partyId && row.partyId !== partyId) continue;
      out.push(await this.mapPayment(row));
    }
    return out;
  }

  async createPayment(organizationId: string, input: CreateTradeFlowPayment): Promise<TradeFlowPayment> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    const amount = roundMoney(input.amountPkr);
    if (amount <= 0) throw new BadRequestException("Amount must be greater than 0");
    const [row] = await this.db
      .insert(tradeflowPayments)
      .values({
        organizationId,
        branchId: branch.id,
        partyType: input.partyType,
        partyId: input.partyId,
        kind: input.kind,
        amountPkr: amount,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not save payment");
    if (input.partyType === "customer") {
      const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, input.partyId)).limit(1);
      if (!customer) throw new NotFoundException("Customer not found");
      const next = input.kind === "pay" ? customer.closingBalancePkr + amount : Math.max(0, customer.closingBalancePkr - amount);
      await this.db.update(tradeflowCustomers).set({ closingBalancePkr: next }).where(eq(tradeflowCustomers.id, customer.id));
    } else {
      const [supplier] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, input.partyId)).limit(1);
      if (!supplier) throw new NotFoundException("Supplier not found");
      const next = input.kind === "receive" ? supplier.closingBalancePkr + amount : Math.max(0, supplier.closingBalancePkr - amount);
      await this.db.update(tradeflowSuppliers).set({ closingBalancePkr: next }).where(eq(tradeflowSuppliers.id, supplier.id));
    }
    return this.mapPayment(row);
  }

  async listPurchases(organizationId: string, branchCode: string): Promise<TradeFlowPurchase[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowPurchases)
      .where(and(eq(tradeflowPurchases.organizationId, organizationId), eq(tradeflowPurchases.branchId, branch.id)))
      .orderBy(desc(tradeflowPurchases.createdAt));
    const out: TradeFlowPurchase[] = [];
    for (const row of rows) out.push(await this.hydratePurchase(row));
    return out;
  }

  async getPurchase(organizationId: string, purchaseId: string): Promise<TradeFlowPurchase> {
    const [row] = await this.db.select().from(tradeflowPurchases).where(eq(tradeflowPurchases.id, purchaseId)).limit(1);
    if (!row || row.organizationId !== organizationId) throw new NotFoundException("Purchase not found");
    return this.hydratePurchase(row);
  }

  async createPurchase(organizationId: string, input: CreateTradeFlowPurchase): Promise<TradeFlowPurchase> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    await this.core.ensureSeedPublic(organizationId, branch.id);
    const [supplier] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, input.supplierId)).limit(1);
    if (!supplier || supplier.organizationId !== organizationId) throw new NotFoundException("Supplier not found");
    const priced = [];
    for (const line of input.lines) {
      const [item] = await this.db.select().from(tradeflowItems).where(eq(tradeflowItems.id, line.itemId)).limit(1);
      if (!item || item.organizationId !== organizationId) throw new NotFoundException("Item not found");
      const unitKind = line.unitKind === "alt" ? "alt" : "primary";
      const primaryQty = toPrimaryQty(item, line.qty, unitKind);
      const rate = roundMoney(line.ratePkr);
      const lineTotalPkr = unitKind === "alt" ? roundMoney(line.qty) : roundMoney(primaryQty * rate);
      priced.push({ item, unitKind, qty: line.qty, primaryQty, ratePkr: rate, lineTotalPkr });
    }
    const totalPkr = priced.reduce((s, l) => s + l.lineTotalPkr, 0);
    const paidPkr = Math.min(totalPkr, roundMoney(input.paidPkr ?? 0));
    const [purchase] = await this.db
      .insert(tradeflowPurchases)
      .values({
        organizationId,
        branchId: branch.id,
        invoiceNo: `TP-${Date.now().toString(36).toUpperCase()}`,
        supplierId: supplier.id,
        totalPkr,
        paidPkr,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!purchase) throw new BadRequestException("Could not save purchase");
    for (const line of priced) {
      await this.db.insert(tradeflowPurchaseLines).values({
        purchaseId: purchase.id,
        itemId: line.item.id,
        qty: line.qty,
        ratePkr: line.ratePkr,
        unitKind: line.unitKind,
        lineTotalPkr: line.lineTotalPkr,
      });
      await this.db
        .update(tradeflowItems)
        .set({ onHandQty: line.item.onHandQty + line.primaryQty })
        .where(eq(tradeflowItems.id, line.item.id));
    }
    const due = Math.max(0, totalPkr - paidPkr);
    if (due > 0) {
      await this.db.update(tradeflowSuppliers).set({ closingBalancePkr: supplier.closingBalancePkr + due }).where(eq(tradeflowSuppliers.id, supplier.id));
    }
    if (paidPkr > 0) {
      await this.db.insert(tradeflowPayments).values({
        organizationId,
        branchId: branch.id,
        partyType: "supplier",
        partyId: supplier.id,
        kind: "pay",
        amountPkr: paidPkr,
        ref: purchase.invoiceNo,
        notes: "Purchase payment",
      });
    }
    return this.getPurchase(organizationId, purchase.id);
  }

  async listReturns(organizationId: string, branchCode: string): Promise<TradeFlowReturn[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowReturns)
      .where(and(eq(tradeflowReturns.organizationId, organizationId), eq(tradeflowReturns.branchId, branch.id)))
      .orderBy(desc(tradeflowReturns.createdAt));
    const out: TradeFlowReturn[] = [];
    for (const row of rows) out.push(await this.mapReturn(row));
    return out;
  }

  async createReturn(organizationId: string, input: CreateTradeFlowReturn): Promise<TradeFlowReturn> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    const amount = roundMoney(input.amountPkr);
    const qty = input.qty ?? 0;
    if (input.itemId && qty > 0) {
      const [item] = await this.db.select().from(tradeflowItems).where(eq(tradeflowItems.id, input.itemId)).limit(1);
      if (item) {
        const nextQty = input.kind === "sales" ? item.onHandQty + qty : Math.max(0, item.onHandQty - qty);
        await this.db.update(tradeflowItems).set({ onHandQty: nextQty }).where(eq(tradeflowItems.id, item.id));
      }
    }
    const [row] = await this.db
      .insert(tradeflowReturns)
      .values({
        organizationId,
        branchId: branch.id,
        kind: input.kind,
        partyType: input.partyType,
        partyId: input.partyId,
        itemId: input.itemId ?? null,
        qty,
        amountPkr: amount,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not save return");
    if (input.partyType === "customer") {
      const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, input.partyId)).limit(1);
      if (customer) {
        await this.db.update(tradeflowCustomers).set({ closingBalancePkr: Math.max(0, customer.closingBalancePkr - amount) }).where(eq(tradeflowCustomers.id, customer.id));
      }
    } else {
      const [supplier] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, input.partyId)).limit(1);
      if (supplier) {
        await this.db.update(tradeflowSuppliers).set({ closingBalancePkr: Math.max(0, supplier.closingBalancePkr - amount) }).where(eq(tradeflowSuppliers.id, supplier.id));
      }
    }
    return this.mapReturn(row);
  }

  async listNotes(organizationId: string, branchCode: string): Promise<TradeFlowNote[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowNotes)
      .where(and(eq(tradeflowNotes.organizationId, organizationId), eq(tradeflowNotes.branchId, branch.id)))
      .orderBy(desc(tradeflowNotes.createdAt));
    const out: TradeFlowNote[] = [];
    for (const row of rows) out.push(await this.mapNote(row));
    return out;
  }

  async createNote(organizationId: string, input: CreateTradeFlowNote): Promise<TradeFlowNote> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    const amount = roundMoney(input.amountPkr);
    const [row] = await this.db
      .insert(tradeflowNotes)
      .values({
        organizationId,
        branchId: branch.id,
        kind: input.kind,
        partyType: input.partyType,
        partyId: input.partyId,
        amountPkr: amount,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not save note");
    const delta = input.kind === "debit" ? amount : -amount;
    if (input.partyType === "customer") {
      const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, input.partyId)).limit(1);
      if (customer) {
        await this.db.update(tradeflowCustomers).set({ closingBalancePkr: Math.max(0, customer.closingBalancePkr + delta) }).where(eq(tradeflowCustomers.id, customer.id));
      }
    } else {
      const [supplier] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, input.partyId)).limit(1);
      if (supplier) {
        await this.db.update(tradeflowSuppliers).set({ closingBalancePkr: Math.max(0, supplier.closingBalancePkr + delta) }).where(eq(tradeflowSuppliers.id, supplier.id));
      }
    }
    return this.mapNote(row);
  }

  async listJournal(organizationId: string, branchCode: string): Promise<TradeFlowJournal[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowJournalEntries)
      .where(and(eq(tradeflowJournalEntries.organizationId, organizationId), eq(tradeflowJournalEntries.branchId, branch.id)))
      .orderBy(desc(tradeflowJournalEntries.createdAt));
    const out: TradeFlowJournal[] = [];
    for (const row of rows) out.push(await this.mapJournal(row));
    return out;
  }

  async createJournal(organizationId: string, input: CreateTradeFlowJournal): Promise<TradeFlowJournal> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    if (input.debitAccountId === input.creditAccountId) throw new BadRequestException("Debit and credit accounts must be different");
    const [debit] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, input.debitAccountId)).limit(1);
    const [credit] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, input.creditAccountId)).limit(1);
    if (!debit || !credit) throw new NotFoundException("Account not found");
    const [row] = await this.db
      .insert(tradeflowJournalEntries)
      .values({
        organizationId,
        branchId: branch.id,
        entryNo: `JV-${Date.now().toString(36).toUpperCase()}`,
        debitAccountId: input.debitAccountId,
        creditAccountId: input.creditAccountId,
        amountPkr: roundMoney(input.amountPkr),
        narration: input.narration?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not save journal");
    return this.mapJournal(row);
  }

  async listContra(organizationId: string, branchCode: string): Promise<TradeFlowContra[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowContraEntries)
      .where(and(eq(tradeflowContraEntries.organizationId, organizationId), eq(tradeflowContraEntries.branchId, branch.id)))
      .orderBy(desc(tradeflowContraEntries.createdAt));
    const out: TradeFlowContra[] = [];
    for (const row of rows) out.push(await this.mapContra(row));
    return out;
  }

  async createContra(organizationId: string, input: CreateTradeFlowContra): Promise<TradeFlowContra> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    if (input.fromAccountId === input.toAccountId) throw new BadRequestException("From and to accounts must be different");
    const [from] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, input.fromAccountId)).limit(1);
    const [to] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, input.toAccountId)).limit(1);
    if (!from || !to) throw new NotFoundException("Account not found");
    const [row] = await this.db
      .insert(tradeflowContraEntries)
      .values({
        organizationId,
        branchId: branch.id,
        entryNo: `CT-${Date.now().toString(36).toUpperCase()}`,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amountPkr: roundMoney(input.amountPkr),
        narration: input.narration?.trim() || "Contra transfer",
      })
      .returning();
    if (!row) throw new BadRequestException("Could not save contra");
    return this.mapContra(row);
  }

  async listExpenses(organizationId: string, branchCode: string): Promise<TradeFlowExpense[]> {
    const branch = await this.core.resolveBranchPublic(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(tradeflowExpenses)
      .where(and(eq(tradeflowExpenses.organizationId, organizationId), eq(tradeflowExpenses.branchId, branch.id)))
      .orderBy(desc(tradeflowExpenses.createdAt));
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      amountPkr: r.amountPkr,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createExpense(organizationId: string, input: CreateTradeFlowExpense): Promise<TradeFlowExpense> {
    const branch = await this.core.resolveBranchPublic(organizationId, input.branchCode);
    const [row] = await this.db
      .insert(tradeflowExpenses)
      .values({
        organizationId,
        branchId: branch.id,
        label: input.label.trim(),
        amountPkr: roundMoney(input.amountPkr),
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!row) throw new BadRequestException("Could not save expense");
    return { id: row.id, label: row.label, amountPkr: row.amountPkr, notes: row.notes, createdAt: row.createdAt.toISOString() };
  }

  async whatsapp(
    organizationId: string,
    branchCode: string,
    kind: "invoice" | "reminder" | "purchase",
    partyType: "customer" | "supplier",
    partyId?: string,
    invoiceId?: string,
    purchaseId?: string,
  ): Promise<TradeFlowWhatsapp> {
    const settings = await this.getSettings(organizationId, branchCode);
    let phone: string | null = null;
    let message = settings.whatsappTaxMessage;
    if (kind === "invoice" && invoiceId) {
      const invoice = await this.core.getInvoice(organizationId, invoiceId);
      phone = invoice.customerPhone;
      message = `MaterialFlow Invoice ${invoice.invoiceNo}\nParty: ${invoice.customerName}\nTotal: Rs ${invoice.totalPkr.toLocaleString()}\nReceived: Rs ${invoice.receivedPkr.toLocaleString()}\n\n${settings.whatsappTaxMessage}`;
    } else if (kind === "purchase" && purchaseId) {
      const purchase = await this.getPurchase(organizationId, purchaseId);
      phone = purchase.supplierPhone;
      message = `MaterialFlow Purchase ${purchase.invoiceNo}\nSupplier: ${purchase.supplierName}\nTotal: Rs ${purchase.totalPkr.toLocaleString()}\nPaid: Rs ${purchase.paidPkr.toLocaleString()}\n\n${settings.whatsappTaxMessage}`;
    } else if (kind === "reminder") {
      if (partyType === "customer" && partyId) {
        const [customer] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, partyId)).limit(1);
        if (!customer) throw new NotFoundException("Customer not found");
        phone = customer.phone;
        message = `Payment reminder for ${customer.name}. Outstanding balance Rs ${customer.closingBalancePkr.toLocaleString()}. Please pay at the earliest.\n\n${settings.whatsappTaxMessage}`;
      } else if (partyType === "supplier" && partyId) {
        const [supplier] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, partyId)).limit(1);
        if (!supplier) throw new NotFoundException("Supplier not found");
        phone = supplier.phone;
        message = `Payment update for ${supplier.name}. Current balance Rs ${supplier.closingBalancePkr.toLocaleString()}.\n\n${settings.whatsappTaxMessage}`;
      }
    }
    return { phone, message, waUrl: waUrl(phone, message) };
  }

  private mapSupplier(row: typeof tradeflowSuppliers.$inferSelect): TradeFlowSupplier {
    return { id: row.id, name: row.name, phone: row.phone, address: row.address, closingBalancePkr: row.closingBalancePkr };
  }

  private async mapPayment(row: typeof tradeflowPayments.$inferSelect): Promise<TradeFlowPayment> {
    const name = await this.partyName(row.partyType, row.partyId);
    return {
      id: row.id,
      partyType: row.partyType === "supplier" ? "supplier" : "customer",
      partyId: row.partyId,
      partyName: name,
      kind: row.kind === "pay" || row.kind === "advance" ? row.kind : "receive",
      amountPkr: row.amountPkr,
      ref: row.ref,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async mapReturn(row: typeof tradeflowReturns.$inferSelect): Promise<TradeFlowReturn> {
    const [item] = row.itemId ? await this.db.select().from(tradeflowItems).where(eq(tradeflowItems.id, row.itemId)).limit(1) : [];
    return {
      id: row.id,
      kind: row.kind === "purchase" ? "purchase" : "sales",
      partyType: row.partyType === "supplier" ? "supplier" : "customer",
      partyId: row.partyId,
      partyName: await this.partyName(row.partyType, row.partyId),
      itemId: row.itemId,
      itemName: item?.name ?? null,
      qty: row.qty,
      amountPkr: row.amountPkr,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async mapNote(row: typeof tradeflowNotes.$inferSelect): Promise<TradeFlowNote> {
    return {
      id: row.id,
      kind: row.kind === "debit" ? "debit" : "credit",
      partyType: row.partyType === "supplier" ? "supplier" : "customer",
      partyId: row.partyId,
      partyName: await this.partyName(row.partyType, row.partyId),
      amountPkr: row.amountPkr,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async mapJournal(row: typeof tradeflowJournalEntries.$inferSelect): Promise<TradeFlowJournal> {
    const [debit] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, row.debitAccountId)).limit(1);
    const [credit] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, row.creditAccountId)).limit(1);
    return {
      id: row.id,
      entryNo: row.entryNo,
      debitAccountId: row.debitAccountId,
      debitAccountName: debit?.name ?? "Debit",
      creditAccountId: row.creditAccountId,
      creditAccountName: credit?.name ?? "Credit",
      amountPkr: row.amountPkr,
      narration: row.narration,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async mapContra(row: typeof tradeflowContraEntries.$inferSelect): Promise<TradeFlowContra> {
    const [from] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, row.fromAccountId)).limit(1);
    const [to] = await this.db.select().from(tradeflowAccounts).where(eq(tradeflowAccounts.id, row.toAccountId)).limit(1);
    return {
      id: row.id,
      entryNo: row.entryNo,
      fromAccountId: row.fromAccountId,
      fromAccountName: from?.name ?? "From",
      toAccountId: row.toAccountId,
      toAccountName: to?.name ?? "To",
      amountPkr: row.amountPkr,
      narration: row.narration,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async hydratePurchase(row: typeof tradeflowPurchases.$inferSelect): Promise<TradeFlowPurchase> {
    const [supplier] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, row.supplierId)).limit(1);
    const lines = await this.db
      .select({ line: tradeflowPurchaseLines, itemName: tradeflowItems.name, unit: tradeflowItems.unit })
      .from(tradeflowPurchaseLines)
      .innerJoin(tradeflowItems, eq(tradeflowItems.id, tradeflowPurchaseLines.itemId))
      .where(eq(tradeflowPurchaseLines.purchaseId, row.id));
    return {
      id: row.id,
      invoiceNo: row.invoiceNo,
      supplierId: row.supplierId,
      supplierName: supplier?.name ?? "Supplier",
      supplierPhone: supplier?.phone ?? null,
      supplierBalancePkr: supplier?.closingBalancePkr ?? 0,
      totalPkr: row.totalPkr,
      paidPkr: row.paidPkr,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      lines: lines.map(({ line, itemName, unit }) => ({
        id: line.id,
        itemId: line.itemId,
        itemName,
        unit,
        unitKind: line.unitKind === "alt" ? "alt" : "primary",
        qty: line.qty,
        ratePkr: line.ratePkr,
        lineTotalPkr: line.lineTotalPkr,
      })),
    };
  }

  private async partyName(partyType: string, partyId: string): Promise<string> {
    if (partyType === "supplier") {
      const [row] = await this.db.select().from(tradeflowSuppliers).where(eq(tradeflowSuppliers.id, partyId)).limit(1);
      return row?.name ?? "Supplier";
    }
    const [row] = await this.db.select().from(tradeflowCustomers).where(eq(tradeflowCustomers.id, partyId)).limit(1);
    return row?.name ?? "Customer";
  }
}
