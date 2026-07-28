import { Body, Controller, ForbiddenException, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { TaxAuthorityService } from "./tax-authority.service";

function assertCanToggleTaxFeatures(user: AccessJwtPayload): void {
  const role = (user.role ?? "").toLowerCase();
  const perms = new Set(user.permissions ?? []);
  const isIncharge =
    role === "admin" ||
    role === "owner" ||
    role === "manager" ||
    perms.has("*") ||
    perms.has("pops.users.manage");
  if (!isIncharge) {
    throw new ForbiddenException("Only Admin / Incharge can change PRA settings.");
  }
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaxAuthorityController {
  constructor(private readonly tax: TaxAuthorityService) {}

  @Post("v1/fbr/connect")
  @RequirePermissions("pops.read")
  connectFbr(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.connectFbr(user.organizationId, body);
  }

  @Get("v1/fbr/status")
  @RequirePermissions("pops.read")
  fbrStatus(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tax.getStatus(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("v1/fbr/refresh-token")
  @RequirePermissions("pops.read")
  refreshFbr(@CurrentUser() user: AccessJwtPayload, @Body() body: { branchCode?: string }) {
    return this.tax.refreshFbrToken(user.organizationId, body?.branchCode?.trim() ?? "");
  }

  @Post("v1/fbr/send-invoice")
  @RequirePermissions("pops.read")
  sendFbrInvoice(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.sendInvoice(user.organizationId, "fbr", body);
  }

  @Get("v1/fbr/invoices")
  @RequirePermissions("pops.read")
  listFbrInvoices(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tax.listInvoices(user.organizationId, branchCode?.trim() ?? "", "fbr");
  }

  @Post("v1/pra/connect")
  @RequirePermissions("pops.read")
  connectPra(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.connectPra(user.organizationId, body);
  }

  @Get("v1/pra/status")
  @RequirePermissions("pops.read")
  praStatus(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tax.getStatus(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("v1/pra/refresh-token")
  @RequirePermissions("pops.read")
  refreshPra(@CurrentUser() user: AccessJwtPayload, @Body() body: { branchCode?: string }) {
    return this.tax.refreshPraToken(user.organizationId, body?.branchCode?.trim() ?? "");
  }

  @Post("v1/pra/send-invoice")
  @RequirePermissions("pops.read")
  sendPraInvoice(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.sendInvoice(user.organizationId, "pra", body);
  }

  @Get("v1/pra/invoices")
  @RequirePermissions("pops.read")
  listPraInvoices(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tax.listInvoices(user.organizationId, branchCode?.trim() ?? "", "pra");
  }

  @Get("v1/tax-authority/features")
  @RequirePermissions("pops.read")
  features(@CurrentUser() user: AccessJwtPayload) {
    return this.tax.getFeatures(user.organizationId);
  }

  @Patch("v1/tax-authority/features")
  @RequirePermissions("pops.read")
  setFeatures(
    @CurrentUser() user: AccessJwtPayload,
    @Body() body: { praEnabled?: boolean; fbrEnabled?: boolean },
  ) {
    assertCanToggleTaxFeatures(user);
    return this.tax.setFeatures(user.organizationId, {
      praEnabled: typeof body?.praEnabled === "boolean" ? body.praEnabled : undefined,
      fbrEnabled: typeof body?.fbrEnabled === "boolean" ? body.fbrEnabled : undefined,
    });
  }

  @Get("v1/tax-authority/status")
  @RequirePermissions("pops.read")
  status(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tax.getStatus(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("v1/tax-authority/invoices")
  @RequirePermissions("pops.read")
  listAll(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.tax.listInvoices(user.organizationId, branchCode?.trim() ?? "");
  }
}
