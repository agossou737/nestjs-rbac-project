import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { LoginOutcome, User } from '../generated/prisma/client.js';
import { ActivityLogService } from '../activity-logs/activity-log.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MeDto, TokenResponseDto } from './dto.js';
import type { AccessTokenPayload } from './jwt.strategy.js';
import { generateOpaqueToken, hashOpaqueToken } from './opaque-token.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { type ClientInfo, type IssuedRefreshToken, RefreshTokenService } from './refresh-token.service.js';

export type AuthResult = { body: TokenResponseDto; refresh: IssuedRefreshToken };

// Same message for every login failure: the API never tells whether an email exists or why it was refused.
const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSeconds: number;
  private readonly maxAttempts: number;
  private readonly accountMaxAttempts: number;
  private readonly lockMs: number;
  private readonly resetTtlMs: number;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly mail: MailService,
    private readonly activity: ActivityLogService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    this.maxAttempts = config.getOrThrow<number>('LOGIN_MAX_ATTEMPTS');
    this.accountMaxAttempts = config.getOrThrow<number>('LOGIN_ACCOUNT_MAX_ATTEMPTS');
    this.lockMs = config.getOrThrow<number>('LOGIN_LOCK_MINUTES') * 60_000;
    this.resetTtlMs = config.getOrThrow<number>('PASSWORD_RESET_TTL_MINUTES') * 60_000;
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  async login(email: string, password: string, client: ClientInfo): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const account = user && !user.deletedAt ? user : null;
    const passwordOk = await verifyPassword(account?.passwordHash ?? null, password);

    if (!account) {
      await this.recordLogin(email, 'INVALID_CREDENTIALS', client, user?.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if ((account.lockedUntil && account.lockedUntil > new Date()) || (await this.ipFailures(account.id, client)) >= this.maxAttempts) {
      await this.recordLogin(email, 'ACCOUNT_LOCKED', client, account.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!passwordOk) {
      await this.registerFailure(account);
      await this.recordLogin(email, 'INVALID_CREDENTIALS', client, account.id);
      if ((await this.ipFailures(account.id, client)) === this.maxAttempts) {
        await this.activity.record({
          action: 'auth.login_blocked',
          entityType: 'user',
          entityId: account.id,
          metadata: { scope: 'ip', minutes: this.lockMs / 60_000 },
          ...client,
        });
      }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Status is checked only after the password, so a guesser learns nothing about disabled accounts.
    if (account.status !== 'ACTIVE') {
      await this.recordLogin(email, account.status === 'LOCKED' ? 'ACCOUNT_LOCKED' : 'ACCOUNT_INACTIVE', client, account.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.prisma.user.update({
      where: { id: account.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const refresh = await this.refreshTokens.issue(account.id, client);
    await this.recordLogin(email, 'SUCCESS', client, account.id);
    return { body: await this.tokenResponse(account, refresh.familyId), refresh };
  }

  async refresh(presented: string | undefined, client: ClientInfo): Promise<AuthResult> {
    const refresh = await this.refreshTokens.rotate(presented, client);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: refresh.userId } });
    return { body: await this.tokenResponse(user, refresh.familyId), refresh };
  }

  async logout(presented: string | undefined, client: ClientInfo): Promise<void> {
    const userId = await this.refreshTokens.revokeByToken(presented);
    if (userId) {
      await this.activity.record({ actorId: userId, action: 'auth.logout', entityType: 'user', entityId: userId, ...client });
    }
  }

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: {
          where: { role: { deletedAt: null } },
          include: { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } },
        },
      },
    });
    const roles = user.roles.map(({ role }) => role).sort((a, b) => a.name.localeCompare(b.name));
    const permissions = [...new Set(roles.flatMap((role) => role.permissions.map((rp) => rp.permission.key)))].sort();
    return {
      ...toUserSummary(user),
      status: user.status,
      last_login_at: user.lastLoginAt?.toISOString() ?? null,
      roles: roles.map((role) => ({ id: role.id, name: role.name })),
      permissions,
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email, status: 'ACTIVE', deletedAt: null } });
    if (user) await this.issuePasswordReset(user);
  }

  // Also used to invite a new account and for an administrator-requested reset: nobody ever sees a password.
  async issuePasswordReset(user: Pick<User, 'id' | 'email'>): Promise<void> {
    const token = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + this.resetTtlMs) },
      }),
    ]);
    const resetUrl = `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    // Not awaited: the response time must not depend on whether a mail was sent.
    this.mail.sendPasswordReset(user.email, resetUrl).catch((error: Error) => {
      this.logger.error(`Password reset mail could not be sent: ${error.message}`);
    });
  }

  async resetPassword(token: string, password: string, client: ClientInfo): Promise<void> {
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashOpaqueToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { deletedAt: null },
      },
    });
    if (!reset) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await hashPassword(password);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Claim the token first: of two concurrent resets with the same link, only one may change the password.
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new BadRequestException('Invalid or expired reset token');
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
      });
      await tx.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } });
    });
    await this.activity.record({ actorId: reset.userId, action: 'auth.password_reset', entityType: 'user', entityId: reset.userId, ...client });
  }

  private async tokenResponse(user: User, sessionId: string): Promise<TokenResponseDto> {
    const payload: AccessTokenPayload = { sub: user.id, sid: sessionId };
    return {
      access_token: await this.jwt.signAsync(payload),
      token_type: 'Bearer',
      expires_in: this.accessTtlSeconds,
      user: toUserSummary(user),
    };
  }

  // Brute force is stopped per (account, IP): an attacker who knows an email only blocks their own address, never the
  // real owner. Counts the failures from this IP in the window, since the last success from it.
  private async ipFailures(userId: string, client: ClientInfo): Promise<number> {
    const ipAddress = client.ipAddress?.slice(0, 45) ?? null;
    const lastSuccess = await this.prisma.loginHistory.findFirst({
      where: { userId, ipAddress, outcome: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const windowStart = new Date(Date.now() - this.lockMs);
    const since = lastSuccess && lastSuccess.createdAt > windowStart ? lastSuccess.createdAt : windowStart;
    return this.prisma.loginHistory.count({ where: { userId, ipAddress, outcome: 'INVALID_CREDENTIALS', createdAt: { gt: since } } });
  }

  // Second line, against a distributed attack: the whole account locks at a much higher threshold, all IPs together.
  // Atomic increment so parallel guesses cannot slip past the threshold.
  private async registerFailure(user: User): Promise<void> {
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount >= this.accountMaxAttempts) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + this.lockMs) },
      });
      await this.activity.record({
        action: 'auth.account_locked',
        entityType: 'user',
        entityId: user.id,
        metadata: { scope: 'account', minutes: this.lockMs / 60_000 },
      });
    }
  }

  private async recordLogin(email: string, outcome: LoginOutcome, client: ClientInfo, userId?: string): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        email: email.slice(0, 254),
        outcome,
        userId: userId ?? null,
        ipAddress: client.ipAddress?.slice(0, 45),
        userAgent: client.userAgent?.slice(0, 255),
      },
    });
  }
}

function toUserSummary(user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>) {
  return { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName };
}
