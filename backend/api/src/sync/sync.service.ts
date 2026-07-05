import { ForbiddenException, Injectable } from "@nestjs/common";
import type { SyncPushBatch } from "@platform/contracts";

@Injectable()
export class SyncService {
  push(actorOrganizationId: string, batch: SyncPushBatch): { accepted: true; processed: number } {
    if (batch.organizationId !== actorOrganizationId) {
      throw new ForbiddenException("organization mismatch");
    }
    return { accepted: true, processed: batch.mutations.length };
  }
}
