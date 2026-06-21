import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { acceptInviteSchema, loginRequestSchema, refreshRequestSchema } from "@platform/contracts";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";

@Controller("v1/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post("login")
  async login(@Body() body: unknown) {
    const parsed = loginRequestSchema.parse(body);
    return this.auth.login(parsed.email, parsed.password);
  }

  @Post("refresh")
  async refresh(@Body() body: unknown) {
    const parsed = refreshRequestSchema.parse(body);
    return this.auth.refresh(parsed.refreshToken);
  }

  @Get("invite")
  previewInvite(@Query("token") token: string | undefined) {
    if (!token?.trim()) throw new BadRequestException("Missing invite token");
    return this.users.getInvitePreview(token.trim());
  }

  @Post("accept-invite")
  async acceptInvite(@Body() body: unknown) {
    const parsed = acceptInviteSchema.parse(body);
    const { email } = await this.users.acceptInvite(parsed);
    return this.auth.login(email, parsed.password);
  }
}
