import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateOpaqueToken, hashOpaqueToken } from './opaque-token.js';

export type ClientInfo = { ipAddress?: string; userAgent?: string };
export type IssuedRefreshToken = { token: string; userId: string; familyId: string; expiresAt: Date };

const INVALID_REFRESH = 'Invalid or expired refresh token';

@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlMs = config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  async issue(userId: string, client: ClientInfo, familyId: string = randomUUID()): Promise<IssuedRefreshToken> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: hashOpaqueToken(token), expiresAt, ...clientColumns(client) },
    });
    return { token, userId, familyId, expiresAt };
  }

  // Rotation: the presented token is consumed and replaced. Presenting a consumed token means it was stolen
  // or replayed, so the whole family (session) is revoked.
  async rotate(presented: string | undefined, client: ClientInfo): Promise<IssuedRefreshToken> {
    if (!presented) throw new UnauthorizedException(INVALID_REFRESH);
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashOpaqueToken(presented) },
      include: { user: { select: { status: true, deletedAt: true } } },
    });
    if (!current) throw new UnauthorizedException(INVALID_REFRESH);

    if (current.revokedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    if (current.expiresAt <= new Date() || current.user.status !== 'ACTIVE' || current.user.deletedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const rotated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: hashOpaqueToken(token),
          expiresAt,
          ...clientColumns(client),
        },
      });
      const consumed = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      return consumed.count === 1;
    });
    if (!rotated) {
      // Two concurrent refreshes with the same token: treat the loser as a replay.
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    return { token, userId: current.userId, familyId: current.familyId, expiresAt };
  }

  async revokeByToken(presented: string | undefined): Promise<void> {
    if (!presented) return;
    const current = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashOpaqueToken(presented) } });
    if (current) await this.revokeFamily(current.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

function clientColumns(client: ClientInfo) {
  return { ipAddress: client.ipAddress?.slice(0, 45), userAgent: client.userAgent?.slice(0, 255) };
}
