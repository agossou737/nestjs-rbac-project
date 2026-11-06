import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { NOTIFICATIONS_QUEUE } from './notifications.constants.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NotificationsService } from './notifications.service.js';
import { UserEventsListener } from './user-events.listener.js';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }), AuthModule, MailModule],
  providers: [NotificationsService, NotificationsProcessor, UserEventsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
