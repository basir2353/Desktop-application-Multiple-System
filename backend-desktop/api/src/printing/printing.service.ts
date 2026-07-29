import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  createPrintJobSchema,
  printerHeartbeatSchema,
  PRINTING_CLOUD_QUEUE_ENABLED_KEY,
  type CreatePrintJob,
  type PrinterHeartbeat,
  type PrintingStatus,
} from "@platform/contracts";
import {
  platformSettings,
  printAlerts,
  printBranchServers,
  printJobsCloud,
  printPrinterNodes,
  type PlatformPgDb,
} from "@platform/database-pg";
import { and, desc, eq, sql } from "drizzle-orm";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { requireTenantOrganizationId } from "../auth/jwt.types";
import { PrintingEvents } from "./printing.events";
import { PrintingCloudQueue } from "./printing.cloud-queue";

@Injectable()
export class PrintingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly events: PrintingEvents,
    @Optional() private readonly cloudQueue?: PrintingCloudQueue,
  ) {}

  private orgId(user: AccessJwtPayload): string {
    return requireTenantOrganizationId(user);
  }

  async createPrintJob(user: AccessJwtPayload, body: unknown) {
    const parsed = createPrintJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input: CreatePrintJob = parsed.data;
    const organizationId = this.orgId(user);
    const cloudEnabled = await this.isCloudQueueEnabled(organizationId);

    const [row] = await this.db
      .insert(printJobsCloud)
      .values({
        organizationId,
        branchCode: input.branchCode,
        userId: input.userId ?? user.sub,
        deviceId: input.deviceId ?? null,
        deviceLabel: input.deviceLabel ?? null,
        printerName: input.printerName ?? null,
        orderId: input.orderId ?? null,
        priority: input.priority ?? 100,
        status: "pending",
        payloadJson: input.payload,
        cloudQueued: cloudEnabled,
      })
      .returning();

    this.events.emit("job-created", {
      organizationId,
      branchCode: input.branchCode,
      jobId: row.id,
      status: row.status,
    });
    this.events.emit("queue-updated", {
      organizationId,
      branchCode: input.branchCode,
    });

    if (cloudEnabled && this.cloudQueue) {
      await this.cloudQueue.enqueue({
        organizationId,
        jobId: row.id,
        branchCode: input.branchCode,
      });
    }

    return row;
  }

  async listPrinters(user: AccessJwtPayload, branchCode?: string) {
    const organizationId = this.orgId(user);
    const rows = branchCode
      ? await this.db
          .select()
          .from(printPrinterNodes)
          .where(
            and(
              eq(printPrinterNodes.organizationId, organizationId),
              eq(printPrinterNodes.branchCode, branchCode),
            ),
          )
      : await this.db
          .select()
          .from(printPrinterNodes)
          .where(eq(printPrinterNodes.organizationId, organizationId));
    return rows;
  }

  async upsertPrinter(
    user: AccessJwtPayload,
    body: {
      id?: string;
      branchCode: string;
      name: string;
      printerType?: string;
      windowsPrinterName?: string | null;
      ipAddress?: string | null;
      macAddress?: string | null;
      hostname?: string | null;
      port?: number | null;
      connectionType?: string;
      paperSize?: string;
      online?: boolean;
      backupPrinterId?: string | null;
      legacyProfileId?: string | null;
    },
  ) {
    const organizationId = this.orgId(user);
    if (body.id) {
      const [updated] = await this.db
        .update(printPrinterNodes)
        .set({
          name: body.name,
          printerType: body.printerType ?? "receipt",
          windowsPrinterName: body.windowsPrinterName ?? null,
          ipAddress: body.ipAddress ?? null,
          macAddress: body.macAddress ?? null,
          hostname: body.hostname ?? null,
          port: body.port ?? null,
          connectionType: body.connectionType ?? "other",
          paperSize: body.paperSize ?? "80mm",
          online: body.online ?? true,
          backupPrinterId: body.backupPrinterId ?? null,
          legacyProfileId: body.legacyProfileId ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(printPrinterNodes.id, body.id),
            eq(printPrinterNodes.organizationId, organizationId),
          ),
        )
        .returning();
      if (!updated) throw new NotFoundException("Printer not found");
      return updated;
    }
    const [created] = await this.db
      .insert(printPrinterNodes)
      .values({
        organizationId,
        branchCode: body.branchCode,
        name: body.name,
        printerType: body.printerType ?? "receipt",
        windowsPrinterName: body.windowsPrinterName ?? null,
        ipAddress: body.ipAddress ?? null,
        macAddress: body.macAddress ?? null,
        hostname: body.hostname ?? null,
        port: body.port ?? null,
        connectionType: body.connectionType ?? "other",
        paperSize: body.paperSize ?? "80mm",
        online: body.online ?? true,
        backupPrinterId: body.backupPrinterId ?? null,
        legacyProfileId: body.legacyProfileId ?? null,
      })
      .returning();
    return created;
  }

  async listQueue(user: AccessJwtPayload, branchCode?: string) {
    const organizationId = this.orgId(user);
    const rows = branchCode
      ? await this.db
          .select()
          .from(printJobsCloud)
          .where(
            and(
              eq(printJobsCloud.organizationId, organizationId),
              eq(printJobsCloud.branchCode, branchCode),
            ),
          )
          .orderBy(desc(printJobsCloud.createdAt))
          .limit(200)
      : await this.db
          .select()
          .from(printJobsCloud)
          .where(eq(printJobsCloud.organizationId, organizationId))
          .orderBy(desc(printJobsCloud.createdAt))
          .limit(200);
    return rows;
  }

  async queueAction(
    user: AccessJwtPayload,
    jobId: string,
    action: "retry" | "pause" | "resume" | "cancel" | "reprint",
  ) {
    const organizationId = this.orgId(user);
    const [job] = await this.db
      .select()
      .from(printJobsCloud)
      .where(
        and(eq(printJobsCloud.id, jobId), eq(printJobsCloud.organizationId, organizationId)),
      )
      .limit(1);
    if (!job) throw new NotFoundException("Job not found");

    const status =
      action === "pause"
        ? "paused"
        : action === "cancel"
          ? "cancelled"
          : action === "retry" || action === "resume" || action === "reprint"
            ? "pending"
            : job.status;

    const [updated] = await this.db
      .update(printJobsCloud)
      .set({
        status,
        retryCount: action === "retry" || action === "reprint" ? job.retryCount + 1 : job.retryCount,
        error: action === "retry" || action === "reprint" ? null : job.error,
        updatedAt: new Date(),
      })
      .where(eq(printJobsCloud.id, jobId))
      .returning();

    this.events.emit("queue-updated", {
      organizationId,
      branchCode: job.branchCode,
      jobId,
      action,
      status,
    });
    return updated;
  }

  async discover(
    user: AccessJwtPayload,
    opts?: { branchCode?: string; onlineOnly?: boolean },
  ) {
    const organizationId = this.orgId(user);
    const rows = await this.db
      .select()
      .from(printBranchServers)
      .where(eq(printBranchServers.organizationId, organizationId))
      .orderBy(desc(printBranchServers.lastHeartbeatAt));

    const staleMs = 90_000;
    const now = Date.now();
    let servers = rows.map((row) => {
      const lastHb = row.lastHeartbeatAt ? new Date(row.lastHeartbeatAt).getTime() : 0;
      const fresh = lastHb > 0 && now - lastHb <= staleMs;
      const status =
        row.status === "online" && fresh
          ? "online"
          : row.status === "degraded"
            ? "degraded"
            : "offline";
      return {
        id: row.id,
        organizationId: row.organizationId,
        branchId: row.branchId,
        branchCode: row.branchCode,
        branchName: row.branchName,
        serverName: row.serverName,
        hostname: row.hostname,
        localIp: row.localIp,
        port: row.port || 9740,
        status: status as "online" | "offline" | "degraded",
        printerCount: row.printerCount,
        lastHeartbeatAt: row.lastHeartbeatAt
          ? new Date(row.lastHeartbeatAt).toISOString()
          : null,
        version: row.version,
        cloudSyncEnabled: row.cloudSyncEnabled,
      };
    });

    if (opts?.branchCode) {
      const code = opts.branchCode.trim().toUpperCase();
      servers = servers.filter((s) => s.branchCode.trim().toUpperCase() === code);
    }
    if (opts?.onlineOnly !== false) {
      servers = servers.filter((s) => s.status === "online");
    }

    return {
      servers,
      scannedAt: new Date().toISOString(),
    };
  }

  async status(user: AccessJwtPayload, branchCode?: string): Promise<PrintingStatus> {
    const organizationId = this.orgId(user);
    const servers = await this.db
      .select()
      .from(printBranchServers)
      .where(eq(printBranchServers.organizationId, organizationId));
    const printers = branchCode
      ? await this.db
          .select()
          .from(printPrinterNodes)
          .where(
            and(
              eq(printPrinterNodes.organizationId, organizationId),
              eq(printPrinterNodes.branchCode, branchCode),
            ),
          )
      : await this.db
          .select()
          .from(printPrinterNodes)
          .where(eq(printPrinterNodes.organizationId, organizationId));

    const pending = await this.countJobs(organizationId, "pending", branchCode);
    const printing = await this.countJobs(organizationId, "printing", branchCode);
    const failed = await this.countJobs(organizationId, "failed", branchCode);

    return {
      branchCode,
      serversOnline: servers.filter((s: { status: string }) => s.status === "online").length,
      printersOnline: printers.filter((p: { online: boolean }) => p.online).length,
      printersOffline: printers.filter((p: { online: boolean }) => !p.online).length,
      queuePending: pending,
      queuePrinting: printing,
      queueFailed: failed,
      cloudQueueEnabled: await this.isCloudQueueEnabled(organizationId),
    };
  }

  private async countJobs(organizationId: string, status: string, branchCode?: string) {
    const rows = branchCode
      ? await this.db
          .select({ c: sql<number>`count(*)::int` })
          .from(printJobsCloud)
          .where(
            and(
              eq(printJobsCloud.organizationId, organizationId),
              eq(printJobsCloud.branchCode, branchCode),
              eq(printJobsCloud.status, status),
            ),
          )
      : await this.db
          .select({ c: sql<number>`count(*)::int` })
          .from(printJobsCloud)
          .where(
            and(eq(printJobsCloud.organizationId, organizationId), eq(printJobsCloud.status, status)),
          );
    return Number(rows[0]?.c ?? 0);
  }

  async heartbeat(user: AccessJwtPayload, body: unknown) {
    const parsed = printerHeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const hb: PrinterHeartbeat = parsed.data;
    const organizationId = this.orgId(user);
    const now = new Date();

    const existing = await this.db
      .select()
      .from(printBranchServers)
      .where(
        and(
          eq(printBranchServers.organizationId, organizationId),
          eq(printBranchServers.serverKey, hb.serverId),
        ),
      )
      .limit(1);

    let server;
    if (existing[0]) {
      const wasOffline = existing[0].status !== "online";
      [server] = await this.db
        .update(printBranchServers)
        .set({
          branchCode: hb.branchCode,
          localIp: hb.localIp,
          port: hb.port,
          status: "online",
          printerCount: hb.printerCount,
          queuePending: hb.queuePending ?? 0,
          queueFailed: hb.queueFailed ?? 0,
          lastHeartbeatAt: now,
          updatedAt: now,
        })
        .where(eq(printBranchServers.id, existing[0].id))
        .returning();
      if (wasOffline) {
        this.events.emit("server-online", {
          organizationId,
          serverId: server.id,
          branchCode: hb.branchCode,
        });
      }
    } else {
      [server] = await this.db
        .insert(printBranchServers)
        .values({
          organizationId,
          serverKey: hb.serverId,
          branchCode: hb.branchCode,
          branchName: hb.branchCode,
          serverName: `Branch · ${hb.branchCode}`,
          localIp: hb.localIp,
          port: hb.port,
          status: "online",
          printerCount: hb.printerCount,
          queuePending: hb.queuePending ?? 0,
          queueFailed: hb.queueFailed ?? 0,
          lastHeartbeatAt: now,
        })
        .returning();
      this.events.emit("server-online", {
        organizationId,
        serverId: server.id,
        branchCode: hb.branchCode,
      });
    }

    if (hb.printers?.length) {
      for (const p of hb.printers) {
        const [node] = await this.db
          .select()
          .from(printPrinterNodes)
          .where(
            and(
              eq(printPrinterNodes.organizationId, organizationId),
              eq(printPrinterNodes.branchCode, hb.branchCode),
              eq(printPrinterNodes.id, p.id as never),
            ),
          )
          .limit(1);
        // Match by legacy id string stored in legacyProfileId when uuid cast fails
        void node;
        if (p.online === false) {
          await this.db.insert(printAlerts).values({
            organizationId,
            branchCode: hb.branchCode,
            alertType: "printer_offline",
            message: `Printer ${p.windowsPrinterName ?? p.id} offline`,
          });
          this.events.emit("printer-offline", {
            organizationId,
            branchCode: hb.branchCode,
            printerId: p.id,
          });
        } else {
          this.events.emit("printer-online", {
            organizationId,
            branchCode: hb.branchCode,
            printerId: p.id,
          });
        }
      }
    }

    // Mark stale servers offline (>90s without heartbeat)
    const stale = await this.db
      .select()
      .from(printBranchServers)
      .where(
        and(
          eq(printBranchServers.organizationId, organizationId),
          eq(printBranchServers.status, "online"),
        ),
      );
    for (const s of stale) {
      if (!s.lastHeartbeatAt) continue;
      const age = Date.now() - s.lastHeartbeatAt.getTime();
      if (age > 90_000 && s.serverKey !== hb.serverId) {
        await this.db
          .update(printBranchServers)
          .set({ status: "offline", updatedAt: new Date() })
          .where(eq(printBranchServers.id, s.id));
        this.events.emit("server-offline", {
          organizationId,
          serverId: s.id,
          branchCode: s.branchCode,
        });
      }
    }

    return server;
  }

  async listAlerts(user: AccessJwtPayload) {
    const organizationId = this.orgId(user);
    return this.db
      .select()
      .from(printAlerts)
      .where(
        and(eq(printAlerts.organizationId, organizationId), eq(printAlerts.dismissed, false)),
      )
      .orderBy(desc(printAlerts.createdAt))
      .limit(50);
  }

  private async isCloudQueueEnabled(organizationId: string): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, PRINTING_CLOUD_QUEUE_ENABLED_KEY))
      .limit(1);
    if (!row) {
      return Boolean(process.env.REDIS_URL?.trim() && this.cloudQueue?.isReady());
    }
    const value = row.value;
    if (value === true || value === 1 || value === "true" || value === "1") return true;
    if (typeof value === "object" && value !== null) {
      const parsed = value as { enabled?: boolean; orgs?: string[] };
      if (parsed.enabled === true) return true;
      if (Array.isArray(parsed.orgs) && parsed.orgs.includes(organizationId)) return true;
    }
    return Boolean(process.env.REDIS_URL?.trim() && this.cloudQueue?.isReady());
  }
}
