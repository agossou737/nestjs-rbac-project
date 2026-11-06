import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { type InvitationJob, NOTIFICATIONS_QUEUE, type RolesChangedJob, type UserRolesChangedEvent } from './notifications.constants.js';

const DAY_SECONDS = 24 * 60 * 60;

// The only place that puts jobs in the notifications queue: retry policy and retention are decided here, once.
@Injectable()
export class NotificationsService {
  private readonly retryDelayMs: number;

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.retryDelayMs = config.getOrThrow<number>('NOTIFICATION_RETRY_DELAY_MS');
  }

  async queueInvitation(userId: string): Promise<void> {
    const data: InvitationJob = { userId };
    // A fixed id makes the job idempotent: a second add for the same account is ignored while the first is kept.
    await this.queue.add('invitation', data, this.options(`invitation-${userId}`));
  }

  async queueRolesChanged(event: UserRolesChangedEvent): Promise<void> {
    const data: RolesChangedJob = { userId: event.userId, addedRoleIds: event.addedRoleIds, removedRoleIds: event.removedRoleIds };
    await this.queue.add('roles-changed', data, this.options(`roles-changed-${event.changeId}`));
  }

  private options(jobId: string) {
    return {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: this.retryDelayMs },
      removeOnComplete: { age: DAY_SECONDS },
      removeOnFail: { age: 7 * DAY_SECONDS },
    };
  }
}
