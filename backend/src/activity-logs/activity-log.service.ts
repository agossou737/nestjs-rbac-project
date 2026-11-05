import { Injectable } from '@nestjs/common';
import type { ActorContext } from '../common/actor.decorator.js';
import { pageArgs, toPage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListActivityLogsQueryDto } from './dto.js';
import type { ActivityLogResponse } from './responses.js';

export type ActivityEntry = {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

const SECRET_KEY = /pass(word)?|token|secret|hash|authorization|cookie|api[_-]?key/i;

// Append-only: this service only inserts and reads, and no route updates or deletes a log.
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: ActivityEntry): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined,
        ipAddress: entry.ipAddress?.slice(0, 45),
        userAgent: entry.userAgent?.slice(0, 255),
      },
    });
  }

  recordFor(actor: ActorContext, entry: Omit<ActivityEntry, 'actorId' | 'ipAddress' | 'userAgent'>): Promise<void> {
    return this.record({ ...entry, actorId: actor.id, ipAddress: actor.ipAddress, userAgent: actor.userAgent });
  }

  async list(query: ListActivityLogsQueryDto) {
    const where: Prisma.ActivityLogWhereInput = {
      actorId: query.actor_id,
      action: query.action,
      entityType: query.entity_type,
      entityId: query.entity_id,
      createdAt: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return toPage(items.map(toActivityLogDto), total, query);
  }
}

type LogWithActor = Prisma.ActivityLogGetPayload<{
  include: { actor: { select: { id: true; email: true; firstName: true; lastName: true } } };
}>;

export function toActivityLogDto(log: LogWithActor): ActivityLogResponse {
  return {
    id: log.id,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId,
    metadata: log.metadata as Record<string, unknown> | null,
    ip_address: log.ipAddress,
    user_agent: log.userAgent,
    created_at: log.createdAt.toISOString(),
    actor: log.actor
      ? { id: log.actor.id, email: log.actor.email, first_name: log.actor.firstName, last_name: log.actor.lastName }
      : null,
  };
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redact(inner)]),
    );
  }
  return value;
}
