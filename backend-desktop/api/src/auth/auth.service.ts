import { Inject, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  moduleVersions,
  modules,
  organizationMemberships,
  organizations,
  popsBranches,
  popsRiders,
  refreshTokens,
  users,
  type PlatformPgDb,
} from "@platform/database-pg";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { permissionsForPopsRole } from "@platform/contracts";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { SecurityService } from "../security/security.service";
import type { AccessJwtPayload } from "./jwt.types";

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly security: SecurityService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
  }

  async seedIfEmpty(): Promise<void> {
    const email = this.config.get<string>("SEED_USER_EMAIL") ?? "admin@platform.local";
    const existingSeed = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingSeed.length > 0) return;

    const password = this.config.get<string>("SEED_USER_PASSWORD") ?? "changeme-please-01";
    const passwordHash = await bcrypt.hash(password, 12);

    const [org] = await this.db
      .insert(organizations)
      .values({ name: "Demo Organization" })
      .returning({ id: organizations.id });

    if (!org) throw new Error("Failed to seed organization");

    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id });

    if (!user) throw new Error("Failed to seed user");

    await this.db.insert(organizationMemberships).values({
      organizationId: org.id,
      userId: user.id,
      role: "owner",
      permissions: permissionsForPopsRole("admin"),
      branchScope: "all",
      pinRequired: false,
      lastActivityAt: new Date(),
    });

    await this.db.insert(modules).values({
      slug: "sample",
      displayName: "Sample Module",
      description: "Reference microfrontend remote for the launcher host.",
      publisher: "platform",
    });

    const mod = await this.db.select().from(modules).where(eq(modules.slug, "sample")).limit(1);
    const moduleRow = mod[0];
    if (!moduleRow) throw new Error("Failed to seed module");

    await this.db.insert(moduleVersions).values({
      moduleId: moduleRow.id,
      semver: "0.1.0",
      artifactUrl: "http://127.0.0.1:5001/assets/remoteEntry.js",
      digestSha256: "0".repeat(64),
    });
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim();
    const row = await this.db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const user = row[0];
    if (!user) {
      await this.security.logEvent({
        eventType: "login_failed",
        userEmail: normalizedEmail,
        action: "Login failed",
        detail: "Unknown email",
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const membership = await this.db
        .select({ organizationId: organizationMemberships.organizationId })
        .from(organizationMemberships)
        .where(eq(organizationMemberships.userId, user.id))
        .limit(1);

      await this.security.logEvent({
        organizationId: membership[0]?.organizationId ?? null,
        eventType: "login_failed",
        userEmail: normalizedEmail,
        userId: user.id,
        action: "Login failed",
        detail: "Invalid password",
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const membership = await this.db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, user.id))
      .limit(1);

    const m = membership[0];
    if (!m) throw new UnauthorizedException("No organization membership");

    await this.touchLastActivity(m.organizationId, user.id);

    await this.security.logEvent({
      organizationId: m.organizationId,
      eventType: "login_success",
      userEmail: normalizedEmail,
      userId: user.id,
      action: "Login success",
      detail: "Session started",
    });

    return this.issueTokens(
      user.id,
      m.organizationId,
      normalizePermissions(m.permissions, m.role),
      m.role,
      m.branchScope ?? "all",
    );
  }

  async pinLogin(branchCode: string, pin: string) {
    const code = branchCode.trim().toUpperCase();
    const branchRows = await this.db
      .select({ organizationId: popsBranches.organizationId })
      .from(popsBranches)
      .where(eq(popsBranches.code, code))
      .limit(1);
    const branch = branchRows[0];
    if (!branch) throw new UnauthorizedException("Branch not found");

    const memberships = await this.db
      .select({
        userId: organizationMemberships.userId,
        organizationId: organizationMemberships.organizationId,
        permissions: organizationMemberships.permissions,
        role: organizationMemberships.role,
        branchScope: organizationMemberships.branchScope,
        staffPinHash: organizationMemberships.staffPinHash,
        email: users.email,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        and(
          eq(organizationMemberships.organizationId, branch.organizationId),
          isNotNull(organizationMemberships.staffPinHash),
        ),
      );

    const eligible = memberships.filter(
      (row) =>
        row.staffPinHash &&
        (row.branchScope === "all" || row.branchScope.toUpperCase() === code),
    );

    for (const row of eligible) {
      if (!row.staffPinHash) continue;
      const ok = await bcrypt.compare(pin, row.staffPinHash);
      if (!ok) continue;

      await this.touchLastActivity(row.organizationId, row.userId);

      await this.security.logEvent({
        organizationId: row.organizationId,
        eventType: "login_success",
        userEmail: row.email,
        userId: row.userId,
        action: "PIN login success",
        detail: `Branch ${code}`,
      });

      return this.issueTokens(
        row.userId,
        row.organizationId,
        normalizePermissions(row.permissions, row.role),
        row.role,
        row.branchScope ?? "all",
      );
    }

    await this.security.logEvent({
      organizationId: branch.organizationId,
      eventType: "login_failed",
      userEmail: `pin@${code.toLowerCase()}`,
      action: "PIN login failed",
      detail: `Branch ${code}`,
    });
    throw new UnauthorizedException("Invalid PIN for this branch");
  }

  async refresh(refreshToken: string) {
    const tokenHash = sha256Hex(refreshToken);
    const row = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    const rt = row[0];
    if (!rt) throw new UnauthorizedException("Invalid refresh token");
    if (rt.expiresAt.getTime() < Date.now()) throw new UnauthorizedException("Refresh expired");

    const membership = await this.db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, rt.userId))
      .limit(1);

    const m = membership[0];
    if (!m) throw new UnauthorizedException("No organization membership");

    await this.db.delete(refreshTokens).where(eq(refreshTokens.id, rt.id));
    return this.issueTokens(
      rt.userId,
      m.organizationId,
      normalizePermissions(m.permissions, m.role),
      m.role,
      m.branchScope ?? "all",
    );
  }

  private async touchLastActivity(organizationId: string, userId: string): Promise<void> {
    try {
      await this.db
        .update(organizationMemberships)
        .set({ lastActivityAt: new Date() })
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, userId),
          ),
        );
    } catch (err) {
      console.warn(
        "[auth] lastActivityAt update skipped:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    permissions: string[],
    role: string,
    branchScope: string,
  ) {
    let riderId: string | undefined;
    if (role === "rider") {
      const riders = await this.db
        .select({ id: popsRiders.id })
        .from(popsRiders)
        .where(eq(popsRiders.userId, userId))
        .limit(1);
      riderId = riders[0]?.id;
    }

    const accessPayload: AccessJwtPayload = {
      sub: userId,
      organizationId,
      permissions,
      role,
      branchScope,
      ...(riderId ? { riderId } : {}),
    };

    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL") ?? "15m";
    const refreshTtlDays = Number(this.config.get<string>("JWT_REFRESH_TTL_DAYS") ?? "30");
    const accessExpiresIn = parseExpiresInSeconds(accessTtl);

    const accessToken = await this.jwt.signAsync(accessPayload, {
      expiresIn: accessExpiresIn,
    });

    const refreshToken = randomBytes(48).toString("base64url");
    const refreshHash = sha256Hex(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);

    try {
      await this.db.insert(refreshTokens).values({
        userId,
        tokenHash: refreshHash,
        expiresAt,
      });
    } catch (err) {
      console.warn(
        "[auth] refresh token persist skipped:",
        err instanceof Error ? err.message : String(err),
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }
}

function normalizePermissions(value: unknown, role: string): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return permissionsForPopsRole(role);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parseExpiresInSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 900;
  const n = Number(match[1]);
  const u = match[2];
  const mult = u === "s" ? 1 : u === "m" ? 60 : u === "h" ? 3600 : 86_400;
  return n * mult;
}
