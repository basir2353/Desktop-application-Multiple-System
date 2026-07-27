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
  updatePlatformUserSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { PlatformService } from "./platform.service";

@Controller("v1/platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  /** Unauthenticated — maintenance banner + support contact for login screens. */
  @Get("public-info")
  getPublicInfo() {
    return this.platform.getPublicInfo();
  }

  @Get("system-types")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.businesses.manage")
  listSystemTypes(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listSystemTypes();
  }

  @Get("analytics")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.analytics.read")
  getAnalytics(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.getAnalytics();
  }

  @Get("businesses")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.businesses.manage")
  listBusinesses(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listBusinesses();
  }

  @Get("businesses/:businessId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.businesses.manage")
  getBusiness(@CurrentUser() user: AccessJwtPayload, @Param("businessId") businessId: string) {
    this.platform.assertSuperAdmin(user);
    return this.platform.getBusiness(businessId);
  }

  @Post("businesses")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.businesses.manage")
  createBusiness(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    this.platform.assertSuperAdmin(user);
    const input = createBusinessSchema.parse(body);
    return this.platform.createBusiness(user, input);
  }

  @Patch("businesses/:businessId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.businesses.manage")
  deleteBusiness(@CurrentUser() user: AccessJwtPayload, @Param("businessId") businessId: string) {
    this.platform.assertSuperAdmin(user);
    return this.platform.deleteBusiness(businessId);
  }

  @Get("users")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.users.manage")
  listUsers(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.listUsers();
  }

  @Patch("users/:userId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.users.manage")
  updateUser(
    @CurrentUser() user: AccessJwtPayload,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    this.platform.assertSuperAdmin(user);
    const input = updatePlatformUserSchema.parse(body);
    return this.platform.updateUser(userId, input);
  }

  @Post("users/:userId/reset-password")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.settings.manage")
  getSettings(@CurrentUser() user: AccessJwtPayload) {
    this.platform.assertSuperAdmin(user);
    return this.platform.getSettings();
  }

  @Patch("settings")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.settings.manage")
  updateSettings(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    this.platform.assertSuperAdmin(user);
    const input = updatePlatformSettingsSchema.parse(body);
    return this.platform.updateSettings(user, input);
  }
}
