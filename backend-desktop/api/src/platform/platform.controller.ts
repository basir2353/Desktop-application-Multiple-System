import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createBusinessSchema,
  createLicencePaymentSchema,
  grantLicenceDaysSchema,
  resetPlatformUserPasswordSchema,
  sendLicenceRemindersSchema,
  updateBusinessSchema,
  updatePlatformSettingsSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { PlatformService } from "./platform.service";

@Controller("v1/platform")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("system-types")
  @RequirePermissions("platform.businesses.manage")
  listSystemTypes(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listSystemTypes();
  }

  @Get("analytics")
  @RequirePermissions("platform.analytics.read")
  getAnalytics(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.getAnalytics();
  }

  @Get("businesses")
  @RequirePermissions("platform.businesses.manage")
  listBusinesses(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listBusinesses();
  }

  @Get("businesses/:businessId")
  @RequirePermissions("platform.businesses.manage")
  getBusiness(@CurrentUser() user: AccessJwtPayload, @Param("businessId") businessId: string) {
    this.platform.assertSuperAdmin(user);
    return this.platform.getBusiness(businessId);
  }

  @Post("businesses")
  @RequirePermissions("platform.businesses.manage")
  createBusiness(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    this.platform.assertSuperAdmin(user);
    const input = createBusinessSchema.parse(body);
    return this.platform.createBusiness(user, input);
  }

  @Patch("businesses/:businessId")
  @RequirePermissions("platform.businesses.manage")
  updateBusiness(
    @CurrentUser() user: AccessJwtPayload,
    @Param("businessId") businessId: string,
    @Body() body: unknown,
  ) {
    this.platform.assertSuperAdmin(user);
    const input = updateBusinessSchema.parse(body);
    return this.platform.updateBusiness(businessId, input);
  }

  @Delete("businesses/:businessId")
  @RequirePermissions("platform.businesses.manage")
  deleteBusiness(@CurrentUser() user: AccessJwtPayload, @Param("businessId") businessId: string) {
    this.platform.assertSuperAdmin(user);
    return this.platform.deleteBusiness(businessId);
  }

  @Post("businesses/:businessId/grant-licence")
  @RequirePermissions("platform.businesses.manage")
  grantLicence(
    @CurrentUser() user: AccessJwtPayload,
    @Param("businessId") businessId: string,
    @Body() body: unknown,
  ) {
    this.platform.assertSuperAdmin(user);
    const input = grantLicenceDaysSchema.parse(body);
    return this.platform.grantLicenceDays(user, businessId, input);
  }

  @Get("licence-payments")
  @RequirePermissions("platform.businesses.manage")
  listLicencePayments(
    @CurrentUser() user: AccessJwtPayload,
    @Query("businessId") businessId?: string,
  ) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listLicencePayments(businessId);
  }

  @Get("licence-payments/monthly-status")
  @RequirePermissions("platform.businesses.manage")
  monthlyLicenceStatus(
    @CurrentUser() user: AccessJwtPayload,
    @Query("year") yearRaw?: string,
    @Query("month") monthRaw?: string,
  ) {
    this.platform.assertSuperAdmin(user);
    const year = yearRaw ? Number(yearRaw) : undefined;
    const month = monthRaw ? Number(monthRaw) : undefined;
    return this.platform.getMonthlyLicenceStatus(
      Number.isFinite(year) ? year : undefined,
      Number.isFinite(month) ? month : undefined,
    );
  }

  @Post("licence-payments/send-reminders")
  @RequirePermissions("platform.businesses.manage")
  sendLicenceReminders(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    this.platform.assertSuperAdmin(user);
    const input = sendLicenceRemindersSchema.parse(body ?? {});
    return this.platform.sendLicenceReminders(input);
  }

  @Post("businesses/:businessId/licence-payments")
  @RequirePermissions("platform.businesses.manage")
  recordLicencePayment(
    @CurrentUser() user: AccessJwtPayload,
    @Param("businessId") businessId: string,
    @Body() body: unknown,
  ) {
    this.platform.assertSuperAdmin(user);
    const input = createLicencePaymentSchema.parse(body);
    return this.platform.recordLicencePayment(user, businessId, input);
  }

  @Get("users")
  @RequirePermissions("platform.users.manage")
  listUsers(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listUsers();
  }

  @Post("users/:userId/reset-password")
  @RequirePermissions("platform.users.manage")
  resetPassword(
    @CurrentUser() user: AccessJwtPayload,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    this.platform.assertSuperAdmin(user);
    const input = resetPlatformUserPasswordSchema.parse(body);
    return this.platform.resetUserPassword(userId, input.password);
  }

  @Get("settings")
  @RequirePermissions("platform.settings.manage")
  getSettings(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.getSettings();
  }

  @Patch("settings")
  @RequirePermissions("platform.settings.manage")
  updateSettings(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    this.platform.assertSuperAdmin(user);
    const input = updatePlatformSettingsSchema.parse(body);
    return this.platform.updateSettings(user, input);
  }
}
