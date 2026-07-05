import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { completeBillSchema, createBillSchema, updateBillSchema } from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { BillingService } from "./billing.service";

@Controller("v1/billing")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("waiters")
  @RequirePermissions("pops.read")
  listWaiters(@CurrentUser() user: AccessJwtPayload) {
    return this.billing.listWaiters(user.organizationId);
  }

  @Get("orders")
  @RequirePermissions("pops.read")
  listOrders(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.billing.listOrders(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("bills")
  @RequirePermissions("pops.read")
  createBill(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.billing.createBill(user.organizationId, createBillSchema.parse(body));
  }

  @Patch("bills/:billId/complete")
  @RequirePermissions("pops.read")
  completeBill(
    @CurrentUser() user: AccessJwtPayload,
    @Param("billId") billId: string,
    @Body() body: unknown,
  ) {
    return this.billing.completeBill(user.organizationId, billId, completeBillSchema.parse(body));
  }

  @Patch("bills/:billId")
  @RequirePermissions("pops.read")
  updateBill(
    @CurrentUser() user: AccessJwtPayload,
    @Param("billId") billId: string,
    @Body() body: unknown,
  ) {
    return this.billing.updateBill(user.organizationId, billId, updateBillSchema.parse(body));
  }
}
