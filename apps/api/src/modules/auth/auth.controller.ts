import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, Public } from "../../common/decorators";
import { CsrfHeaderGuard } from "../../common/guards";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from "./auth.dto";
import { AuthService, toAuthUser } from "./auth.service";
import { REFRESH_COOKIE, TokenService } from "./token.service";

/** Stricter rate limit for credential and code endpoints: 5 per minute per IP + email. */
const SENSITIVE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle(SENSITIVE)
  @Post("register")
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, req);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("verify-email")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("resend-otp")
  resend(@Body() dto: EmailDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refresh } = await this.auth.login(dto, req);
    this.tokens.setCookie(res, refresh.raw, refresh.expiresAt);
    return { user, accessToken };
  }

  /** Exchanges the HTTP-only refresh cookie for a new access token (rotating the cookie). */
  @Public()
  @UseGuards(CsrfHeaderGuard)
  @ApiHeader({ name: "x-medcore-csrf", required: true, description: "Must be 1" })
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, accessToken, refresh } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], req);
      this.tokens.setCookie(res, refresh.raw, refresh.expiresAt);
      return { user, accessToken };
    } catch (e) {
      this.tokens.clearCookie(res);
      throw e;
    }
  }

  @Public()
  @UseGuards(CsrfHeaderGuard)
  @ApiHeader({ name: "x-medcore-csrf", required: true, description: "Must be 1" })
  @HttpCode(200)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.tokens.revoke(req.cookies?.[REFRESH_COOKIE]);
    this.tokens.clearCookie(res);
    return { loggedOut: true };
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("forgot-password")
  forgot(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("reset-password")
  reset(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, req);
  }

  @ApiBearerAuth()
  @Get("me")
  async me(@CurrentUser() user: RequestUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { hospital: { select: { name: true } } } });
    return toAuthUser(u);
  }
}
