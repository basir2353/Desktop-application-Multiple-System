import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { CreateRider, UpdateDeliveryOrder, UpdateRider } from "@platform/contracts";
import {
  popsBranches,
  popsKitchenTickets,
  popsRiders,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly notifications: NotificationsService,
  ) {}

  async listRiders(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsRiders)
      .where(eq(popsRiders.branchId, branch.id))
      .orderBy(asc(popsRiders.name));

    return {
      branchCode: branch.code,
      riders: rows.map((r) => this.mapRider(r)),
    };
  }

  async createRider(organizationId: string, input: CreateRider) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const [row] = await this.db
      .insert(popsRiders)
      .values({
        organizationId,
        branchId: branch.id,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        cnic: input.cnic?.trim() || null,
        salaryPkr: input.salaryPkr ?? null,
        fromArea: input.fromArea?.trim() || null,
        notes: input.notes?.trim() || null,
        active: true,
      })
      .returning();
    if (!row) throw new BadRequestException("Failed to create rider");
    return this.mapRider(row);
  }

  async updateRider(organizationId: string, riderId: string, input: UpdateRider) {
    const rider = await this.getRider(organizationId, riderId);
    const [row] = await this.db
      .update(popsRiders)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.cnic !== undefined ? { cnic: input.cnic } : {}),
        ...(input.salaryPkr !== undefined ? { salaryPkr: input.salaryPkr } : {}),
        ...(input.fromArea !== undefined ? { fromArea: input.fromArea } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      })
      .where(eq(popsRiders.id, riderId))
      .returning();
    if (!row) throw new NotFoundException("Rider not found");
    return this.mapRider(row);
  }

  async updateDeliveryOrder(
    organizationId: string,
    ticketId: string,
    input: UpdateDeliveryOrder,
  ) {
    const ticket = await this.getTicket(organizationId, ticketId);
    if (!ticket.stationLabel.toLowerCase().includes("delivery")) {
      throw new BadRequestException("Not a delivery order");
    }
    if (ticket.status === "done") {
      throw new BadRequestException("Cannot update a completed delivery order");
    }

    const previousRiderId = ticket.riderId;

    if (input.riderId) {
      await this.getRider(organizationId, input.riderId);
    }

    let deliveryStatus = input.deliveryStatus;
    if (input.riderId !== undefined) {
      if (input.riderId && !deliveryStatus) {
        deliveryStatus = "assigned";
      }
      if (input.riderId === null && !deliveryStatus) {
        deliveryStatus = "unassigned";
      }
    }

    const [row] = await this.db
      .update(popsKitchenTickets)
      .set({
        ...(input.riderId !== undefined ? { riderId: input.riderId } : {}),
        ...(input.deliveryChargePkr !== undefined
          ? { deliveryChargePkr: input.deliveryChargePkr }
          : {}),
        ...(deliveryStatus !== undefined ? { deliveryStatus } : {}),
      })
      .where(eq(popsKitchenTickets.id, ticketId))
      .returning();

    if (!row) throw new NotFoundException("Delivery order not found");

    if (input.riderId && row.riderId && row.riderId !== previousRiderId) {
      const rider = await this.getRider(organizationId, row.riderId);
      const customerLabel = row.orderRef ? `Customer ${row.orderRef}` : `Customer ${row.ticketRef}`;
      try {
        await this.notifications.notifyRiderAssigned(organizationId, row.branchId, {
          orderRef: row.orderRef ?? row.ticketRef,
          riderName: rider.name,
          customerLabel,
          ticketRef: row.ticketRef,
        });
      } catch {
        // Non-blocking — delivery update still succeeds
      }
    }

    return this.mapTicketWithRider(row);
  }

  async mapTicketWithRider(row: typeof popsKitchenTickets.$inferSelect) {
    let riderName: string | null = null;
    if (row.riderId) {
      const riders = await this.db
        .select({ name: popsRiders.name })
        .from(popsRiders)
        .where(eq(popsRiders.id, row.riderId))
        .limit(1);
      riderName = riders[0]?.name ?? null;
    }

    const anchor = row.startedAt ?? row.createdAt;
    const mins = Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 60_000));

    return {
      id: row.id,
      ticketRef: row.ticketRef,
      orderRef: row.orderRef,
      stationLabel: row.stationLabel,
      itemsSummary: row.itemsSummary,
      lines: this.parseTicketLines(row),
      notes: this.extractTicketNotes(row.itemsSummary),
      priority: row.priority as "normal" | "priority",
      status: row.status,
      mins,
      startedAt: row.startedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      riderId: row.riderId,
      riderName,
      deliveryChargePkr: row.deliveryChargePkr,
      deliveryStatus: row.deliveryStatus as
        | "unassigned"
        | "assigned"
        | "out_for_delivery"
        | "delivered"
        | null,
    };
  }

  private mapRider(row: typeof popsRiders.$inferSelect) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      cnic: row.cnic,
      salaryPkr: row.salaryPkr,
      fromArea: row.fromArea,
      notes: row.notes,
      active: row.active,
    };
  }

  private async getRider(organizationId: string, riderId: string) {
    const rows = await this.db
      .select()
      .from(popsRiders)
      .where(eq(popsRiders.id, riderId))
      .limit(1);
    const rider = rows[0];
    if (!rider || rider.organizationId !== organizationId) {
      throw new NotFoundException("Rider not found");
    }
    return rider;
  }

  private async getTicket(organizationId: string, ticketId: string) {
    const rows = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(eq(popsKitchenTickets.id, ticketId))
      .limit(1);
    const ticket = rows[0];
    if (!ticket || ticket.organizationId !== organizationId) {
      throw new NotFoundException("Delivery order not found");
    }
    return ticket;
  }

  private parseTicketLines(row: typeof popsKitchenTickets.$inferSelect) {
    if (row.linesJson) {
      try {
        const parsed = JSON.parse(row.linesJson) as {
          label: string;
          qty: number;
          unitPrice?: number;
          menuItemId?: string;
        }[];
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
    return row.itemsSummary
      .split(" · ")[0]
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

  private extractTicketNotes(summary: string): string | null {
    const idx = summary.lastIndexOf(" · ");
    if (idx === -1) return null;
    const notes = summary.slice(idx + 3).trim();
    return notes || null;
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
