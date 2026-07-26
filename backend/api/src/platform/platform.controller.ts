import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createBusinessSchema,
  resetPlatformUserPasswordSchema,
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
