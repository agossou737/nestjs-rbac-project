import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/decorators.js';

// Who acts and from where: what business services need for access checks and the activity log.
export type ActorContext = { id: string; ipAddress?: string; userAgent?: string };

export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
  return { id: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') };
});
