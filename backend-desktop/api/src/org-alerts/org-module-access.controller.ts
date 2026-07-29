import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { organizations, type PlatformPgDb } from "@platform/database-pg";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";

/** Live Super Admin module ceiling for the signed-in business (no re-login required). */
@Controller("v1/org")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrgModuleAccessController {
  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  @Get("module-access")
  @RequirePermissions("pops.read")
  async moduleAccess(@CurrentUser() user: AccessJwtPayload) {
    const rows = await this.db
      .select({ enabledModules: organizations.enabledModules })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    return { enabledModules: rows[0]?.enabledModules ?? null };
  }
}
