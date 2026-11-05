import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SUPER_ADMIN_ROLE } from './permission-catalog.js';
import { RbacService } from './rbac.service.js';

// Resource-level rules that a route permission cannot express. Business services call them before writing.
@Injectable()
export class AccessPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  // A Super Administrator can only be managed by another one, and nobody manages their own account through admin routes.
  async assertCanManageUser(actorId: string, targetUserId: string): Promise<void> {
    if (actorId === targetUserId) throw new ForbiddenException('You cannot perform this action on your own account');
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');
    if ((await this.rbac.isSuperAdmin(targetUserId)) && !(await this.rbac.isSuperAdmin(actorId))) {
      throw new ForbiddenException('Only a Super Administrator can manage a Super Administrator account');
    }
  }

  // Anti-escalation: every role added or removed must carry only permissions the actor already holds.
  async assertCanAssignRoles(
    actorId: string,
    targetUserId: string,
    addedRoleIds: string[],
    removedRoleIds: string[],
  ): Promise<void> {
    if (actorId === targetUserId) throw new ForbiddenException('You cannot change your own roles');
    await this.assertCanManageUser(actorId, targetUserId);

    const roleIds = [...new Set([...addedRoleIds, ...removedRoleIds])];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, deletedAt: null },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });
    if (roles.length !== roleIds.length) throw new NotFoundException('Role not found');

    await this.assertCanGrantPermissions(
      actorId,
      roles.flatMap((role) => role.permissions.map((rp) => rp.permission.key)),
    );

    const removesSuperAdmin = roles.some((role) => role.name === SUPER_ADMIN_ROLE && removedRoleIds.includes(role.id));
    if (removesSuperAdmin) await this.assertSuperAdminRemains(targetUserId);
  }

  async assertCanGrantPermissions(actorId: string, permissionKeys: string[]): Promise<void> {
    const held = await this.rbac.getPermissions(actorId);
    const missing = [...new Set(permissionKeys)].filter((key) => !held.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`You cannot grant permissions you do not hold: ${missing.sort().join(', ')}`);
    }
  }

  // Called before removing the role from, deactivating or deleting a Super Administrator.
  async assertSuperAdminRemains(leavingUserId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: {
        id: { not: leavingUserId },
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { name: SUPER_ADMIN_ROLE, deletedAt: null } } },
      },
    });
    if (others === 0) throw new ConflictException('The last active Super Administrator cannot be removed');
  }
}
