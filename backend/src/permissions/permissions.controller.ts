import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PermissionResponse } from '../roles/responses.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPermissionKey } from '../rbac/permission-catalog.js';
import { Permissions } from '../rbac/permissions.decorator.js';

// Read-only catalogue (owned by permission-catalog.ts): small enough to need no pagination.
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PermissionResponse[]> {
    const rows = await this.prisma.permission.findMany({
      select: { id: true, key: true, module: true, action: true, description: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
    return rows.flatMap((row) => (isPermissionKey(row.key) ? [{ ...row, key: row.key }] : []));
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @Permissions('permissions.read')
  @ApiOkResponse({ type: [PermissionResponse] })
  list() {
    return this.permissions.list();
  }
}
