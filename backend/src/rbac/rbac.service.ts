import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type PermissionKey, SUPER_ADMIN_ROLE } from './permission-catalog.js';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  // Always read from the database: a role change or a deactivation applies on the very next request.
  async getPermissions(userId: string): Promise<Set<string>> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        roles: {
          some: {
            role: {
              deletedAt: null,
              users: { some: { userId, user: { status: 'ACTIVE', deletedAt: null } } },
            },
          },
        },
      },
      select: { key: true },
    });
    return new Set(permissions.map((p) => p.key));
  }

  async hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
    return (await this.getPermissions(userId)).has(permission);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { name: SUPER_ADMIN_ROLE, deletedAt: null } },
    });
    return count > 0;
  }
}
