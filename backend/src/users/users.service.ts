import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLogService } from '../activity-logs/activity-log.service.js';
import { AuthService } from '../auth/auth.service.js';
import { generateOpaqueToken } from '../auth/opaque-token.js';
import { hashPassword } from '../auth/passwords.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';
import type { ActorContext } from '../common/actor.decorator.js';
import { pageArgs, toPage } from '../common/pagination.js';
import type { Prisma, UserStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DepartmentsService } from '../departments/departments.service.js';
import { AccessPolicy } from '../rbac/access-policy.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto.js';
import type { UserResponse } from './responses.js';

const withRoles = {
  roles: { where: { role: { deletedAt: null } }, include: { role: { select: { id: true, name: true } } } },
  department: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof withRoles }>;

const SORT_COLUMN = {
  created_at: 'createdAt',
  email: 'email',
  last_name: 'lastName',
  last_login_at: 'lastLoginAt',
  status: 'status',
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicy,
    private readonly rbac: RbacService,
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly activity: ActivityLogService,
    private readonly departments: DepartmentsService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: query.status,
      roles: query.role_id ? { some: { roleId: query.role_id } } : undefined,
      departmentId: query.department_id,
      OR: query.search
        ? [
            { email: { contains: query.search } },
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
          ]
        : undefined,
    };
    const column = SORT_COLUMN[query.sort ?? 'created_at'];
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: withRoles,
        orderBy: [{ [column]: query.order ?? (query.sort ? 'asc' : 'desc') }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(users.map(toUserDto), total, query);
  }

  async get(id: string) {
    return toUserDto(await this.findActive(id));
  }

  async create(actor: ActorContext, dto: CreateUserDto) {
    const roles = await this.policy.assertCanAssignRoleIds(actor.id, dto.role_ids ?? []);
    await this.assertEmailFree(dto.email);
    if (dto.department_id) await this.departments.assertActive(dto.department_id);

    // The random password is never shown nor sent: the account owner sets theirs through the invitation link.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.first_name,
        lastName: dto.last_name,
        passwordHash: await hashPassword(generateOpaqueToken()),
        departmentId: dto.department_id,
        roles: { create: roles.map((role) => ({ roleId: role.id, assignedById: actor.id })) },
      },
      include: withRoles,
    });
    await this.auth.issuePasswordReset(user);
    await this.activity.recordFor(actor, {
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { roles: roles.map((role) => role.name) },
    });
    return toUserDto(user);
  }

  async update(actor: ActorContext, id: string, dto: UpdateUserDto) {
    await this.policy.assertCanManageUser(actor.id, id, { allowSelf: true });
    const before = await this.findActive(id);
    if (dto.email) await this.assertEmailFree(dto.email, id);
    if (dto.department_id) await this.departments.assertActive(dto.department_id);
    const emailChanged = dto.email !== undefined && dto.email !== before.email;

    const user = await this.prisma.user.update({
      where: { id },
      data: { email: dto.email, firstName: dto.first_name, lastName: dto.last_name, departmentId: dto.department_id },
      include: withRoles,
    });
    // The email is where reset links go: a change closes the open sessions and voids the links sent to the old address.
    if (emailChanged) {
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: id, usedAt: null } });
      await this.refreshTokens.revokeAllForUser(id);
    }
    await this.activity.recordFor(actor, {
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return toUserDto(user);
  }

  async setStatus(actor: ActorContext, id: string, status: UserStatus) {
    await this.policy.assertCanManageUser(actor.id, id);
    const before = await this.findActive(id);
    if (status !== 'ACTIVE' && (await this.rbac.isSuperAdmin(id))) await this.policy.assertSuperAdminRemains(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: status === 'ACTIVE' ? { status, failedLoginCount: 0, lockedUntil: null } : { status },
      include: withRoles,
    });
    if (status !== 'ACTIVE') await this.refreshTokens.revokeAllForUser(id);
    await this.activity.recordFor(actor, {
      action: 'user.status_changed',
      entityType: 'user',
      entityId: id,
      metadata: { from: before.status, to: status },
    });
    return toUserDto(user);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.policy.assertCanManageUser(actor.id, id);
    if (await this.rbac.isSuperAdmin(id)) await this.policy.assertSuperAdminRemains(id);

    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.refreshTokens.revokeAllForUser(id);
    await this.activity.recordFor(actor, { action: 'user.deleted', entityType: 'user', entityId: id });
  }

  async requestPasswordReset(actor: ActorContext, id: string): Promise<void> {
    await this.policy.assertCanManageUser(actor.id, id);
    await this.auth.issuePasswordReset(await this.findActive(id));
    await this.activity.recordFor(actor, { action: 'user.password_reset_requested', entityType: 'user', entityId: id });
  }

  async setRoles(actor: ActorContext, id: string, roleIds: string[]) {
    const current = (await this.findActive(id)).roles.map((ur) => ur.role);
    const wanted = new Set(roleIds);
    const added = roleIds.filter((roleId) => !current.some((role) => role.id === roleId));
    const removed = current.filter((role) => !wanted.has(role.id)).map((role) => role.id);
    await this.policy.assertCanAssignRoles(actor.id, id, added, removed);

    const [, , user] = await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id, roleId: { in: removed } } }),
      this.prisma.userRole.createMany({ data: added.map((roleId) => ({ userId: id, roleId, assignedById: actor.id })) }),
      this.prisma.user.findUniqueOrThrow({ where: { id }, include: withRoles }),
    ]);
    const names = new Map([...user.roles.map((ur) => ur.role), ...current].map((role) => [role.id, role.name] as const));
    await this.activity.recordFor(actor, {
      action: 'user.roles_changed',
      entityType: 'user',
      entityId: id,
      metadata: { added: added.map((roleId) => names.get(roleId)), removed: removed.map((roleId) => names.get(roleId)) },
    });
    return toUserDto(user);
  }

  private async findActive(id: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: withRoles });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Deleted accounts keep their email (data-model.md), so the check covers them too.
  private async assertEmailFree(email: string, exceptId?: string): Promise<void> {
    const taken = await this.prisma.user.count({ where: { email, id: exceptId ? { not: exceptId } : undefined } });
    if (taken > 0) throw new ConflictException('This email is already used by another account');
  }
}

export function toUserDto(user: UserWithRoles): UserResponse {
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    status: user.status,
    locked_until: user.lockedUntil?.toISOString() ?? null,
    last_login_at: user.lastLoginAt?.toISOString() ?? null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
    roles: user.roles.map((ur) => ({ id: ur.role.id, name: ur.role.name })).sort((a, b) => a.name.localeCompare(b.name)),
    department: user.department,
  };
}
