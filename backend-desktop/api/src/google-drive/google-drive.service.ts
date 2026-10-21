import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../drizzle/drizzle.service";
import type {
  GoogleDriveStatus,
  GoogleDriveStoredTokens,
  GoogleDriveUploadResult,
} from "./google-drive.types";

const SETTINGS_KEY = "google.drive";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const STATE_TTL_MS = 15 * 60 * 1000;

type OAuthStatePayload = {
  orgId: string;
  userId: string;
  exp: number;
  nonce: string;
};

@Injectable()
export class GoogleDriveService {
  private readonly log = new Logger(GoogleDriveService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  private clientId(): string {
    return (this.config.get<string>("GOOGLE_DRIVE_CLIENT_ID") ?? "").trim();
  }

  private clientSecret(): string {
    return (this.config.get<string>("GOOGLE_DRIVE_CLIENT_SECRET") ?? "").trim();
  }

  private redirectUri(): string {
    return (this.config.get<string>("GOOGLE_DRIVE_REDIRECT_URI") ?? "").trim();
  }

  private androidClientId(): string {
    return (this.config.get<string>("GOOGLE_DRIVE_ANDROID_CLIENT_ID") ?? "").trim();
  }

  private signingSecret(): string {
    return (
      this.config.get<string>("JWT_ACCESS_SECRET")?.trim() ||
      this.config.get<string>("JWT_SECRET")?.trim() ||
      this.clientSecret() ||
      "google-drive-dev"
    );
  }

  isConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
  }

