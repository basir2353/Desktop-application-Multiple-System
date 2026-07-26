import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import {
  permissionsForPopsRole,
  SYSTEM_TYPES,
  type Business,
  type CreateBusiness,
  type PlatformAnalytics,
  type PlatformUser,
  type SystemType,
  type UpdateBusiness,
  type UpdatePlatformSettings,
} from "@platform/contracts";
import {
  organizationMemberships,
  organizations,
  platformSettings,
  users,
  type PlatformPgDb,
} from "@platform/database-pg";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { isSuperAdmin } from "../auth/jwt.types";

@Injectable()
export class PlatformService {
  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  assertSuperAdmin(user: AccessJwtPayload): void {
    if (!isSuperAdmin(user)) {
      throw new ForbiddenException("Access denied. Super Admin role required.");
    }
  }

  async listBusinesses(): Promise<Business[]> {
    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        systemType: organizations.systemType,
        status: organizations.status,
        licenceKey: organizations.licenceKey,
        licencePlan: organizations.licencePlan,
        licenceExpiresAt: organizations.licenceExpiresAt,
        createdBy: organizations.createdBy,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(ne(organizations.status, "deleted"))
      .orderBy(desc(organizations.createdAt));

    const withCounts = await Promise.all(
      rows.map(async (row) => {
        const [userCountRow] = await this.db
          .select({ value: count() })
          .from(organizationMemberships)
          .where(eq(organizationMemberships.organizationId, row.id));

        const admin = await this.db
          .select({ email: users.email })
          .from(organizationMemberships)
          .innerJoin(users, eq(users.id, organizationMemberships.userId))
          .where(
            and(
              eq(organizationMemberships.organizationId, row.id),
              sql`${organizationMemberships.role} in ('owner', 'admin')`,
            ),
          )
          .limit(1);

        return this.toBusiness(row, {
          adminEmail: admin[0]?.email ?? null,
          userCount: Number(userCountRow?.value ?? 0),
        });
      }),
    );

    return withCounts;
  }

