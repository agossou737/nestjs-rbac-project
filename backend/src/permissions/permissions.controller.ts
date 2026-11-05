import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Permissions } from '../rbac/permissions.decorator.js';

// Read-only catalogue (owned by permission-catalog.ts): small enough to need no pagination.
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.permission.findMany({
      select: { id: true, key: true, module: true, action: true, description: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @Permissions('permissions.read')
  list() {
    return this.permissions.list();
  }
}
