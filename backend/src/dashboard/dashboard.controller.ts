import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { toActivityLogDto } from '../activity-logs/activity-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Permissions } from '../rbac/permissions.decorator.js';

const DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const since = new Date(startOfUtcDay(new Date()).getTime() - (DAYS - 1) * DAY_MS);
    const [byStatus, rolesTotal, permissionsTotal, loginRows, roles, recent] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.role.count({ where: { deletedAt: null } }),
      this.prisma.permission.count(),
      this.prisma.$queryRaw<{ day: Date; success: unknown; failure: unknown }[]>`
        SELECT DATE(created_at) AS day,
               SUM(outcome = 'SUCCESS') AS success,
               SUM(outcome <> 'SUCCESS') AS failure
        FROM login_history
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)`,
      this.prisma.role.findMany({
        where: { deletedAt: null },
        select: { name: true, _count: { select: { users: { where: { user: { deletedAt: null } } } } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.activityLog.findMany({
        include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const perDay = new Map(loginRows.map((row) => [isoDay(new Date(row.day)), row]));
    return {
      users: {
        total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        active: count('ACTIVE'),
        inactive: count('INACTIVE'),
        locked: count('LOCKED'),
      },
      roles_total: rolesTotal,
      permissions_total: permissionsTotal,
      // One entry per day, oldest first, days without any login included as zero.
      logins_by_day: Array.from({ length: DAYS }, (_, i) => {
        const date = isoDay(new Date(since.getTime() + i * DAY_MS));
        const row = perDay.get(date);
        return { date, success: Number(row?.success ?? 0), failure: Number(row?.failure ?? 0) };
      }),
      users_by_role: roles.map((role) => ({ role: role.name, count: role._count.users })),
      recent_activity: recent.map(toActivityLogDto),
    };
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Permissions('dashboard.read')
  stats() {
    return this.dashboard.stats();
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
