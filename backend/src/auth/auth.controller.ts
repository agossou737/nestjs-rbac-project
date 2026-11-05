import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Authenticated } from '../rbac/permissions.decorator.js';
import { AuthService } from './auth.service.js';
import { type AuthenticatedUser, CurrentUser, Public } from './decorators.js';
import { ForgotPasswordDto, LoginDto, MeDto, MessageDto, ResetPasswordDto, TokenResponseDto } from './dto.js';
import type { ClientInfo, IssuedRefreshToken } from './refresh-token.service.js';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieBase: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieBase = {
      httpOnly: true,
      secure: config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, clientInfo(req));
    this.setRefreshCookie(res, result.refresh);
    return result.body;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: TokenResponseDto })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(refreshCookie(req), clientInfo(req));
    this.setRefreshCookie(res, result.refresh);
    return result.body;
  }

  // Public: an expired access token must not prevent a user from ending the session.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(refreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieBase);
  }

  @Authenticated()
  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.auth.me(user.id);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: MessageDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageDto> {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If an active account matches this email, a reset link has been sent' };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  private setRefreshCookie(res: Response, refresh: IssuedRefreshToken): void {
    res.cookie(REFRESH_COOKIE, refresh.token, { ...this.cookieBase, expires: refresh.expiresAt });
  }
}

function refreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clientInfo(req: Request): ClientInfo {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}