  private async ensureSettingsTable(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS org_app_settings (
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        key text NOT NULL,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (organization_id, key)
      )
    `);
  }

  private async readTokens(organizationId: string): Promise<GoogleDriveStoredTokens | null> {
    await this.ensureSettingsTable();
    const rows = await this.db.execute(sql`
      SELECT value FROM org_app_settings
      WHERE organization_id = ${organizationId}::uuid AND key = ${SETTINGS_KEY}
      LIMIT 1
    `);
    const row =
      (rows as unknown as { rows?: Array<{ value: unknown }> }).rows?.[0] ??
      (Array.isArray(rows) ? (rows as Array<{ value: unknown }>)[0] : undefined);
    const value = row?.value;
    if (!value || typeof value !== "object") return null;
    const v = value as Partial<GoogleDriveStoredTokens>;
    if (!v.refreshToken || typeof v.refreshToken !== "string") return null;
    return {
      connected: true,
      connectedAt: typeof v.connectedAt === "string" ? v.connectedAt : new Date().toISOString(),
      email: typeof v.email === "string" ? v.email : null,
      refreshToken: v.refreshToken,
      accessToken: typeof v.accessToken === "string" ? v.accessToken : null,
      accessTokenExpiresAt:
        typeof v.accessTokenExpiresAt === "string" ? v.accessTokenExpiresAt : null,
      rootFolderId: typeof v.rootFolderId === "string" ? v.rootFolderId : null,
    };
  }

  private async writeTokens(
    organizationId: string,
    tokens: GoogleDriveStoredTokens,
  ): Promise<void> {
    await this.ensureSettingsTable();
    await this.db.execute(sql`
      INSERT INTO org_app_settings (organization_id, key, value, updated_at)
      VALUES (${organizationId}::uuid, ${SETTINGS_KEY}, ${JSON.stringify(tokens)}::jsonb, now())
      ON CONFLICT (organization_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
  }

  private async clearTokens(organizationId: string): Promise<void> {
    await this.ensureSettingsTable();
    await this.db.execute(sql`
      DELETE FROM org_app_settings
      WHERE organization_id = ${organizationId}::uuid AND key = ${SETTINGS_KEY}
    `);
  }

  async getStatus(organizationId: string): Promise<GoogleDriveStatus> {
    const tokens = await this.readTokens(organizationId);
    return {
      configured: this.isConfigured(),
      connected: Boolean(tokens?.refreshToken),
      email: tokens?.email ?? null,
      connectedAt: tokens?.connectedAt ?? null,
      androidClientId: this.androidClientId() || null,
    };
  }

  private signState(payload: OAuthStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", this.signingSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  private verifyState(state: string): OAuthStatePayload {
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new BadRequestException("Invalid OAuth state");
    const expected = createHmac("sha256", this.signingSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException("Invalid OAuth state signature");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload?.orgId || !payload?.userId || !payload?.exp) {
      throw new BadRequestException("Invalid OAuth state payload");
    }
    if (Date.now() > payload.exp) throw new BadRequestException("OAuth state expired — try again");
    return payload;
  }

  async startConnect(organizationId: string, userId: string): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Google Drive is not configured on the server (missing GOOGLE_DRIVE_* env).",
      );
    }
    const state = this.signState({
      orgId: organizationId,
      userId,
      exp: Date.now() + STATE_TTL_MS,
      nonce: randomBytes(8).toString("hex"),
    });
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      response_type: "code",
      scope: DRIVE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  async handleOAuthCallback(code: string, state: string): Promise<{ orgId: string; email: string | null }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Google Drive is not configured on the server.");
    }
    const payload = this.verifyState(state);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        redirect_uri: this.redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      this.log.warn(`Google token exchange failed: ${tokenJson.error_description ?? tokenJson.error}`);
      throw new BadRequestException(
        tokenJson.error_description || tokenJson.error || "Google token exchange failed",
      );
    }
    if (!tokenJson.refresh_token) {
      throw new BadRequestException(
        "Google did not return a refresh token. Disconnect the app in Google Account permissions and try again.",
      );
    }

    const email = await this.fetchUserEmail(tokenJson.access_token);
    const expiresAt = new Date(
      Date.now() + Math.max(60, Number(tokenJson.expires_in ?? 3600) - 60) * 1000,
    ).toISOString();

    const stored: GoogleDriveStoredTokens = {
      connected: true,
      connectedAt: new Date().toISOString(),
      email,
      refreshToken: tokenJson.refresh_token,
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: expiresAt,
      rootFolderId: null,
    };
    const folderId = await this.ensureRootFolder(tokenJson.access_token, payload.orgId);
    stored.rootFolderId = folderId;
    await this.writeTokens(payload.orgId, stored);
    return { orgId: payload.orgId, email };
  }

  async disconnect(organizationId: string): Promise<GoogleDriveStatus> {
    const tokens = await this.readTokens(organizationId);
    if (tokens?.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch {
        /* ignore revoke errors */
      }
    }
    await this.clearTokens(organizationId);
    return this.getStatus(organizationId);
  }

  private async fetchUserEmail(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { email?: string };
      return json.email ?? null;
    } catch {
      return null;
    }
  }

  private async refreshAccessToken(organizationId: string, tokens: GoogleDriveStoredTokens): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new BadRequestException("Google Drive session expired — reconnect Drive.");
    }
    const next: GoogleDriveStoredTokens = {
      ...tokens,
      accessToken: json.access_token,
      accessTokenExpiresAt: new Date(
        Date.now() + Math.max(60, Number(json.expires_in ?? 3600) - 60) * 1000,
      ).toISOString(),
    };
    await this.writeTokens(organizationId, next);
    return json.access_token;
  }

  private async getAccessToken(organizationId: string): Promise<{ token: string; stored: GoogleDriveStoredTokens }> {
    const stored = await this.readTokens(organizationId);
    if (!stored) throw new BadRequestException("Google Drive is not connected for this shop.");
    const expires = stored.accessTokenExpiresAt ? Date.parse(stored.accessTokenExpiresAt) : 0;
    if (stored.accessToken && expires > Date.now() + 30_000) {
      return { token: stored.accessToken, stored };
    }
    const token = await this.refreshAccessToken(organizationId, stored);
    const again = await this.readTokens(organizationId);
    return { token, stored: again ?? { ...stored, accessToken: token } };
  }

  private async ensureRootFolder(accessToken: string, organizationId: string): Promise<string> {
    const name = `POPS-MobiZone-${organizationId.slice(0, 8)}`;
    const q = encodeURIComponent(
      `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const list = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (list.ok) {
      const data = (await list.json()) as { files?: Array<{ id: string }> };
      if (data.files?.[0]?.id) return data.files[0].id;
    }
    const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    if (!create.ok) {
      const text = await create.text().catch(() => "");
      throw new BadRequestException(`Could not create Drive folder: ${text || create.status}`);
    }
    const created = (await create.json()) as { id: string };
    return created.id;
  }

  async uploadDataUrl(
    organizationId: string,
    input: { dataUrl: string; fileName?: string; mimeType?: string },
  ): Promise<GoogleDriveUploadResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Google Drive is not configured on the server.");
    }
    const dataUrl = input.dataUrl?.trim();
    if (!dataUrl?.startsWith("data:")) {
      throw new BadRequestException("Expected a data: URL for upload");
    }
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) throw new BadRequestException("Invalid data URL");
    const mimeType = (input.mimeType || match[1] || "application/octet-stream").trim();
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException("File too large (max 8 MB)");
    }

    const { token, stored } = await this.getAccessToken(organizationId);
    let folderId = stored.rootFolderId;
    if (!folderId) {
      folderId = await this.ensureRootFolder(token, organizationId);
      await this.writeTokens(organizationId, { ...stored, rootFolderId: folderId });
    }

    const ext =
      mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : mimeType.includes("pdf") ? "pdf" : "jpg";
    const name =
      (input.fileName?.trim() || `mobizone-${Date.now()}.${ext}`).replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180);

    const metadata = {
      name,
      parents: [folderId],
    };
    const boundary = `pops_${randomBytes(8).toString("hex")}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
        "utf8",
      ),
      Buffer.from(base64, "utf8"),
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
    ]);

    const upload = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!upload.ok) {
      const text = await upload.text().catch(() => "");
      this.log.warn(`Drive upload failed: ${text || upload.status}`);
      throw new BadRequestException(text || `Drive upload failed (${upload.status})`);
    }
    const file = (await upload.json()) as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      webContentLink?: string;
    };

    // Anyone-with-link can view — optional; keeps mobile/desktop preview simple.
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch {
      /* keep private if permission fails */
    }

    return {
      fileId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      webContentLink: file.webContentLink ?? null,
    };
  }
}
