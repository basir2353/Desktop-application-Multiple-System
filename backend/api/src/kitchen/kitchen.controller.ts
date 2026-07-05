import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createKitchenTicketSchema,
  updateKitchenTicketSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { KitchenService } from "./kitchen.service";

@Controller("v1/kitchen")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KitchenController {
  constructor(private readonly kitchen: KitchenService) {}

  @Get("tickets")
  @RequirePermissions("pops.read")
  listTickets(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.kitchen.listTickets(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("tickets")
  @RequirePermissions("pops.read")
  createTicket(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.kitchen.createTicket(user.organizationId, createKitchenTicketSchema.parse(body));
  }

  @Patch("tickets/:ticketId")
  @RequirePermissions("pops.read")
  updateTicket(
    @CurrentUser() user: AccessJwtPayload,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.kitchen.updateTicket(user.organizationId, ticketId, updateKitchenTicketSchema.parse(body));
  }

  @Post("tickets/bump-priority")
  @RequirePermissions("pops.kitchen.bump")
  bumpPriority(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.kitchen.bumpPriority(user.organizationId, branchCode?.trim() ?? "");
  }
}
