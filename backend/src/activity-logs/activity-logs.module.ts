import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service.js';
import { ActivityLogsController } from './activity-logs.controller.js';

@Global()
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogsModule {}
