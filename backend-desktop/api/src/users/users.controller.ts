import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  acceptInviteSchema,
  createOrgUserSchema,
  inviteOrgUserSchema,
  resetUserPasswordSchema,
  setOwnPinSchema,
  updateOrgUserSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "./permissions.guard";
import { RequirePermissions } from "./require-permission.decorator";
import { UsersService } from "./users.service";

@Controller("v1/users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("access-control")
  @RequirePermissions("pops.users.manage")
  getAccessControl() {
    return this.users.getAccessControl();
  }

  @Get()
  @RequirePermissions("pops.users.manage")
  list(@CurrentUser() user: AccessJwtPayload) {
    return this.users.listUsers(user.organizationId);
  }

  @Get("invites")
  @RequirePermissions("pops.users.manage")
  listInvites(@CurrentUser() user: AccessJwtPayload) {
    return this.users.listPendingInvites(user.organizationId);
  }

  @Post()
  @RequirePermissions("pops.users.manage")
  create(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    const parsed = createOrgUserSchema.parse(body);
    return this.users.createUser(user.organizationId, parsed);
  }

  @Post("invite")
  @RequirePermissions("pops.users.manage")
  invite(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    const parsed = inviteOrgUserSchema.parse(body);
    return this.users.inviteUser(user.organizationId, parsed);
  }

  @Patch("me/pin")
  setOwnPin(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    const parsed = setOwnPinSchema.parse(body);
    return this.users.setOwnPin(user.organizationId, user.sub, parsed.pin);
  }

  @Patch(":userId")
  @RequirePermissions("pops.users.manage")
  update(
    @CurrentUser() user: AccessJwtPayload,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateOrgUserSchema.parse(body);
    return this.users.updateUser(user.organizationId, userId, parsed);
  }

  @Post(":userId/reset-password")
  @RequirePermissions("pops.users.manage")
  resetPassword(
    @CurrentUser() user: AccessJwtPayload,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = resetUserPasswordSchema.parse(body);
    return this.users.resetPassword(user.organizationId, userId, parsed.password);
  }
}
