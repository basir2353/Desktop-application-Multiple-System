import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

type CloudPrintJobPayload = {
  organizationId: string;
  jobId: string;
  branchCode: string;
};

/**
 * Optional Redis/BullMQ cloud orchestration.
 * When REDIS_URL is unset, jobs stay Postgres-only (branch server still executes locally).
 */
@Injectable()
export class PrintingCloudQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrintingCloudQueue.name);
  private ready = false;
  private queue: { add: (name: string, data: CloudPrintJobPayload) => Promise<unknown> } | null =
    null;
  private memory: CloudPrintJobPayload[] = [];

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      this.logger.log("REDIS_URL not set — using in-memory cloud print queue fallback");
      this.ready = true;
      return;
    }
    try {
      // Dynamic import so API boots without bullmq/ioredis installed.
      const bullmq = await import("bullmq").catch(() => null);
      if (!bullmq) {
        this.logger.warn("bullmq not installed — in-memory cloud print queue");
        this.ready = true;
        return;
      }
      const connection = { url: redisUrl };
      this.queue = new bullmq.Queue("printing-cloud", { connection }) as unknown as {
        add: (name: string, data: CloudPrintJobPayload) => Promise<unknown>;
      };
      // Worker only logs / marks ready for branch pickup — execution remains on branch server.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const worker = new (bullmq as any).Worker(
        "printing-cloud",
        async (job: { data: CloudPrintJobPayload }) => {
          this.logger.debug(
            `cloud print orchestration job=${job.data.jobId} branch=${job.data.branchCode}`,
          );
          return { ok: true };
        },
        { connection },
      );
      worker.on("failed", (job: { id?: string } | undefined, err: Error) => {
        this.logger.warn(`cloud print job failed ${job?.id}: ${err.message}`);
      });
      this.ready = true;
      this.logger.log("BullMQ printing-cloud queue ready");
    } catch (err) {
      this.logger.warn(
        `Cloud queue init failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.ready = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    // best-effort; Queue.close if present
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.queue as any)?.close?.();
    } catch {
      // ignore
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async enqueue(payload: CloudPrintJobPayload): Promise<void> {
    if (this.queue) {
      await this.queue.add("orchestrate", payload);
      return;
    }
    this.memory.push(payload);
    if (this.memory.length > 500) this.memory.shift();
  }

  peekMemory(): CloudPrintJobPayload[] {
    return [...this.memory];
  }
}
