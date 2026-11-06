import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLogService } from '../activity-logs/activity-log.service.js';
import type { ActorContext } from '../common/actor.decorator.js';
import { pageArgs, toPage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './dto.js';
import type { DepartmentResponse } from './responses.js';

// One include for every read: the manager (to show who leads it) and the count of live members.
const withDetails = {
  manager: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
  _count: { select: { members: { where: { deletedAt: null } } } },
} satisfies Prisma.DepartmentInclude;

type DepartmentWithDetails = Prisma.DepartmentGetPayload<{ include: typeof withDetails }>;

const SORT_COLUMN = { name: 'name', code: 'code', created_at: 'createdAt' } as const;

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(query: ListDepartmentsQueryDto) {
    const where: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      OR: query.search ? [{ code: { contains: query.search } }, { name: { contains: query.search } }] : undefined,
    };
    const column = SORT_COLUMN[query.sort ?? 'name'];
    const [departments, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        include: withDetails,
        orderBy: [{ [column]: query.order ?? 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.department.count({ where }),
    ]);
    return toPage(departments.map(toDepartmentDto), total, query);
  }

  async get(id: string): Promise<DepartmentResponse> {
    return toDepartmentDto(await this.findActive(id));
  }

  async create(actor: ActorContext, dto: CreateDepartmentDto): Promise<DepartmentResponse> {
    await this.assertUnique(dto.code, dto.name);
    if (dto.manager_id) await this.assertActiveUser(dto.manager_id);

    const department = await this.prisma.department.create({
      data: { code: dto.code, name: dto.name, description: dto.description, managerId: dto.manager_id ?? null },
      include: withDetails,
    });
    await this.activity.recordFor(actor, {
      action: 'department.created',
      entityType: 'department',
      entityId: department.id,
      metadata: { code: department.code, name: department.name },
    });
    return toDepartmentDto(department);
  }

  async update(actor: ActorContext, id: string, dto: UpdateDepartmentDto): Promise<DepartmentResponse> {
    await this.findActive(id);
    await this.assertUnique(dto.code, dto.name, id);
    if (dto.manager_id) await this.assertActiveUser(dto.manager_id);

    const department = await this.prisma.department.update({
      where: { id },
      data: { code: dto.code, name: dto.name, description: dto.description, managerId: dto.manager_id },
      include: withDetails,
    });
    await this.activity.recordFor(actor, {
      action: 'department.updated',
      entityType: 'department',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return toDepartmentDto(department);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const department = await this.findActive(id);
    if (department._count.members > 0) throw new ConflictException('This department still has members');

    // Code and name are released so a new department can reuse them; the id keeps the audit trail.
    await this.prisma.department.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        code: `${department.code} [deleted ${id}]`,
        name: `${department.name} [deleted ${id}]`,
        managerId: null,
      },
    });
    await this.activity.recordFor(actor, {
      action: 'department.deleted',
      entityType: 'department',
      entityId: id,
      metadata: { code: department.code, name: department.name },
    });
  }

  // Used by UsersService before attaching an account to a department.
  async assertActive(id: string): Promise<void> {
    await this.findActive(id);
  }

  private async findActive(id: string): Promise<DepartmentWithDetails> {
    const department = await this.prisma.department.findFirst({ where: { id, deletedAt: null }, include: withDetails });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  // The unique indexes would answer 409 too (ProblemDetailsFilter maps P2002); checking first gives a precise message.
  private async assertUnique(code?: string, name?: string, exceptId?: string): Promise<void> {
    const or = [...(code ? [{ code }] : []), ...(name ? [{ name }] : [])];
    if (or.length === 0) return;
    const taken = await this.prisma.department.count({ where: { OR: or, id: exceptId ? { not: exceptId } : undefined } });
    if (taken > 0) throw new ConflictException('A department with this code or name already exists');
  }

  private async assertActiveUser(id: string): Promise<void> {
    const user = await this.prisma.user.count({ where: { id, deletedAt: null } });
    if (user === 0) throw new NotFoundException('Manager account not found');
  }
}

export function toDepartmentDto(department: DepartmentWithDetails): DepartmentResponse {
  const manager = department.manager && !department.manager.deletedAt ? department.manager : null;
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    description: department.description,
    manager: manager
      ? { id: manager.id, email: manager.email, first_name: manager.firstName, last_name: manager.lastName }
      : null,
    users_count: department._count.members,
    created_at: department.createdAt.toISOString(),
    updated_at: department.updatedAt.toISOString(),
  };
}
