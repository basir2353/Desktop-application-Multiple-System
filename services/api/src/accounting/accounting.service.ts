import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type {
  CloseCashSession,
  CreateBankAccount,
  CreateBankTransaction,
  CreateCustomerInvoice,
  CreateExpense,
  CreateJournalEntry,
  CreatePayrollRun,
  RecordPayment,
  UpdateTaxSettings,
} from "@platform/contracts";
import {
  popsAccountingAuditLogs,
  popsAccounts,
  popsBankAccounts,
  popsBankTransactions,
  popsBills,
  popsCashSessions,
  popsCustomerInvoices,
  popsCustomerPayments,
  popsExpenses,
  popsGoodsReceipts,
  popsIngredients,
  popsJournalEntries,
  popsJournalLines,
  popsPayrollRuns,
  popsStockAdjustments,
  popsSuppliers,
  popsTaxSettings,
  popsVendorBills,
  popsVendorPayments,
  popsWasteRecords,
  popsBranches,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { AccountingHooksService } from "./accounting-hooks.service";

@Injectable()
export class AccountingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly hooks: AccountingHooksService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedChartForAllBranches();
      await this.backfillSalesEntries();
    } catch (err) {
      this.logger.warn(`Accounting bootstrap skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async ensureBranchChart(organizationId: string, branchId: string): Promise<void> {
    await this.hooks.ensureBranchChart(organizationId, branchId);
    const taxExisting = await this.db
      .select({ id: popsTaxSettings.id })
      .from(popsTaxSettings)
      .where(eq(popsTaxSettings.branchId, branchId))
      .limit(1);
    if (taxExisting.length === 0) {
      await this.db.insert(popsTaxSettings).values({ organizationId, branchId });
    }
  }

  private async seedChartForAllBranches(): Promise<void> {
    const branches = await this.db.select().from(popsBranches);
    for (const branch of branches) {
      await this.ensureBranchChart(branch.organizationId, branch.id);
    }
  }

  private async backfillSalesEntries(): Promise<void> {
    await this.backfillBranchEntries();
  }

  private async backfillBranchEntries(branchId?: string): Promise<void> {
    const billConditions = [eq(popsBills.status, "completed")];
    if (branchId) billConditions.push(eq(popsBills.branchId, branchId));

    const bills = await this.db
      .select()
      .from(popsBills)
      .where(and(...billConditions))
      .orderBy(popsBills.createdAt);

    for (const bill of bills) {
      await this.hooks.ensureBranchChart(bill.organizationId, bill.branchId);
      await this.hooks.recordSaleFromBill(bill.organizationId, bill.branchId, bill);
    }

    const grnConditions = branchId ? [eq(popsGoodsReceipts.branchId, branchId)] : [];
    const grns = await this.db
      .select()
      .from(popsGoodsReceipts)
      .where(grnConditions.length > 0 ? and(...grnConditions) : undefined);

    for (const grn of grns) {
      await this.hooks.ensureBranchChart(grn.organizationId, grn.branchId);
      await this.hooks.recordPurchaseFromGrn(grn.organizationId, grn.branchId, grn);
    }
  }

  async getDashboard(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    await this.ensureBranchChart(organizationId, branch.id);
    await this.backfillBranchEntries(branch.id);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const todaySales = await this.sumAccountCredits(branch.id, ["4101", "4102", "4103", "4104"], today, today);
    const weeklySales = await this.sumAccountCredits(branch.id, ["4101", "4102", "4103", "4104"], weekAgo, today);
    const monthlyRevenue = await this.sumAccountCredits(
      branch.id,
      ["4101", "4102", "4103", "4104"],
      monthStart,
      today,
    );
    const totalExpenses = await this.sumAccountDebits(
      branch.id,
      ["5101", "5201", "5202", "5203", "5204", "5205", "5206", "5207", "4105"],
      monthStart,
      today,
    );
    const cashInHand = await this.getAccountBalance(branch.id, "1101");
    const bankRows = await this.db
      .select()
      .from(popsBankAccounts)
      .where(
        and(
          eq(popsBankAccounts.organizationId, organizationId),
          eq(popsBankAccounts.branchId, branch.id),
          eq(popsBankAccounts.active, true),
        ),
      );
    const bankBalance = bankRows.reduce((s, b) => s + b.balancePkr, 0);

    const arRows = await this.db
      .select()
      .from(popsCustomerInvoices)
      .where(
        and(
          eq(popsCustomerInvoices.organizationId, organizationId),
          eq(popsCustomerInvoices.branchId, branch.id),
        ),
      );
    const outstandingReceivable = arRows.reduce((s, r) => s + (r.amountPkr - r.paidPkr), 0);

    const apRows = await this.db
      .select()
      .from(popsVendorBills)
      .where(
        and(eq(popsVendorBills.organizationId, organizationId), eq(popsVendorBills.branchId, branch.id)),
      );
    const outstandingPayable = apRows.reduce((s, r) => s + (r.amountPkr - r.paidPkr), 0);

    const expenseRows = await this.db
      .select({
        category: popsExpenses.category,
        amount: sql<number>`sum(${popsExpenses.amountPkr})`.mapWith(Number),
      })
      .from(popsExpenses)
      .where(
        and(
          eq(popsExpenses.organizationId, organizationId),
          eq(popsExpenses.branchId, branch.id),
          eq(popsExpenses.status, "Approved"),
          gte(popsExpenses.expenseDate, monthStart),
        ),
      )
      .groupBy(popsExpenses.category)
      .orderBy(desc(sql`sum(${popsExpenses.amountPkr})`))
      .limit(5);

    const recentEntries = await this.listJournal(organizationId, branchCode, { limit: 8 });

    return {
      todaySales,
      weeklySales,
      monthlyRevenue,
      totalExpenses,
      profitLoss: monthlyRevenue - totalExpenses,
      outstandingReceivable,
      outstandingPayable,
      cashInHand,
      bankBalance,
      topExpenseCategories: expenseRows.map((r) => ({
        category: r.category,
        amount: r.amount ?? 0,
      })),
      recentEntries,
    };
  }

  async listAccounts(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const accounts = await this.db
      .select()
      .from(popsAccounts)
      .where(
        and(eq(popsAccounts.organizationId, organizationId), eq(popsAccounts.branchId, branch.id)),
      )
      .orderBy(popsAccounts.code);

    const balances: Array<(typeof accounts)[number] & { balance: number }> = [];
    for (const a of accounts) {
      balances.push({
        ...a,
        balance: await this.getAccountBalanceById(a.id, a.type),
      });
    }

    return balances.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type as "asset" | "liability" | "income" | "expense" | "equity",
      subtype: a.subtype,
      balance: a.balance,
      active: a.active,
    }));
  }

  async listJournal(
    organizationId: string,
    branchCode: string,
    opts?: { from?: string; to?: string; limit?: number },
  ) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const conditions = [
      eq(popsJournalEntries.organizationId, organizationId),
      eq(popsJournalEntries.branchId, branch.id),
      eq(popsJournalEntries.status, "posted"),
    ];
    if (opts?.from) conditions.push(gte(popsJournalEntries.entryDate, opts.from));
    if (opts?.to) conditions.push(lte(popsJournalEntries.entryDate, opts.to));

    const entries = await this.db
      .select()
      .from(popsJournalEntries)
      .where(and(...conditions))
      .orderBy(desc(popsJournalEntries.entryDate), desc(popsJournalEntries.createdAt))
      .limit(opts?.limit ?? 100);

    return Promise.all(entries.map((e) => this.mapJournalEntry(e)));
  }

  async createJournalEntry(
    organizationId: string,
    userEmail: string,
    input: CreateJournalEntry,
  ) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const totalDebit = input.lines.reduce((s: number, l) => s + l.debit, 0);
    const totalCredit = input.lines.reduce((s: number, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit || totalDebit === 0) {
      throw new BadRequestException("Journal entry must balance with non-zero amounts");
    }

    const entryRef = `JV-MAN-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const [entry] = await this.db
      .insert(popsJournalEntries)
      .values({
        organizationId,
        branchId: branch.id,
        entryRef,
        entryDate: input.entryDate,
        source: "manual",
        description: input.description,
        status: "posted",
        createdBy: userEmail,
      })
      .returning();
    if (!entry) throw new BadRequestException("Failed to create entry");

    for (const line of input.lines) {
      await this.db.insert(popsJournalLines).values({
        entryId: entry.id,
        accountId: line.accountId,
        debitPkr: line.debit,
        creditPkr: line.credit,
        memo: line.memo?.trim() || null,
      });
    }

    await this.audit(organizationId, branch.id, "journal", entry.id, "create", userEmail, null, {
      entryRef,
      description: input.description,
    });

    return this.mapJournalEntry(entry);
  }

  async listExpenses(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsExpenses)
      .where(
        and(eq(popsExpenses.organizationId, organizationId), eq(popsExpenses.branchId, branch.id)),
      )
      .orderBy(desc(popsExpenses.expenseDate));

    return rows.map((r) => this.mapExpense(r));
  }

  async createExpense(organizationId: string, userEmail: string, input: CreateExpense) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const expenseRef = `EXP-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const [row] = await this.db
      .insert(popsExpenses)
      .values({
        organizationId,
        branchId: branch.id,
        expenseRef,
        category: input.category,
        amountPkr: Math.round(input.amount),
        expenseDate: input.expenseDate,
        vendor: input.vendor?.trim() || null,
        description: input.description?.trim() || null,
        receiptUrl: input.receiptUrl?.trim() || null,
        recurring: input.recurring,
        status: "Pending",
        submittedBy: userEmail,
      })
      .returning();
    if (!row) throw new BadRequestException("Failed to create expense");

    await this.audit(organizationId, branch.id, "expense", row.id, "create", userEmail, null, {
      expenseRef,
      amount: row.amountPkr,
    });

    return this.mapExpense(row);
  }

  async approveExpense(organizationId: string, userEmail: string, expenseId: string) {
    const rows = await this.db
      .select()
      .from(popsExpenses)
      .where(eq(popsExpenses.id, expenseId))
      .limit(1);
    const expense = rows[0];
    if (!expense || expense.organizationId !== organizationId) {
      throw new NotFoundException("Expense not found");
    }
    if (expense.status !== "Pending") {
      throw new BadRequestException("Only pending expenses can be approved");
    }

    const categoryAccount = this.expenseCategoryAccount(expense.category);
    const entry = await this.hooks.postEntry(organizationId, expense.branchId, {
      entryRef: `JV-EXP-${expense.expenseRef}`,
      entryDate: expense.expenseDate,
      source: "expense",
      sourceRef: expense.expenseRef,
      description: `Expense: ${expense.category} — ${expense.description ?? expense.expenseRef}`,
      createdBy: userEmail,
      lines: [
        { accountCode: categoryAccount, debit: expense.amountPkr, credit: 0 },
        { accountCode: "1101", debit: 0, credit: expense.amountPkr, memo: "Cash payment" },
      ],
    });

    const [updated] = await this.db
      .update(popsExpenses)
      .set({
        status: "Approved",
        approvedBy: userEmail,
        approvedAt: new Date(),
        journalEntryId: entry?.id ?? null,
      })
      .where(eq(popsExpenses.id, expenseId))
      .returning();

    await this.audit(organizationId, expense.branchId, "expense", expenseId, "approve", userEmail, {
      status: "Pending",
    }, { status: "Approved" });

    return this.mapExpense(updated!);
  }

  async getSalesAccounting(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const monthStart = new Date();
    monthStart.setDate(1);
    const from = monthStart.toISOString().slice(0, 10);

    const bills = await this.db
      .select()
      .from(popsBills)
      .where(eq(popsBills.branchId, branch.id))
      .orderBy(desc(popsBills.createdAt))
      .limit(50);

    const completed = bills.filter((b) => b.status === "completed");
    const dineIn = completed
      .filter((b) => !b.tableLabel.toLowerCase().includes("delivery") && !b.tableLabel.toLowerCase().includes("takeaway"))
      .reduce((s, b) => s + b.totalPkr, 0);
    const delivery = completed
      .filter((b) => b.tableLabel.toLowerCase().includes("delivery"))
      .reduce((s, b) => s + b.totalPkr, 0);
    const takeaway = completed
      .filter((b) => b.tableLabel.toLowerCase().includes("takeaway"))
      .reduce((s, b) => s + b.totalPkr, 0);

    return {
      dineIn,
      takeaway,
      delivery,
      discounts: completed.reduce((s, b) => s + b.discountPkr, 0),
      refunds: 0,
      voids: bills.filter((b) => b.status === "void").length,
      taxCollected: completed.reduce((s, b) => s + b.taxPkr, 0),
      serviceCharges: completed.reduce((s, b) => s + b.servicePkr, 0),
      totalSales: completed.reduce((s, b) => s + b.totalPkr, 0),
      recentSales: bills.slice(0, 20).map((b) => ({
        billRef: b.billRef,
        tableLabel: b.tableLabel,
        total: b.totalPkr,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  async listVendorBills(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const bills = await this.db
      .select()
      .from(popsVendorBills)
      .where(
        and(eq(popsVendorBills.organizationId, organizationId), eq(popsVendorBills.branchId, branch.id)),
      )
      .orderBy(desc(popsVendorBills.createdAt));

    return Promise.all(
      bills.map(async (b) => {
        const suppliers = await this.db
          .select()
          .from(popsSuppliers)
          .where(eq(popsSuppliers.id, b.supplierId))
          .limit(1);
        return {
          id: b.id,
          billRef: b.billRef,
          supplierId: b.supplierId,
          supplierName: suppliers[0]?.name ?? "Unknown",
          invoiceNumber: b.invoiceNumber,
          amount: b.amountPkr,
          paid: b.paidPkr,
          balance: b.amountPkr - b.paidPkr,
          dueDate: b.dueDate,
          status: b.status as "open" | "partial" | "paid",
          sourceRef: b.sourceRef,
          createdAt: b.createdAt.toISOString(),
        };
      }),
    );
  }

  async payVendorBill(
    organizationId: string,
    userEmail: string,
    billId: string,
    input: RecordPayment,
  ) {
    const rows = await this.db.select().from(popsVendorBills).where(eq(popsVendorBills.id, billId)).limit(1);
    const bill = rows[0];
    if (!bill || bill.organizationId !== organizationId) throw new NotFoundException("Vendor bill not found");

    const balance = bill.amountPkr - bill.paidPkr;
    if (input.amount > balance) throw new BadRequestException("Payment exceeds balance");

    const paymentRef = `VP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const cashCode = input.method === "bank" ? "1102" : "1101";

    const entry = await this.hooks.postEntry(organizationId, bill.branchId, {
      entryRef: `JV-${paymentRef}`,
      entryDate: input.paymentDate,
      source: "payable",
      sourceRef: bill.billRef,
      description: `Vendor payment ${bill.billRef}`,
      createdBy: userEmail,
      lines: [
        { accountCode: "2101", debit: input.amount, credit: 0 },
        { accountCode: cashCode, debit: 0, credit: input.amount },
      ],
    });

    await this.db.insert(popsVendorPayments).values({
      vendorBillId: bill.id,
      paymentRef,
      amountPkr: input.amount,
      paymentDate: input.paymentDate,
      method: input.method,
      journalEntryId: entry?.id ?? null,
      createdBy: userEmail,
    });

    const newPaid = bill.paidPkr + input.amount;
    const status = newPaid >= bill.amountPkr ? "paid" : "partial";
    await this.db
      .update(popsVendorBills)
      .set({ paidPkr: newPaid, status })
      .where(eq(popsVendorBills.id, billId));

    return { paymentRef, status, balance: bill.amountPkr - newPaid };
  }

  async listCustomerInvoices(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsCustomerInvoices)
      .where(
        and(
          eq(popsCustomerInvoices.organizationId, organizationId),
          eq(popsCustomerInvoices.branchId, branch.id),
        ),
      )
      .orderBy(desc(popsCustomerInvoices.createdAt));

    return rows.map((r) => ({
      id: r.id,
      invoiceRef: r.invoiceRef,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      amount: r.amountPkr,
      paid: r.paidPkr,
      balance: r.amountPkr - r.paidPkr,
      dueDate: r.dueDate,
      status: r.status as "open" | "partial" | "paid",
      description: r.description,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createCustomerInvoice(
    organizationId: string,
    userEmail: string,
    input: CreateCustomerInvoice,
  ) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const invoiceRef = `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const entry = await this.hooks.postEntry(organizationId, branch.id, {
      entryRef: `JV-${invoiceRef}`,
      entryDate: new Date().toISOString().slice(0, 10),
      source: "receivable",
      sourceRef: invoiceRef,
      description: `Customer invoice — ${input.customerName}`,
      createdBy: userEmail,
      lines: [
        { accountCode: "1301", debit: input.amount, credit: 0 },
        { accountCode: "4101", debit: 0, credit: input.amount },
      ],
    });

    const [row] = await this.db
      .insert(popsCustomerInvoices)
      .values({
        organizationId,
        branchId: branch.id,
        invoiceRef,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone?.trim() || null,
        amountPkr: Math.round(input.amount),
        dueDate: input.dueDate ?? null,
        description: input.description?.trim() || null,
        journalEntryId: entry?.id ?? null,
      })
      .returning();

    return this.listCustomerInvoices(organizationId, input.branchCode).then((list) =>
      list.find((i) => i.id === row!.id)!,
    );
  }

  async payCustomerInvoice(
    organizationId: string,
    userEmail: string,
    invoiceId: string,
    input: RecordPayment,
  ) {
    const rows = await this.db
      .select()
      .from(popsCustomerInvoices)
      .where(eq(popsCustomerInvoices.id, invoiceId))
      .limit(1);
    const invoice = rows[0];
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new NotFoundException("Invoice not found");
    }

    const balance = invoice.amountPkr - invoice.paidPkr;
    if (input.amount > balance) throw new BadRequestException("Payment exceeds balance");

    const paymentRef = `CP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const cashCode = input.method === "bank" ? "1102" : "1101";

    const entry = await this.hooks.postEntry(organizationId, invoice.branchId, {
      entryRef: `JV-${paymentRef}`,
      entryDate: input.paymentDate,
      source: "receivable",
      sourceRef: invoice.invoiceRef,
      description: `Customer payment ${invoice.invoiceRef}`,
      createdBy: userEmail,
      lines: [
        { accountCode: cashCode, debit: input.amount, credit: 0 },
        { accountCode: "1301", debit: 0, credit: input.amount },
      ],
    });

    await this.db.insert(popsCustomerPayments).values({
      invoiceId: invoice.id,
      paymentRef,
      amountPkr: input.amount,
      paymentDate: input.paymentDate,
      method: input.method,
      journalEntryId: entry?.id ?? null,
      createdBy: userEmail,
    });

    const newPaid = invoice.paidPkr + input.amount;
    const status = newPaid >= invoice.amountPkr ? "paid" : "partial";
    await this.db
      .update(popsCustomerInvoices)
      .set({ paidPkr: newPaid, status })
      .where(eq(popsCustomerInvoices.id, invoiceId));

    return { paymentRef, status, balance: invoice.amountPkr - newPaid };
  }

  async getInventoryAccounting(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const monthStart = new Date();
    monthStart.setDate(1);
    const from = monthStart.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const ingredients = await this.db
      .select()
      .from(popsIngredients)
      .where(
        and(eq(popsIngredients.organizationId, organizationId), eq(popsIngredients.branchId, branch.id)),
      );
    const stockValuation = ingredients.reduce((s, i) => s + i.currentStock * i.unitCostPkr, 0);

    const cogsToday = await this.sumAccountDebits(branch.id, ["5101"], today, today);
    const cogsMonth = await this.sumAccountDebits(branch.id, ["5101"], from, today);
    const purchaseCostMonth = await this.sumAccountDebits(branch.id, ["5201", "1201"], from, today);

    const wasteRows = await this.db
      .select()
      .from(popsWasteRecords)
      .where(
        and(eq(popsWasteRecords.organizationId, organizationId), eq(popsWasteRecords.branchId, branch.id)),
      );
    const wasteCostMonth = wasteRows
      .filter((w) => w.status === "Approved" && w.createdAt >= monthStart)
      .reduce((s, w) => s + w.costImpactPkr, 0);

    const adjRows = await this.db
      .select({
        adj: popsStockAdjustments,
        unitCost: popsIngredients.unitCostPkr,
      })
      .from(popsStockAdjustments)
      .innerJoin(popsIngredients, eq(popsIngredients.id, popsStockAdjustments.ingredientId))
      .where(
        and(
          eq(popsStockAdjustments.organizationId, organizationId),
          eq(popsStockAdjustments.branchId, branch.id),
          eq(popsStockAdjustments.status, "Approved"),
        ),
      );
    const adjustmentImpactMonth = adjRows
      .filter((a) => a.adj.createdAt >= monthStart)
      .reduce((s, a) => s + a.adj.qty * a.unitCost, 0);

    return {
      stockValuation,
      cogsToday,
      cogsMonth,
      purchaseCostMonth,
      wasteCostMonth,
      adjustmentImpactMonth,
    };
  }

  async listCashSessions(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsCashSessions)
      .where(
        and(eq(popsCashSessions.organizationId, organizationId), eq(popsCashSessions.branchId, branch.id)),
      )
      .orderBy(desc(popsCashSessions.openedAt))
      .limit(30);

    return rows.map((s) => ({
      id: s.id,
      sessionRef: s.sessionRef,
      openedBy: s.openedBy,
      openedAt: s.openedAt.toISOString(),
      openingFloat: s.openingFloatPkr,
      closedBy: s.closedBy,
      closedAt: s.closedAt?.toISOString() ?? null,
      expectedCash: s.expectedCashPkr,
      countedCash: s.countedCashPkr,
      variance: s.variancePkr,
      status: s.status as "open" | "closed",
      notes: s.notes,
    }));
  }

  async openCashSession(organizationId: string, userEmail: string, branchCode: string, openingFloat: number) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const open = await this.db
      .select()
      .from(popsCashSessions)
      .where(
        and(
          eq(popsCashSessions.branchId, branch.id),
          eq(popsCashSessions.status, "open"),
        ),
      )
      .limit(1);
    if (open.length > 0) throw new BadRequestException("A cash session is already open");

    const sessionRef = `CS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const [row] = await this.db
      .insert(popsCashSessions)
      .values({
        organizationId,
        branchId: branch.id,
        sessionRef,
        openedBy: userEmail,
        openingFloatPkr: openingFloat,
        status: "open",
      })
      .returning();
    if (!row) throw new BadRequestException("Failed to open cash session");

    return {
      id: row.id,
      sessionRef: row.sessionRef,
      openedBy: row.openedBy,
      openedAt: row.openedAt.toISOString(),
      openingFloat: row.openingFloatPkr,
      closedBy: null,
      closedAt: null,
      expectedCash: null,
      countedCash: null,
      variance: null,
      status: "open" as const,
      notes: null,
    };
  }

  async closeCashSession(
    organizationId: string,
    userEmail: string,
    sessionId: string,
    input: CloseCashSession,
  ) {
    const rows = await this.db
      .select()
      .from(popsCashSessions)
      .where(eq(popsCashSessions.id, sessionId))
      .limit(1);
    const session = rows[0];
    if (!session || session.organizationId !== organizationId) {
      throw new NotFoundException("Cash session not found");
    }
    if (session.status !== "open") throw new BadRequestException("Session already closed");

    const cashBalance = await this.getAccountBalance(session.branchId, "1101");
    const expected = session.openingFloatPkr + cashBalance;
    const variance = input.countedCash - expected;

    const [updated] = await this.db
      .update(popsCashSessions)
      .set({
        closedBy: userEmail,
        closedAt: new Date(),
        expectedCashPkr: expected,
        countedCashPkr: input.countedCash,
        variancePkr: variance,
        status: "closed",
        notes: input.notes?.trim() || null,
      })
      .where(eq(popsCashSessions.id, sessionId))
      .returning();

    if (variance !== 0) {
      await this.hooks.postEntry(organizationId, session.branchId, {
        entryRef: `JV-VAR-${session.sessionRef}`,
        entryDate: new Date().toISOString().slice(0, 10),
        source: "cash",
        sourceRef: session.sessionRef,
        description: `Cash variance ${session.sessionRef}`,
        createdBy: userEmail,
        lines:
          variance > 0
            ? [
                { accountCode: "1101", debit: variance, credit: 0 },
                { accountCode: "4101", debit: 0, credit: variance, memo: "Overage" },
              ]
            : [
                { accountCode: "5206", debit: Math.abs(variance), credit: 0, memo: "Shortage" },
                { accountCode: "1101", debit: 0, credit: Math.abs(variance) },
              ],
      });
    }

    return {
      id: updated!.id,
      sessionRef: updated!.sessionRef,
      expectedCash: expected,
      countedCash: input.countedCash,
      variance,
      status: "closed" as const,
    };
  }

  async listBankAccounts(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsBankAccounts)
      .where(
        and(eq(popsBankAccounts.organizationId, organizationId), eq(popsBankAccounts.branchId, branch.id)),
      )
      .orderBy(popsBankAccounts.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      bankName: r.bankName,
      accountNumber: r.accountNumber,
      balance: r.balancePkr,
      active: r.active,
    }));
  }

  async createBankAccount(organizationId: string, userEmail: string, input: CreateBankAccount) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const [row] = await this.db
      .insert(popsBankAccounts)
      .values({
        organizationId,
        branchId: branch.id,
        name: input.name.trim(),
        bankName: input.bankName.trim(),
        accountNumber: input.accountNumber?.trim() || null,
        balancePkr: input.openingBalance,
      })
      .returning();

    if (input.openingBalance > 0) {
      await this.hooks.postEntry(organizationId, branch.id, {
        entryRef: `JV-BANK-OPEN-${row!.id.slice(0, 8)}`,
        entryDate: new Date().toISOString().slice(0, 10),
        source: "bank",
        sourceRef: row!.id,
        description: `Opening balance — ${input.name}`,
        createdBy: userEmail,
        lines: [
          { accountCode: "1102", debit: input.openingBalance, credit: 0 },
          { accountCode: "3001", debit: 0, credit: input.openingBalance },
        ],
      });
    }

    return {
      id: row!.id,
      name: row!.name,
      bankName: row!.bankName,
      accountNumber: row!.accountNumber,
      balance: row!.balancePkr,
      active: row!.active,
    };
  }

  async listBankTransactions(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const txns = await this.db
      .select()
      .from(popsBankTransactions)
      .where(
        and(
          eq(popsBankTransactions.organizationId, organizationId),
          eq(popsBankTransactions.branchId, branch.id),
        ),
      )
      .orderBy(desc(popsBankTransactions.txnDate))
      .limit(50);

    return Promise.all(
      txns.map(async (t) => {
        const accts = await this.db
          .select()
          .from(popsBankAccounts)
          .where(eq(popsBankAccounts.id, t.bankAccountId))
          .limit(1);
        return {
          id: t.id,
          txnRef: t.txnRef,
          bankAccountId: t.bankAccountId,
          bankAccountName: accts[0]?.name ?? "—",
          type: t.type as "deposit" | "withdrawal" | "transfer",
          amount: t.amountPkr,
          txnDate: t.txnDate,
          memo: t.memo,
          createdBy: t.createdBy,
          createdAt: t.createdAt.toISOString(),
        };
      }),
    );
  }

  async createBankTransaction(
    organizationId: string,
    userEmail: string,
    input: CreateBankTransaction,
  ) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const accts = await this.db
      .select()
      .from(popsBankAccounts)
      .where(eq(popsBankAccounts.id, input.bankAccountId))
      .limit(1);
    const acct = accts[0];
    if (!acct || acct.organizationId !== organizationId) {
      throw new NotFoundException("Bank account not found");
    }

    const txnRef = `BT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    let lines: { accountCode: string; debit: number; credit: number; memo?: string }[];

    if (input.type === "deposit") {
      lines = [
        { accountCode: "1102", debit: input.amount, credit: 0 },
        { accountCode: "1101", debit: 0, credit: input.amount, memo: "Cash deposit" },
      ];
      await this.db
        .update(popsBankAccounts)
        .set({ balancePkr: acct.balancePkr + input.amount })
        .where(eq(popsBankAccounts.id, acct.id));
    } else if (input.type === "withdrawal") {
      lines = [
        { accountCode: "1101", debit: input.amount, credit: 0 },
        { accountCode: "1102", debit: 0, credit: input.amount },
      ];
      await this.db
        .update(popsBankAccounts)
        .set({ balancePkr: Math.max(0, acct.balancePkr - input.amount) })
        .where(eq(popsBankAccounts.id, acct.id));
    } else {
      if (!input.targetBankAccountId) {
        throw new BadRequestException("Transfer requires target bank account");
      }
      lines = [
        { accountCode: "1102", debit: input.amount, credit: 0, memo: "Transfer in" },
        { accountCode: "1102", debit: 0, credit: input.amount, memo: "Transfer out" },
      ];
      await this.db
        .update(popsBankAccounts)
        .set({ balancePkr: acct.balancePkr - input.amount })
        .where(eq(popsBankAccounts.id, acct.id));
      const target = await this.db
        .select()
        .from(popsBankAccounts)
        .where(eq(popsBankAccounts.id, input.targetBankAccountId))
        .limit(1);
      if (target[0]) {
        await this.db
          .update(popsBankAccounts)
          .set({ balancePkr: target[0].balancePkr + input.amount })
          .where(eq(popsBankAccounts.id, target[0].id));
      }
    }

    const entry = await this.hooks.postEntry(organizationId, branch.id, {
      entryRef: `JV-${txnRef}`,
      entryDate: input.txnDate,
      source: "bank",
      sourceRef: txnRef,
      description: `Bank ${input.type} — ${acct.name}`,
      createdBy: userEmail,
      lines,
    });

    await this.db.insert(popsBankTransactions).values({
      organizationId,
      branchId: branch.id,
      bankAccountId: input.bankAccountId,
      txnRef,
      type: input.type,
      amountPkr: input.amount,
      txnDate: input.txnDate,
      memo: input.memo?.trim() || null,
      targetBankAccountId: input.targetBankAccountId ?? null,
      journalEntryId: entry?.id ?? null,
      createdBy: userEmail,
    });

    return { txnRef, type: input.type, amount: input.amount };
  }

  async getTaxSettings(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsTaxSettings)
      .where(
        and(eq(popsTaxSettings.organizationId, organizationId), eq(popsTaxSettings.branchId, branch.id)),
      )
      .limit(1);
    const settings = rows[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const from = monthStart.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const taxCollected = await this.sumAccountCredits(branch.id, ["2201"], from, today);
    const taxPaid = await this.sumAccountDebits(branch.id, ["2201"], from, today);

    return {
      taxName: settings?.taxName ?? "GST",
      salesTaxPct: settings?.salesTaxPct ?? 15,
      serviceTaxPct: settings?.serviceTaxPct ?? 10,
      taxRegistrationNo: settings?.taxRegistrationNo ?? null,
      taxCollected,
      taxPaid,
    };
  }

  async updateTaxSettings(organizationId: string, input: UpdateTaxSettings) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const rows = await this.db
      .select()
      .from(popsTaxSettings)
      .where(
        and(eq(popsTaxSettings.organizationId, organizationId), eq(popsTaxSettings.branchId, branch.id)),
      )
      .limit(1);

    if (rows[0]) {
      await this.db
        .update(popsTaxSettings)
        .set({
          taxName: input.taxName ?? rows[0].taxName,
          salesTaxPct: input.salesTaxPct ?? rows[0].salesTaxPct,
          serviceTaxPct: input.serviceTaxPct ?? rows[0].serviceTaxPct,
          taxRegistrationNo: input.taxRegistrationNo ?? rows[0].taxRegistrationNo,
          updatedAt: new Date(),
        })
        .where(eq(popsTaxSettings.id, rows[0].id));
    } else {
      await this.db.insert(popsTaxSettings).values({
        organizationId,
        branchId: branch.id,
        taxName: input.taxName ?? "GST",
        salesTaxPct: input.salesTaxPct ?? 15,
        serviceTaxPct: input.serviceTaxPct ?? 10,
        taxRegistrationNo: input.taxRegistrationNo ?? null,
      });
    }

    return this.getTaxSettings(organizationId, input.branchCode);
  }

  async listPayroll(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsPayrollRuns)
      .where(
        and(eq(popsPayrollRuns.organizationId, organizationId), eq(popsPayrollRuns.branchId, branch.id)),
      )
      .orderBy(desc(popsPayrollRuns.createdAt));

    return rows.map((r) => ({
      id: r.id,
      payrollRef: r.payrollRef,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      totalGross: r.totalGrossPkr,
      totalDeductions: r.totalDeductionsPkr,
      totalNet: r.totalNetPkr,
      staffCount: r.staffCount,
      status: r.status as "draft" | "approved" | "paid",
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createPayrollRun(organizationId: string, userEmail: string, input: CreatePayrollRun) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const net = input.totalGross - input.totalDeductions;
    const payrollRef = `PAY-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const [row] = await this.db
      .insert(popsPayrollRuns)
      .values({
        organizationId,
        branchId: branch.id,
        payrollRef,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalGrossPkr: input.totalGross,
        totalDeductionsPkr: input.totalDeductions,
        totalNetPkr: net,
        staffCount: input.staffCount,
        status: "draft",
        createdBy: userEmail,
      })
      .returning();

    return {
      id: row!.id,
      payrollRef,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalGross: input.totalGross,
      totalDeductions: input.totalDeductions,
      totalNet: net,
      staffCount: input.staffCount,
      status: "draft" as const,
      createdBy: userEmail,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  async approvePayroll(organizationId: string, userEmail: string, payrollId: string) {
    const rows = await this.db
      .select()
      .from(popsPayrollRuns)
      .where(eq(popsPayrollRuns.id, payrollId))
      .limit(1);
    const payroll = rows[0];
    if (!payroll || payroll.organizationId !== organizationId) {
      throw new NotFoundException("Payroll run not found");
    }

    const entry = await this.hooks.postEntry(organizationId, payroll.branchId, {
      entryRef: `JV-${payroll.payrollRef}`,
      entryDate: payroll.periodEnd,
      source: "payroll",
      sourceRef: payroll.payrollRef,
      description: `Payroll ${payroll.periodStart} — ${payroll.periodEnd}`,
      createdBy: userEmail,
      lines: [
        { accountCode: "5204", debit: payroll.totalGrossPkr, credit: 0 },
        { accountCode: "2301", debit: 0, credit: payroll.totalNetPkr },
        { accountCode: "5204", debit: 0, credit: payroll.totalDeductionsPkr, memo: "Deductions" },
      ].filter((l) => l.debit > 0 || l.credit > 0),
    });

    await this.db
      .update(popsPayrollRuns)
      .set({ status: "approved", journalEntryId: entry?.id ?? null })
      .where(eq(popsPayrollRuns.id, payrollId));

    return { payrollRef: payroll.payrollRef, status: "approved" };
  }

  async payPayroll(organizationId: string, userEmail: string, payrollId: string) {
    const rows = await this.db
      .select()
      .from(popsPayrollRuns)
      .where(eq(popsPayrollRuns.id, payrollId))
      .limit(1);
    const payroll = rows[0];
    if (!payroll || payroll.organizationId !== organizationId) {
      throw new NotFoundException("Payroll run not found");
    }
    if (payroll.status !== "approved") {
      throw new BadRequestException("Payroll must be approved before payment");
    }

    await this.hooks.postEntry(organizationId, payroll.branchId, {
      entryRef: `JV-PAY-${payroll.payrollRef}`,
      entryDate: new Date().toISOString().slice(0, 10),
      source: "payroll",
      sourceRef: payroll.payrollRef,
      description: `Payroll payment ${payroll.payrollRef}`,
      createdBy: userEmail,
      lines: [
        { accountCode: "2301", debit: payroll.totalNetPkr, credit: 0 },
        { accountCode: "1102", debit: 0, credit: payroll.totalNetPkr },
      ],
    });

    await this.db
      .update(popsPayrollRuns)
      .set({ status: "paid" })
      .where(eq(popsPayrollRuns.id, payrollId));

    return { payrollRef: payroll.payrollRef, status: "paid" };
  }

  async getReport(organizationId: string, branchCode: string, reportId: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const monthStart = new Date();
    monthStart.setDate(1);
    const from = monthStart.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const generatedAt = new Date().toISOString();

    if (reportId === "trial-balance") {
      const accounts = await this.listAccounts(organizationId, branchCode);
      const rows = accounts.map((a) => ({
        label: `${a.code} — ${a.name}`,
        debit: a.type === "asset" || a.type === "expense" ? Math.max(0, a.balance) : undefined,
        credit: a.type === "liability" || a.type === "income" || a.type === "equity" ? Math.max(0, a.balance) : undefined,
        balance: a.balance,
      }));
      const totalDebit = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
      const totalCredit = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
      return {
        reportId,
        title: "Trial Balance",
        generatedAt,
        rows,
        totals: { debit: totalDebit, credit: totalCredit },
      };
    }

    if (reportId === "profit-loss") {
      const income = await this.sumByType(branch.id, "income");
      const expenses = await this.sumByType(branch.id, "expense");
      const cogs = await this.sumAccountDebits(branch.id, ["5101"], from, today);
      const grossProfit = income - cogs;
      const netProfit = grossProfit - (expenses - cogs);
      return {
        reportId,
        title: "Profit & Loss",
        generatedAt,
        rows: [
          { label: "Revenue", amount: income, indent: 0 },
          { label: "Cost of Goods Sold", amount: -cogs, indent: 1 },
          { label: "Gross Profit", amount: grossProfit, indent: 0 },
          { label: "Operating Expenses", amount: -(expenses - cogs), indent: 1 },
          { label: "Net Profit", amount: netProfit, indent: 0 },
        ],
        totals: { revenue: income, cogs, grossProfit, netProfit },
      };
    }

    if (reportId === "balance-sheet") {
      const assets = await this.sumByType(branch.id, "asset");
      const liabilities = await this.sumByType(branch.id, "liability");
      const equity = await this.sumByType(branch.id, "equity");
      return {
        reportId,
        title: "Balance Sheet",
        generatedAt,
        rows: [
          { label: "Assets", amount: assets, indent: 0 },
          { label: "Liabilities", amount: liabilities, indent: 0 },
          { label: "Equity", amount: equity, indent: 0 },
        ],
        totals: { assets, liabilities, equity },
      };
    }

    if (reportId === "cash-flow") {
      const cashIn = await this.sumAccountDebits(branch.id, ["1101", "1102"], from, today);
      const cashOut = await this.sumAccountCredits(branch.id, ["1101", "1102"], from, today);
      return {
        reportId,
        title: "Cash Flow Statement",
        generatedAt,
        rows: [
          { label: "Cash Inflows", amount: cashIn, indent: 0 },
          { label: "Cash Outflows", amount: -cashOut, indent: 0 },
          { label: "Net Cash Flow", amount: cashIn - cashOut, indent: 0 },
        ],
        totals: { inflows: cashIn, outflows: cashOut, net: cashIn - cashOut },
      };
    }

    if (reportId === "general-ledger") {
      const entries = await this.listJournal(organizationId, branchCode, { from, to: today, limit: 200 });
      const rows = entries.flatMap((e) =>
        e.lines.map((l) => ({
          label: `${e.entryDate} ${e.entryRef} — ${l.accountName}`,
          debit: l.debit || undefined,
          credit: l.credit || undefined,
          memo: l.memo,
        })),
      );
      return { reportId, title: "General Ledger", generatedAt, rows };
    }

    throw new NotFoundException(`Report not found: ${reportId}`);
  }

  async listAuditLogs(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsAccountingAuditLogs)
      .where(
        and(
          eq(popsAccountingAuditLogs.organizationId, organizationId),
          eq(popsAccountingAuditLogs.branchId, branch.id),
        ),
      )
      .orderBy(desc(popsAccountingAuditLogs.createdAt))
      .limit(100);

    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      actorEmail: r.actorEmail,
      oldValue: r.oldValueJson ? (JSON.parse(r.oldValueJson) as Record<string, unknown>) : null,
      newValue: r.newValueJson ? (JSON.parse(r.newValueJson) as Record<string, unknown>) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private expenseCategoryAccount(category: string): string {
    const map: Record<string, string> = {
      Rent: "5203",
      Utilities: "5202",
      Gas: "5202",
      "Staff Meals": "5201",
      Marketing: "5205",
      Maintenance: "5206",
      Internet: "5202",
      Transportation: "5206",
      "Food Purchases": "5201",
      Salaries: "5204",
    };
    return map[category] ?? "5206";
  }

  private async mapJournalEntry(entry: typeof popsJournalEntries.$inferSelect) {
    const lines = await this.db
      .select({
        line: popsJournalLines,
        account: popsAccounts,
      })
      .from(popsJournalLines)
      .innerJoin(popsAccounts, eq(popsAccounts.id, popsJournalLines.accountId))
      .where(eq(popsJournalLines.entryId, entry.id));

    return {
      id: entry.id,
      entryRef: entry.entryRef,
      entryDate: entry.entryDate,
      source: entry.source,
      sourceRef: entry.sourceRef,
      description: entry.description,
      status: entry.status,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt.toISOString(),
      lines: lines.map((r) => ({
        id: r.line.id,
        accountId: r.account.id,
        accountCode: r.account.code,
        accountName: r.account.name,
        debit: r.line.debitPkr,
        credit: r.line.creditPkr,
        memo: r.line.memo,
      })),
    };
  }

  private mapExpense(row: typeof popsExpenses.$inferSelect) {
    return {
      id: row.id,
      expenseRef: row.expenseRef,
      category: row.category,
      amount: row.amountPkr,
      expenseDate: row.expenseDate,
      vendor: row.vendor,
      description: row.description,
      receiptUrl: row.receiptUrl,
      recurring: row.recurring,
      status: row.status as "Pending" | "Approved" | "Rejected" | "Paid",
      submittedBy: row.submittedBy,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async getAccountBalance(branchId: string, code: string): Promise<number> {
    const accts = await this.db
      .select()
      .from(popsAccounts)
      .where(and(eq(popsAccounts.branchId, branchId), eq(popsAccounts.code, code)))
      .limit(1);
    const acct = accts[0];
    if (!acct) return 0;
    return this.getAccountBalanceById(acct.id, acct.type);
  }

  private async getAccountBalanceById(accountId: string, type: string): Promise<number> {
    const result = await this.db
      .select({
        debits: sql<number>`coalesce(sum(${popsJournalLines.debitPkr}), 0)`.mapWith(Number),
        credits: sql<number>`coalesce(sum(${popsJournalLines.creditPkr}), 0)`.mapWith(Number),
      })
      .from(popsJournalLines)
      .innerJoin(popsJournalEntries, eq(popsJournalEntries.id, popsJournalLines.entryId))
      .where(
        and(eq(popsJournalLines.accountId, accountId), eq(popsJournalEntries.status, "posted")),
      );

    const debits = result[0]?.debits ?? 0;
    const credits = result[0]?.credits ?? 0;
    if (type === "asset" || type === "expense") return debits - credits;
    return credits - debits;
  }

  private async sumAccountDebits(
    branchId: string,
    codes: string[],
    from?: string,
    to?: string,
  ): Promise<number> {
    const accounts = await this.db
      .select()
      .from(popsAccounts)
      .where(and(eq(popsAccounts.branchId, branchId)));
    const ids = accounts.filter((a) => codes.includes(a.code)).map((a) => a.id);
    if (ids.length === 0) return 0;

    const conditions = [eq(popsJournalEntries.branchId, branchId), eq(popsJournalEntries.status, "posted")];
    if (from) conditions.push(gte(popsJournalEntries.entryDate, from));
    if (to) conditions.push(lte(popsJournalEntries.entryDate, to));

    const result = await this.db
      .select({
        total: sql<number>`coalesce(sum(${popsJournalLines.debitPkr}), 0)`.mapWith(Number),
      })
      .from(popsJournalLines)
      .innerJoin(popsJournalEntries, eq(popsJournalEntries.id, popsJournalLines.entryId))
      .where(and(...conditions, inArray(popsJournalLines.accountId, ids)));

    return result[0]?.total ?? 0;
  }

  private async sumAccountCredits(
    branchId: string,
    codes: string[],
    from?: string,
    to?: string,
  ): Promise<number> {
    const accounts = await this.db
      .select()
      .from(popsAccounts)
      .where(and(eq(popsAccounts.branchId, branchId)));
    const ids = accounts.filter((a) => codes.includes(a.code)).map((a) => a.id);
    if (ids.length === 0) return 0;

    const conditions = [eq(popsJournalEntries.branchId, branchId), eq(popsJournalEntries.status, "posted")];
    if (from) conditions.push(gte(popsJournalEntries.entryDate, from));
    if (to) conditions.push(lte(popsJournalEntries.entryDate, to));

    const result = await this.db
      .select({
        total: sql<number>`coalesce(sum(${popsJournalLines.creditPkr}), 0)`.mapWith(Number),
      })
      .from(popsJournalLines)
      .innerJoin(popsJournalEntries, eq(popsJournalEntries.id, popsJournalLines.entryId))
      .where(and(...conditions, inArray(popsJournalLines.accountId, ids)));

    return result[0]?.total ?? 0;
  }

  private async sumByType(branchId: string, type: string): Promise<number> {
    const accounts = await this.db
      .select()
      .from(popsAccounts)
      .where(and(eq(popsAccounts.branchId, branchId), eq(popsAccounts.type, type)));

    const balances = await Promise.all(
      accounts.map((a) => this.getAccountBalanceById(a.id, a.type)),
    );
    return balances.reduce((s, b) => s + Math.abs(b), 0);
  }

  private async audit(
    organizationId: string,
    branchId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
  ) {
    await this.db.insert(popsAccountingAuditLogs).values({
      organizationId,
      branchId,
      entityType,
      entityId,
      action,
      actorEmail,
      oldValueJson: oldValue ? JSON.stringify(oldValue) : null,
      newValueJson: newValue ? JSON.stringify(newValue) : null,
    });
  }

  private async resolveBranch(organizationId: string, branchCode: string) {
    const code = branchCode.trim();
    const rows = await this.db
      .select()
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, code)))
      .limit(1);
    const branch = rows[0];
    if (!branch) throw new NotFoundException(`Branch not found: ${code}`);
    return branch;
  }
}
