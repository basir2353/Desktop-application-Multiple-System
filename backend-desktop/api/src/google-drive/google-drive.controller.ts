import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { GoogleDriveService } from "./google-drive.service";

@Controller("v1/google-drive")
export class GoogleDriveController {
  constructor(private readonly drive: GoogleDriveService) {}

  @Get("status")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("pops.read")
  status(@CurrentUser() user: AccessJwtPayload) {
    return this.drive.getStatus(user.organizationId);
  }

  @Post("connect")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("pops.users.manage")
  connect(@CurrentUser() user: AccessJwtPayload) {
    return this.drive.startConnect(user.organizationId, user.sub);
  }

  @Delete("disconnect")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("pops.users.manage")
  disconnect(@CurrentUser() user: AccessJwtPayload) {
    return this.drive.disconnect(user.organizationId);
  }

  /** Browser redirect target after Google consent (no JWT — state is signed). */
  @Get("oauth/callback")
  async oauthCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      res
        .status(400)
        .type("html")
        .send(htmlPage("Google Drive", `Connection cancelled: ${error}`, false));
      return;
    }
    if (!code || !state) {
      res.status(400).type("html").send(htmlPage("Google Drive", "Missing code or state.", false));
      return;
    }
    try {
      const result = await this.drive.handleOAuthCallback(code, state);
      res
        .status(200)
        .type("html")
        .send(
          htmlPage(
            "Google Drive connected",
            `Connected${result.email ? ` as ${escapeHtml(result.email)}` : ""}. You can close this window and return to MobiZone.`,
            true,
          ),
        );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect Google Drive";
      res.status(400).type("html").send(htmlPage("Google Drive", escapeHtml(message), false));
    }
  }

  @Post("upload")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("pops.read")
  upload(
    @CurrentUser() user: AccessJwtPayload,
    @Body() body: { dataUrl?: string; fileName?: string; mimeType?: string },
  ) {
    return this.drive.uploadDataUrl(user.organizationId, {
      dataUrl: body?.dataUrl ?? "",
      fileName: body?.fileName,
      mimeType: body?.mimeType,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage(title: string, message: string, ok: boolean): string {
  const color = ok ? "#0F9B8E" : "#E11D48";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0A1218;color:#E8EEF4;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
.card{max-width:420px;background:#12202B;border:1px solid #243847;border-radius:16px;padding:24px}
h1{font-size:1.15rem;margin:0 0 8px;color:${color}}p{margin:0;line-height:1.45;color:#8AA3B0}</style></head>
<body><div class="card"><h1>${escapeHtml(title)}</h1><p>${message}</p></div></body></html>`;
}
