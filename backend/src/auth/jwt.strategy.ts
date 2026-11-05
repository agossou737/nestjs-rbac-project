import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './decorators.js';

export type AccessTokenPayload = { sub: string; sid: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
    });
  }

  // The signature is not enough: the account must still be active and its session not revoked.
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const [user, session] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      }),
      this.prisma.refreshToken.findFirst({
        where: { familyId: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      }),
    ]);
    if (!user || !session) throw new UnauthorizedException('Invalid or expired access token');
    return { id: user.id, sessionId: payload.sid };
  }
}
