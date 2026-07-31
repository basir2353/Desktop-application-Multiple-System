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
    "Only Admin or Accountant can enable or disable FBR / FPRA / Real PRA.",
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

  @Post("v1/pra/test-connection")
  @RequirePermissions("pops.read")
  testPra(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.testPraConnection(user.organizationId, body);
  }

  @Post("v1/pra/prepare-client-test")
  @RequirePermissions("pops.read")
  preparePraClientTest(
    @CurrentUser() user: AccessJwtPayload,
    @Body() body: { branchCode?: string },
  ) {
    return this.tax.preparePraClientTest(user.organizationId, body?.branchCode?.trim() ?? "");
  }

  @Post("v1/pra/disconnect")
  @RequirePermissions("pops.read")
  disconnectPra(
    @CurrentUser() user: AccessJwtPayload,
    @Body() body: { branchCode?: string },
  ) {
    return this.tax.disconnectPra(user.organizationId, body?.branchCode?.trim() ?? "");
  }

  @Patch("v1/pra/settings")
  @RequirePermissions("pops.read")
  updatePraSettings(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    assertCanManageTaxFeatures(user);
    return this.tax.updatePraSettings(user.organizationId, body);
  }

  @Get("v1/pra/dashboard")
  @RequirePermissions("pops.read")
  praDashboard(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("mode") mode?: string,
  ) {
    const invoiceMode = mode === "fake" ? "fake" : "real";
    return this.tax.getPraDashboard(
      user.organizationId,
      branchCode?.trim() ?? "",
      invoiceMode,
    );
  }

  @Get("v1/pra/reports")
  @RequirePermissions("pops.read")
  praReports(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("mode") mode?: string,
    @Query("period") period?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
  ) {
    return this.tax.getPraReports(user.organizationId, {
      branchCode: branchCode?.trim() ?? "",
      mode,
      period,
      from,
      to,
      status,
    });
  }

  @Get("v1/pra/activity-logs")
  @RequirePermissions("pops.read")
  praActivityLogs(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("limit") limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.tax.listActivityLogs(
      user.organizationId,
      branchCode?.trim() ?? "",
      Number.isFinite(n) ? n : 50,
    );
  }

  @Post("v1/pra/retry-failed")
  @RequirePermissions("pops.read")
  retryFailed(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.retryFailedInvoices(user.organizationId, body);
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

  @Post("v1/pra/prepare-client-post")
  @RequirePermissions("pops.read")
  preparePraClientPost(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.preparePraClientPost(user.organizationId, body);
  }

  @Post("v1/pra/confirm-client-post")
  @RequirePermissions("pops.read")
  confirmPraClientPost(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.tax.confirmPraClientPost(user.organizationId, body);
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
  listPraInvoices(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("invoiceMode") invoiceMode?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const n = limit ? Number(limit) : 100;
    return this.tax.listInvoices(user.organizationId, branchCode?.trim() ?? "", "pra", {
      invoiceMode,
      status,
      from,
      to,
      limit: Number.isFinite(n) ? n : 100,
    });
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
  listAll(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("invoiceMode") invoiceMode?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const n = limit ? Number(limit) : 100;
    return this.tax.listInvoices(user.organizationId, branchCode?.trim() ?? "", undefined, {
      invoiceMode,
      status,
      from,
      to,
      limit: Number.isFinite(n) ? n : 100,
    });
  }
}
