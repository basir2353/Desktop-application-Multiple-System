import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createRiderSchema,
  updateDeliveryOrderSchema,
  updateRiderSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { DeliveryService } from "./delivery.service";

@Controller("v1/delivery")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get("riders")
  @RequirePermissions("pops.read")
  listRiders(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.delivery.listRiders(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("riders")
  @RequirePermissions("pops.read")
  createRider(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.delivery.createRider(user.organizationId, createRiderSchema.parse(body));
  }

  @Patch("riders/:riderId")
  @RequirePermissions("pops.read")
  updateRider(
    @CurrentUser() user: AccessJwtPayload,
    @Param("riderId") riderId: string,
    @Body() body: unknown,
  ) {
    return this.delivery.updateRider(user.organizationId, riderId, updateRiderSchema.parse(body));
  }

  @Patch("orders/:ticketId")
  @RequirePermissions("pops.read")
  updateOrder(
    @CurrentUser() user: AccessJwtPayload,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.delivery.updateDeliveryOrder(
      user.organizationId,
      ticketId,
      updateDeliveryOrderSchema.parse(body),
    );
  }
}
