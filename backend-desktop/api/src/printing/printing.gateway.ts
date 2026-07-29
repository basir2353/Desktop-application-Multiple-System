import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrintingEvents } from "./printing.events";

/**
 * Socket.IO gateway shim.
 * Registers when `@nestjs/websockets` + `socket.io` are available; otherwise logs and no-ops.
 * Realtime clients can always use `GET /v1/printing/events` (SSE).
 */
@Injectable()
export class PrintingGateway implements OnModuleInit {
  private readonly logger = new Logger(PrintingGateway.name);

  constructor(private readonly events: PrintingEvents) {}

  async onModuleInit(): Promise<void> {
    try {
      const websockets = await import("@nestjs/websockets").catch(() => null);
      const platformIo = await import("@nestjs/platform-socket.io").catch(() => null);
      if (!websockets || !platformIo) {
        this.logger.log(
          "Socket.IO packages not installed — using SSE /v1/printing/events for realtime",
        );
        return;
      }
      this.logger.log("Socket.IO packages detected — wire PrintingGatewayIo if needed");
      // Event bus remains the source of truth; optional IO adapters can subscribe.
      this.events.on("*", (msg) => {
        this.logger.debug(`print event ${(msg as { event?: string }).event ?? "?"}`);
      });
    } catch (err) {
      this.logger.warn(
        `Printing gateway init: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
