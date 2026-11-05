import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { LoginHistoryPageResponse } from '../activity-logs/responses.js';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PageQueryDto, pageArgs, toPage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { LoginOutcome } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Permissions } from '../rbac/permissions.decorator.js';

export class ListLoginHistoryQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({ enum: LoginOutcome }) @IsOptional() @IsEnum(LoginOutcome)
  outcome?: LoginOutcome;

  @ApiPropertyOptional({ description: 'Part of the email typed at login' })
  @IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601()
  to?: string;
}

@Injectable()
export class LoginHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListLoginHistoryQueryDto) {
    const where: Prisma.LoginHistoryWhereInput = {
      userId: query.user_id,
      outcome: query.outcome,
      email: query.email ? { contains: query.email } : undefined,
      createdAt: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loginHistory.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...pageArgs(query) }),
      this.prisma.loginHistory.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      user_id: row.userId,
      email: row.email,
      outcome: row.outcome,
      ip_address: row.ipAddress,
      user_agent: row.userAgent,
      created_at: row.createdAt.toISOString(),
    }));
    return toPage(items, total, query);
  }
}

@ApiTags('login-history')
@ApiBearerAuth()
@Controller('login-history')
export class LoginHistoryController {
  constructor(private readonly history: LoginHistoryService) {}

  @Get()
  @Permissions('login_history.read')
  @ApiOkResponse({ type: LoginHistoryPageResponse })
  list(@Query() query: ListLoginHistoryQueryDto) {
    return this.history.list(query);
  }
}
