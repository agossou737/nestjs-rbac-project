import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type AuthenticatedUser, IS_PUBLIC_KEY } from '../auth/decorators.js';
import { AUTHENTICATED_KEY, PERMISSIONS_KEY, type PermissionRequirement } from './permissions.decorator.js';
import { RbacService } from './rbac.service.js';

// Runs after JwtAuthGuard. The frontend hides what a user cannot do; this guard is what actually forbids it.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_KEY, targets)) return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSIONS_KEY, targets);
    if (!requirement) throw new ForbiddenException('This route declares no permission and is denied by default');

    const user = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>().user;
    const granted = await this.rbac.getPermissions(user.id);
    const allowed =
      requirement.mode === 'all'
        ? requirement.keys.every((key) => granted.has(key))
        : requirement.keys.some((key) => granted.has(key));
    if (!allowed) throw new ForbiddenException('You do not have the permission required for this action');
    return true;
  }
}
