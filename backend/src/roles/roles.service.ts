import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLogService } from '../activity-logs/activity-log.service.js';
import type { ActorContext } from '../common/actor.decorator.js';
import { pageArgs, toPage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessPolicy } from '../rbac/access-policy.service.js';
import { SUPER_ADMIN_ROLE } from '../rbac/permission-catalog.js';
import type { CreateRoleDto, ListRolesQueryDto, UpdateRoleDto } from './dto.js';

// Users counted are the live accounts only; a deleted account does not keep a role "in use".
const withCounts = {
  _count: { select: { users: { where: { user: { deletedAt: null } } }, permissions: true } },
} satisfies Prisma.RoleInclude;

const withDetail = {
  ...withCounts,
  permissions: { include: { permission: { select: { key: true } } } },
} satisfies Prisma.RoleInclude;

type RoleWithCounts = Prisma.RoleGetPayload<{ include: typeof withCounts }>;
type RoleWithDetail = Prisma.RoleGetPayload<{ include: typeof withDetail }>;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicy,
    private readonly activity: ActivityLogService,
  ) {}

  async list(query: ListRolesQueryDto) {
    const where: Prisma.RoleWhereInput = { deletedAt: null, name: query.search ? { contains: query.search } : undefined };
    const column = query.sort === 'created_at' ? 'createdAt' : 'name';
    const [roles, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        include: withCounts,
        orderBy: [{ [column]: query.order ?? 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.role.count({ where }),
    ]);
    return toPage(roles.map(toRoleDto), total, query);
  }

  async get(id: string) {
    return toRoleDetailDto(await this.findActive(id));
  }

  async create(actor: ActorContext, dto: CreateRoleDto) {
    await this.policy.assertCanGrantPermissions(actor.id, dto.permissions);
    await this.assertNameFree(dto.name);
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: { create: dto.permissions.map((key) => ({ permission: { connect: { key } } })) },
      },
      include: withDetail,
    });
    await this.activity.recordFor(actor, {
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
      metadata: { name: role.name, permissions: dto.permissions },
    });
    return toRoleDetailDto(role);
  }

  async duplicate(actor: ActorContext, id: string, name?: string) {
    const source = await this.findActive(id);
    const keys = source.permissions.map((rp) => rp.permission.key);
    await this.policy.assertCanGrantPermissions(actor.id, keys);
    const copyName = name ?? (await this.nextCopyName(source.name));
    await this.assertNameFree(copyName);

    const role = await this.prisma.role.create({
      data: {
        name: copyName,
        description: source.description,
        permissions: { create: source.permissions.map((rp) => ({ permissionId: rp.permissionId })) },
      },
      include: withDetail,
    });
    await this.activity.recordFor(actor, {
      action: 'role.duplicated',
      entityType: 'role',
      entityId: role.id,
      metadata: { source_id: source.id, source_name: source.name, name: role.name },
    });
    return toRoleDetailDto(role);
  }

  async update(actor: ActorContext, id: string, dto: UpdateRoleDto) {
    const role = await this.findActive(id);
    if (dto.name !== undefined && dto.name !== role.name) {
      if (role.isSystem) throw new ConflictException('A system role cannot be renamed');
      await this.assertNameFree(dto.name, id);
    }
    const updated = await this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: withDetail,
    });
    await this.activity.recordFor(actor, {
      action: 'role.updated',
      entityType: 'role',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return toRoleDetailDto(updated);
  }

  // The permission matrix. Adding or removing a permission requires holding it, so nobody grants more than they have.
  async setPermissions(actor: ActorContext, id: string, keys: string[]) {
    const role = await this.findActive(id);
    if (role.name === SUPER_ADMIN_ROLE) {
      throw new ForbiddenException('The Super Administrator role always holds every permission');
    }
    const current = role.permissions.map((rp) => rp.permission.key);
    const added = keys.filter((key) => !current.includes(key)).sort();
    const removed = current.filter((key) => !keys.includes(key)).sort();
    await this.policy.assertCanGrantPermissions(actor.id, [...added, ...removed]);

    const [, , updated] = await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id, permission: { key: { in: removed } } } }),
      this.prisma.rolePermission.createMany({
        data: (await this.prisma.permission.findMany({ where: { key: { in: added } } })).map((permission) => ({
          roleId: id,
          permissionId: permission.id,
        })),
      }),
      this.prisma.role.findUniqueOrThrow({ where: { id }, include: withDetail }),
    ]);
    await this.activity.recordFor(actor, {
      action: 'role.permissions_changed',
      entityType: 'role',
      entityId: id,
      metadata: { name: role.name, added, removed },
    });
    return toRoleDetailDto(updated);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const role = await this.findActive(id);
    if (role.isSystem) throw new ConflictException('A system role cannot be deleted');
    if (role._count.users > 0) throw new ConflictException('This role is still assigned to users');

    // The name is released so a new role can reuse it; the id keeps the audit trail intact.
    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date(), name: `${role.name} [deleted ${role.id}]` },
    });
    await this.activity.recordFor(actor, { action: 'role.deleted', entityType: 'role', entityId: id, metadata: { name: role.name } });
  }

  private async findActive(id: string): Promise<RoleWithDetail> {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null }, include: withDetail });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const taken = await this.prisma.role.count({ where: { name, id: exceptId ? { not: exceptId } : undefined } });
    if (taken > 0) throw new ConflictException('A role with this name already exists');
  }

  private async nextCopyName(name: string): Promise<string> {
    const base = `${name.slice(0, 40)} (copie`;
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? `${base})` : `${base} ${n})`;
      if ((await this.prisma.role.count({ where: { name: candidate } })) === 0) return candidate;
    }
  }
}

function toRoleDto(role: RoleWithCounts) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    is_system: role.isSystem,
    users_count: role._count.users,
    permissions_count: role._count.permissions,
    created_at: role.createdAt.toISOString(),
    updated_at: role.updatedAt.toISOString(),
  };
}

function toRoleDetailDto(role: RoleWithDetail) {
  return { ...toRoleDto(role), permissions: role.permissions.map((rp) => rp.permission.key).sort() };
}
