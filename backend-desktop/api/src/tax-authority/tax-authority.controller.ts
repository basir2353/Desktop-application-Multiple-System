import { Body, Controller, ForbiddenException, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { isSuperAdmin, type AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { TaxAuthorityService } from "./tax-authority.service";

/**
 * After Super Admin unlocks FBR/PRA for the business, org Admin / Accountant / Owner
 * may toggle Fake ↔ Real and FBR in Settings. Platform Super Admin always can.
 */
function assertCanManageTaxFeatures(user: AccessJwtPayload): void {
  if (isSuperAdmin(user) || user.permissions?.includes("platform.businesses.manage")) return;
  if (user.permissions?.includes("*")) return;
  if (
    user.permissions?.includes("pops.accounting.manage") ||
    user.permissions?.includes("pops.users.manage")
  ) {
    return;
  }
  const role = String(user.role ?? "").toLowerCase();
  if (role === "admin" || role === "owner" || role === "accountant" || role === "incharge") {
    return;
  }
  throw new ForbiddenException(
    "Only Admin or Accountant can enable or disable FBR / Fake PRA / Real PRA.",
  );
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

  @Post("v1/pra/issue-invoice")
  @RequirePermissions("pops.read")
  issuePraInvoice(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.issuePraInvoice(user.organizationId, body);
  }

  @Get("v1/pra/fiscal-for-source")
  @RequirePermissions("pops.read")
  praFiscalForSource(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("sourceType") sourceType: string,
    @Query("sourceId") sourceId: string,
  ) {
    const st =
      sourceType === "store_sale" || sourceType === "pharmacy_sale" || sourceType === "bill"
        ? sourceType
        : "bill";
    return this.tax.getFiscalForSource(
      user.organizationId,
      branchCode?.trim() ?? "",
      st,
      sourceId?.trim() ?? "",
    );
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
    @Body()
    body: {
      praEnabled?: boolean;
      praFakeEnabled?: boolean;
      praRealEnabled?: boolean;
      fbrEnabled?: boolean;
    },
  ) {
    assertCanManageTaxFeatures(user);
    return this.tax.setFeatures(user.organizationId, {
      praEnabled: typeof body?.praEnabled === "boolean" ? body.praEnabled : undefined,
      praFakeEnabled: typeof body?.praFakeEnabled === "boolean" ? body.praFakeEnabled : undefined,
      praRealEnabled: typeof body?.praRealEnabled === "boolean" ? body.praRealEnabled : undefined,
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
