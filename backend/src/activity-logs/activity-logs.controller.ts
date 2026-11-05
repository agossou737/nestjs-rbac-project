import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/permissions.decorator.js';
import { ActivityLogService } from './activity-log.service.js';
import { ListActivityLogsQueryDto } from './dto.js';

@ApiTags('activity-logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly logs: ActivityLogService) {}

  @Get()
  @Permissions('activity_logs.read')
  list(@Query() query: ListActivityLogsQueryDto) {
    return this.logs.list(query);
  }
}
