import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { eq, like } from "drizzle-orm";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { popsMenuCategories, popsMenuItems, type PlatformPgDb } from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import type { MenuUploadedFile } from "./menu-upload.types";
import {
  absolutePathForUploadUrl,
  bufferToMenuImageDataUrl,
  isEphemeralUploadPath,
  MAX_MENU_IMAGE_DATA_URL_CHARS,
  mimeFromUploadFilename,
  resolveMenuUploadsRoot,
} from "./menu-upload.paths";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

type MigrateResult =
  | { status: "migrated"; dataUrl: string }
  | { status: "missing" }
  | { status: "skip" };

@Injectable()
export class MenuUploadService {
  private readonly logger = new Logger(MenuUploadService.name);
  private readonly rootDir = resolveMenuUploadsRoot();

  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  /**
   * Persist a menu photo as a data-URL for the DB (survives redeploys).
   * Disk write is best-effort only for legacy `/uploads` serving.
   */
  async saveMenuImage(organizationId: string, file: MenuUploadedFile): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Image file is required");
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException("Only JPEG, PNG, WebP, and GIF images are allowed");
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException("Image must be 5 MB or smaller");
    }

    const dataUrl = bufferToMenuImageDataUrl(file.buffer, file.mimetype);
    if (dataUrl.length > MAX_MENU_IMAGE_DATA_URL_CHARS) {
      throw new BadRequestException(
        "Image is too large to store safely. Use the app photo picker (auto-compress) instead.",
      );
    }

    try {
      const ext = EXT_BY_MIME[file.mimetype] ?? ".jpg";
      const dir = join(this.rootDir, organizationId);
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}${ext}`;
      await writeFile(join(dir, filename), file.buffer);
    } catch (err) {
      this.logger.warn(
        `Could not mirror menu image to disk (DB data-URL still saved): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return dataUrl;
  }

  /**
   * Startup repair: rewrite `/uploads/...` rows to data-URLs when the file
   * still exists on disk. Missing files cannot be recovered.
   */
  async migrateEphemeralUploadPathsToDataUrls(): Promise<{ migrated: number; missing: number }> {
    let migrated = 0;
    let missing = 0;

    const categories = await this.db
      .select({ id: popsMenuCategories.id, imageUrl: popsMenuCategories.imageUrl })
      .from(popsMenuCategories)
      .where(like(popsMenuCategories.imageUrl, "/uploads/%"));

    for (const row of categories) {
      const result = await this.tryMigrateRowImage(row.imageUrl);
      if (result.status === "migrated") {
        await this.db
          .update(popsMenuCategories)
          .set({ imageUrl: result.dataUrl })
          .where(eq(popsMenuCategories.id, row.id));
        migrated += 1;
      } else if (result.status === "missing") {
        missing += 1;
      }
    }

    const items = await this.db
      .select({ id: popsMenuItems.id, imageUrl: popsMenuItems.imageUrl })
      .from(popsMenuItems)
      .where(like(popsMenuItems.imageUrl, "/uploads/%"));

    for (const row of items) {
      const result = await this.tryMigrateRowImage(row.imageUrl);
      if (result.status === "migrated") {
        await this.db
          .update(popsMenuItems)
          .set({ imageUrl: result.dataUrl })
          .where(eq(popsMenuItems.id, row.id));
        migrated += 1;
      } else if (result.status === "missing") {
        missing += 1;
      }
    }

    if (migrated > 0 || missing > 0) {
      this.logger.log(
        `Menu image migrate: ${migrated} path(s) → data-URL, ${missing} missing file(s)`,
      );
    }
    return { migrated, missing };
  }

  private async tryMigrateRowImage(imageUrl: string | null): Promise<MigrateResult> {
    if (!isEphemeralUploadPath(imageUrl) || !imageUrl) return { status: "skip" };
    const abs = absolutePathForUploadUrl(imageUrl);
    if (!abs) return { status: "missing" };
    try {
      const buffer = await readFile(abs);
      const mime = mimeFromUploadFilename(basename(abs));
      const dataUrl = bufferToMenuImageDataUrl(buffer, mime);
      if (dataUrl.length > MAX_MENU_IMAGE_DATA_URL_CHARS) return { status: "missing" };
      return { status: "migrated", dataUrl };
    } catch {
      return { status: "missing" };
    }
  }
}