  async getBusiness(businessId: string): Promise<Business> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, businessId), ne(organizations.status, "deleted")))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Business not found");

    const [userCountRow] = await this.db
      .select({ value: count() })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, row.id));

    const admin = await this.db
      .select({ email: users.email })
      .from(organizationMemberships)
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        and(
          eq(organizationMemberships.organizationId, row.id),
          sql`${organizationMemberships.role} in ('owner', 'admin')`,
        ),
      )
      .limit(1);

    return this.toBusiness(row, {
      adminEmail: admin[0]?.email ?? null,
      userCount: Number(userCountRow?.value ?? 0),
    });
  }

  async createBusiness(actor: AccessJwtPayload, input: CreateBusiness): Promise<Business> {
    const existingUser = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.adminEmail.trim().toLowerCase()))
      .limit(1);
    if (existingUser.length > 0) {
      throw new ConflictException("Admin email is already registered");
    }

    const passwordHash = await bcrypt.hash(input.adminPassword, 12);
    const licenceKey = input.licenceKey ?? `LIC-${randomBytes(8).toString("hex").toUpperCase()}`;

    const [org] = await this.db
      .insert(organizations)
      .values({
        name: input.name.trim(),
        systemType: input.systemType,
        status: "active",
        licenceKey,
        licencePlan: input.licencePlan ?? "standard",
        licenceExpiresAt: input.licenceExpiresAt ? new Date(input.licenceExpiresAt) : null,
        createdBy: actor.sub,
      })
      .returning();

    if (!org) throw new BadRequestException("Failed to create business");

    const [adminUser] = await this.db
      .insert(users)
      .values({
        name: input.adminName.trim(),
        email: input.adminEmail.trim().toLowerCase(),
        passwordHash,
        status: "active",
        platformRole: null,
      })
      .returning({ id: users.id, email: users.email });

    if (!adminUser) throw new BadRequestException("Failed to create system admin");

    await this.db.insert(organizationMemberships).values({
      organizationId: org.id,
      userId: adminUser.id,
      role: "owner",
      permissions: permissionsForPopsRole("admin"),
      branchScope: "all",
      pinRequired: false,
      active: true,
      lastActivityAt: new Date(),
    });

    return this.toBusiness(org, { adminEmail: adminUser.email, userCount: 1 });
  }

  async updateBusiness(businessId: string, input: UpdateBusiness): Promise<Business> {
    const existing = await this.getBusiness(businessId);

    if (input.status === "deleted") {
      throw new BadRequestException("Use DELETE to remove a business");
    }

    const [updated] = await this.db
      .update(organizations)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.licenceKey !== undefined ? { licenceKey: input.licenceKey } : {}),
        ...(input.licencePlan !== undefined ? { licencePlan: input.licencePlan } : {}),
        ...(input.licenceExpiresAt !== undefined
          ? {
              licenceExpiresAt: input.licenceExpiresAt ? new Date(input.licenceExpiresAt) : null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, businessId))
      .returning();

    if (!updated) throw new NotFoundException("Business not found");
    return this.toBusiness(updated, {
      adminEmail: existing.adminEmail ?? null,
      userCount: existing.userCount ?? 0,
    });
  }

  async deleteBusiness(businessId: string): Promise<{ ok: true }> {
    const [updated] = await this.db
      .update(organizations)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(and(eq(organizations.id, businessId), ne(organizations.status, "deleted")))
      .returning({ id: organizations.id });
    if (!updated) throw new NotFoundException("Business not found");
    return { ok: true };
  }

  async listUsers(): Promise<PlatformUser[]> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        platformRole: users.platformRole,
        status: users.status,
        createdAt: users.createdAt,
        role: organizationMemberships.role,
        active: organizationMemberships.active,
        businessId: organizations.id,
        businessName: organizations.name,
        systemType: organizations.systemType,
      })
      .from(users)
      .leftJoin(organizationMemberships, eq(organizationMemberships.userId, users.id))
      .leftJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
      .orderBy(desc(users.createdAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.platformRole === "super_admin" ? "super_admin" : (row.role ?? "none"),
      platformRole: row.platformRole === "super_admin" ? "super_admin" : null,
      businessId: row.businessId,
      businessName: row.businessName,
      systemType: (row.systemType as SystemType | null) ?? null,
      status: row.status,
      active: row.active ?? row.status === "active",
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async resetUserPassword(userId: string, password: string): Promise<{ ok: true }> {
    const rows = await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!rows[0]) throw new NotFoundException("User not found");
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    return { ok: true };
  }

  async getSettings(): Promise<{ entries: Record<string, unknown> }> {
    const rows = await this.db.select().from(platformSettings);
    const entries: Record<string, unknown> = {};
    for (const row of rows) {
      entries[row.key] = row.value;
    }
    return { entries };
  }

  async updateSettings(
    actor: AccessJwtPayload,
    input: UpdatePlatformSettings,
  ): Promise<{ entries: Record<string, unknown> }> {
    for (const [key, value] of Object.entries(input.entries)) {
      await this.db
        .insert(platformSettings)
        .values({
          key,
          value,
          updatedBy: actor.sub,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: {
            value,
            updatedBy: actor.sub,
            updatedAt: new Date(),
          },
        });
    }
    return this.getSettings();
  }

  async getAnalytics(): Promise<PlatformAnalytics> {
    const businesses = await this.listBusinesses();
    const allUsers = await this.db.select({ id: users.id }).from(users);

    const bySystemType = SYSTEM_TYPES.map((systemType) => ({
      systemType,
      count: businesses.filter((b) => b.systemType === systemType).length,
    }));

    return {
      totalBusinesses: businesses.length,
      activeBusinesses: businesses.filter((b) => b.status === "active").length,
      suspendedBusinesses: businesses.filter((b) => b.status === "suspended").length,
      inactiveBusinesses: businesses.filter((b) => b.status === "inactive").length,
      totalUsers: allUsers.length,
      bySystemType,
      recentBusinesses: businesses.slice(0, 10),
    };
  }

  async listSystemTypes(): Promise<{ id: SystemType; label: string }[]> {
    const { SYSTEM_TYPE_LABELS } = await import("@platform/contracts");
    return SYSTEM_TYPES.map((id) => ({ id, label: SYSTEM_TYPE_LABELS[id] }));
  }

  private toBusiness(
    row: {
      id: string;
      name: string;
      systemType: string;
      status: string;
      licenceKey: string | null;
      licencePlan: string | null;
      licenceExpiresAt: Date | null;
      createdBy: string | null;
      createdAt: Date;
    },
    extras?: { adminEmail?: string | null; userCount?: number },
  ): Business {
    return {
      id: row.id,
      name: row.name,
      systemType: row.systemType as SystemType,
      status: row.status as Business["status"],
      licenceKey: row.licenceKey,
      licencePlan: row.licencePlan,
      licenceExpiresAt: row.licenceExpiresAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      adminEmail: extras?.adminEmail ?? null,
      userCount: extras?.userCount ?? 0,
    };
  }
}
