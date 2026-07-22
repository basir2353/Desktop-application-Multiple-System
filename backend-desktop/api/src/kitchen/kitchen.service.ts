import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { CreateBill, CreateKitchenTicket, KitchenTicketStatus, UpdateKitchenTicket } from "@platform/contracts";
import {
  popsBills,
  popsBranches,
  popsKitchenTickets,
  popsMenuItems,
  users,
  type PlatformPgDb,
} from "@platform/database-pg";
import { BillingService } from "../billing/billing.service";
import { ClosingService } from "../closing/closing.service";
import { DeliveryService } from "../delivery/delivery.service";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { assertDineInTableAvailable } from "../tables/table-booking";

type StoredLine = { label: string; qty: number; unitPrice: number; menuItemId?: string };

@Injectable()
export class KitchenService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly billing: BillingService,
    private readonly delivery: DeliveryService,
    private readonly closing: ClosingService,
  ) {}

  async listTickets(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(
        and(
          eq(popsKitchenTickets.branchId, branch.id),
          ne(popsKitchenTickets.status, "done"),
        ),
      )
      .orderBy(desc(popsKitchenTickets.priority), asc(popsKitchenTickets.createdAt));

    return {
      branchCode: branch.code,
      tickets: await Promise.all(rows.map((row) => this.mapTicketForResponse(row))),
    };
  }

  private async mapTicketForResponse(row: typeof popsKitchenTickets.$inferSelect) {
    const ticket = await this.delivery.mapTicketWithRider(row);
    const lines = await this.enrichLinesFromMenu(
      row.branchId,
      (ticket.lines ?? []).map((line) => {
        const menuItemId =
          "menuItemId" in line && typeof line.menuItemId === "string" ? line.menuItemId : undefined;
        return {
          label: line.label,
          qty: line.qty,
          unitPrice: line.unitPrice ?? 0,
          ...(menuItemId ? { menuItemId } : {}),
        };
      }),
    );
    return { ...ticket, lines };
  }

  async createTicket(
    organizationId: string,
    input: CreateKitchenTicket,
    createdByUserId?: string,
  ) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    await this.closing.assertOrdersNotPaused(branch.id);
    const enrichedLines = await this.enrichLinesFromMenu(
      branch.id,
      input.lines.map((l) => ({
        label: l.label,
        qty: l.qty,
        unitPrice: l.unitPrice ?? 0,
        ...(l.menuItemId ? { menuItemId: l.menuItemId } : {}),
      })),
    );
    const storedLines: StoredLine[] = enrichedLines.map((l) => ({
      label: l.label,
      qty: l.qty,
      unitPrice: l.unitPrice ?? 0,
      ...(l.menuItemId ? { menuItemId: l.menuItemId } : {}),
    }));
    const lineText = storedLines.map((l) => `${l.label} x${l.qty}`).join(", ");
    const notes = input.notes?.trim();
    const itemsSummary = notes ? `${lineText} · ${notes}` : lineText;
    const ticketRef = `KOT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const isDelivery = input.stationLabel.trim().toLowerCase().includes("delivery");
    if (isDelivery && !input.riderId) {
      throw new BadRequestException("A rider is required for delivery orders.");
    }

    let createdByName: string | null = null;
    if (createdByUserId) {
      const userRows = await this.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, createdByUserId))
        .limit(1);
      const email = userRows[0]?.email;
      if (email) createdByName = waiterDisplayName(email);
    }

    await assertDineInTableAvailable(this.db, branch.id, input.stationLabel.trim(), {
      allowOrderRef: input.orderRef,
      intent: "new-order",
    });

    const [row] = await this.db
      .insert(popsKitchenTickets)
      .values({
        organizationId,
        branchId: branch.id,
        ticketRef,
        orderRef: input.orderRef?.trim() || null,
        stationLabel: input.stationLabel.trim(),
        itemsSummary,
        linesJson: JSON.stringify(storedLines),
        priority: input.priority ?? "normal",
        status: "new",
        createdByUserId: createdByUserId ?? null,
        createdByName,
        riderId: input.riderId ?? null,
        deliveryChargePkr: input.deliveryChargePkr ?? 0,
        deliveryStatus: isDelivery
          ? input.riderId
            ? "assigned"
            : "unassigned"
          : null,
      })
      .returning();

    if (!row) throw new BadRequestException("Failed to create kitchen ticket");
    return this.mapTicketForResponse(row);
  }

  async updateTicket(
    organizationId: string,
    ticketId: string,
    input: UpdateKitchenTicket,
    editor?: { userId: string; role: string },
  ) {
    const existing = await this.getTicket(organizationId, ticketId);
    if (existing.status === "done" && (input.lines !== undefined || input.notes !== undefined)) {
      throw new BadRequestException("Cannot edit items on a completed order");
    }

    // Only the waiter who took the order may change its contents. Status-only
    // updates (kitchen marking cooking/ready/done) stay open to everyone, and
    // managers/admins/cashiers can always edit.
    const isContentEdit =
      input.lines !== undefined || input.notes !== undefined || input.stationLabel !== undefined;
    const editorIsStaff = editor && (editor.role === "waiter" || editor.role === "rider");
    if (
      isContentEdit &&
      editorIsStaff &&
      existing.createdByUserId &&
      existing.createdByUserId !== editor.userId
    ) {
      const owner = existing.createdByName ?? "another waiter";
      throw new ForbiddenException(
        `This order was taken by ${owner}. Only they can edit it — you have view access.`,
      );
    }
    if (input.stationLabel !== undefined) {
      if (existing.status === "done") {
        throw new BadRequestException("Cannot change table on a completed order");
      }
      const nextLabel = input.stationLabel.trim();
      if (nextLabel.toLowerCase() !== existing.stationLabel.trim().toLowerCase()) {
        await assertDineInTableAvailable(this.db, existing.branchId, nextLabel, {
          allowOrderRef: existing.orderRef,
          excludeTicketId: existing.id,
          intent: "new-order",
        });
      }
    }

    let linesJson: string | undefined;
    let itemsSummary: string | undefined;
    if (input.lines !== undefined) {
      if (input.lines.length === 0) {
        throw new BadRequestException("Order must include at least one item");
      }
      const storedLines: StoredLine[] = input.lines.map((l) => ({
        label: l.label,
        qty: l.qty,
        unitPrice: l.unitPrice ?? 0,
        ...(l.menuItemId ? { menuItemId: l.menuItemId } : {}),
      }));
      const enrichedLines = await this.enrichLinesFromMenu(existing.branchId, storedLines);
      linesJson = JSON.stringify(
        enrichedLines.map((l) => ({
          label: l.label,
          qty: l.qty,
          unitPrice: l.unitPrice ?? 0,
          ...(l.menuItemId ? { menuItemId: l.menuItemId } : {}),
        })),
      );
      const lineText = enrichedLines.map((l) => `${l.label} x${l.qty}`).join(", ");
      const notes =
        input.notes !== undefined
          ? input.notes?.trim() || null
          : this.extractNotesFromSummary(existing.itemsSummary);
      itemsSummary = notes ? `${lineText} · ${notes}` : lineText;
    } else if (input.notes !== undefined) {
      const storedLines = this.linesFromTicket(existing);
      const lineText =
        storedLines.length > 0
          ? storedLines.map((l) => `${l.label} x${l.qty}`).join(", ")
          : existing.itemsSummary.split(" · ")[0]?.trim() || existing.itemsSummary;
      const notes = input.notes?.trim() || null;
      itemsSummary = notes ? `${lineText} · ${notes}` : lineText;
    }

    const nextStatus = input.status ?? existing.status;

    let billId = existing.billId;
    if (nextStatus === "done" && !billId) {
      const branchRows = await this.db
        .select({ code: popsBranches.code })
        .from(popsBranches)
        .where(eq(popsBranches.id, existing.branchId))
        .limit(1);
      const branchCode = branchRows[0]?.code;
      if (!branchCode) throw new NotFoundException("Branch not found");

      if (existing.orderRef) {
        const existingBill = await this.db
          .select({ id: popsBills.id })
          .from(popsBills)
          .where(
            and(
              eq(popsBills.branchId, existing.branchId),
              eq(popsBills.orderRef, existing.orderRef),
              eq(popsBills.status, "completed"),
            ),
          )
          .limit(1);
        billId = existingBill[0]?.id ?? null;
      }

      if (!billId) {
        let lines = this.linesFromTicket(existing);
        if (lines.length === 0) {
          lines = [
            {
              label: existing.itemsSummary?.trim() || existing.ticketRef,
              qty: 1,
              unitPrice: 0,
            },
          ];
        }
        lines = await this.enrichLinesFromMenu(existing.branchId, lines);
        const bill = await this.billing.createBill(organizationId, {
          branchCode,
          orderRef: existing.orderRef ?? undefined,
          tableLabel: existing.stationLabel,
          waiterName: "Kitchen",
          lines,
          riderId: existing.riderId ?? undefined,
          deliveryChargePkr: existing.deliveryChargePkr,
        });
        billId = bill.id;
      }
    }

    let deliveryStatus = input.deliveryStatus;
    if (input.riderId !== undefined) {
      if (input.riderId && !deliveryStatus) deliveryStatus = "assigned";
      if (input.riderId === null && !deliveryStatus) deliveryStatus = "unassigned";
    }
    if (nextStatus === "done" && existing.stationLabel.toLowerCase().includes("delivery")) {
      deliveryStatus = deliveryStatus ?? "delivered";
    }

    const nextStationLabel = input.stationLabel?.trim() ?? existing.stationLabel;
    const nextRiderId = input.riderId !== undefined ? input.riderId : existing.riderId;
    if (nextStationLabel.toLowerCase().includes("delivery") && !nextRiderId) {
      throw new BadRequestException("A rider is required for delivery orders.");
    }

    const [row] = await this.db
      .update(popsKitchenTickets)
      .set({
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.stationLabel !== undefined
          ? { stationLabel: input.stationLabel.trim() }
          : {}),
        ...(input.riderId !== undefined ? { riderId: input.riderId } : {}),
        ...(input.deliveryChargePkr !== undefined
          ? { deliveryChargePkr: input.deliveryChargePkr }
          : {}),
        ...(deliveryStatus !== undefined ? { deliveryStatus } : {}),
        ...(linesJson !== undefined ? { linesJson } : {}),
        ...(itemsSummary !== undefined ? { itemsSummary } : {}),
        ...(billId ? { billId } : {}),
        ...(nextStatus === "cooking" && !existing.startedAt
          ? { startedAt: new Date() }
          : {}),
      })
      .where(eq(popsKitchenTickets.id, ticketId))
      .returning();

    if (!row) throw new NotFoundException("Kitchen ticket not found");
    return this.mapTicketForResponse(row);
  }

  async bumpPriority(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(
        and(
          eq(popsKitchenTickets.branchId, branch.id),
          ne(popsKitchenTickets.status, "done"),
          eq(popsKitchenTickets.priority, "normal"),
        ),
      )
      .orderBy(asc(popsKitchenTickets.createdAt))
      .limit(1);

    const target = rows[0];
    if (!target) return { ok: true, bumped: null };

    const [row] = await this.db
      .update(popsKitchenTickets)
      .set({ priority: "priority" })
      .where(eq(popsKitchenTickets.id, target.id))
      .returning();

    return { ok: true, bumped: row ? await this.mapTicketForResponse(row) : null };
  }

  private async enrichLinesFromMenu(
    branchId: string,
    lines: CreateBill["lines"],
  ): Promise<CreateBill["lines"]> {
    const menuRows = await this.db
      .select({
        id: popsMenuItems.id,
        name: popsMenuItems.name,
        portion: popsMenuItems.portion,
        price: popsMenuItems.pricePkr,
      })
      .from(popsMenuItems)
      .where(and(eq(popsMenuItems.branchId, branchId), eq(popsMenuItems.isActive, true)));

    return lines.map((line) => {
      if (line.unitPrice > 0 && line.menuItemId) return line;

      if (line.menuItemId) {
        const byId = menuRows.find((item) => item.id === line.menuItemId);
        if (byId) {
          return {
            ...line,
            unitPrice: line.unitPrice > 0 ? line.unitPrice : byId.price,
          };
        }
      }

      const norm = normalizeMenuLabel(line.label);
      const match = menuRows.find((item) => {
        const itemLabel = formatMenuItemLabel(item.name, item.portion);
        return (
          normalizeMenuLabel(itemLabel) === norm ||
          normalizeMenuLabel(item.name) === norm ||
          norm.includes(normalizeMenuLabel(item.name))
        );
      });
      if (!match) return line;
      return {
        ...line,
        unitPrice: line.unitPrice > 0 ? line.unitPrice : match.price,
        menuItemId: match.id,
      };
    });
  }

  private extractNotesFromSummary(summary: string): string | null {
    const idx = summary.lastIndexOf(" · ");
    if (idx === -1) return null;
    const notes = summary.slice(idx + 3).trim();
    return notes || null;
  }

  private linesFromTicket(row: typeof popsKitchenTickets.$inferSelect): CreateBill["lines"] {
    if (row.linesJson) {
      try {
        const parsed = JSON.parse(row.linesJson) as StoredLine[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((l) => ({
            label: l.label,
            qty: l.qty,
            unitPrice: l.unitPrice ?? 0,
            ...(l.menuItemId ? { menuItemId: l.menuItemId } : {}),
          }));
        }
      } catch {
        /* fall through */
      }
    }
    const deliverySplit = row.itemsSummary.split(/\s·\s*Delivery\b/i)[0] ?? row.itemsSummary;
    const foodPart = deliverySplit.split(" · ")[0]?.trim() || deliverySplit.trim();
    return foodPart
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^(.+?)\s+x(\d+)$/i);
        return match
          ? { label: match[1].trim(), qty: Number(match[2]), unitPrice: 0 }
          : { label: part, qty: 1, unitPrice: 0 };
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

  private async getTicket(organizationId: string, ticketId: string) {
    const rows = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(eq(popsKitchenTickets.id, ticketId))
      .limit(1);
    const row = rows[0];
    if (!row || row.organizationId !== organizationId) {
      throw new NotFoundException("Kitchen ticket not found");
    }
    return row;
  }
}

function normalizeMenuLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

function waiterDisplayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local.replace(/[._-]+/g, " ").trim().split(/\s+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatMenuItemLabel(name: string, portion: string | null): string {
  if (!portion) return name;
  const p = portion.charAt(0).toUpperCase() + portion.slice(1);
  return `${name} (${p})`;
}
