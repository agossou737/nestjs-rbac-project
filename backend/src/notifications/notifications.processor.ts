import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AuthService } from '../auth/auth.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type InvitationJob, NOTIFICATIONS_QUEUE } from './notifications.constants.js';

// The worker: BullMQ calls process() for each job, in the background. A thrown error makes BullMQ retry the job
// later (attempts and backoff are set by NotificationsService); a normal return marks it completed.
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'invitation':
        return this.sendInvitation(job.data as InvitationJob);
      default:
        throw new Error(`Unknown notification job: ${job.name}`);
    }
  }

  private async sendInvitation({ userId }: InvitationJob): Promise<void> {
    // Read at send time: an account deleted or deactivated in between gets nothing.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
      include: { roles: { where: { role: { deletedAt: null } }, include: { role: { select: { name: true } } } } },
    });
    if (!user) {
      this.logger.log(`Invitation skipped: user ${userId} is no longer active`);
      return;
    }
    const resetUrl = await this.auth.createPasswordResetUrl(user.id);
    await this.mail.sendInvitation(user.email, {
      firstName: user.firstName,
      resetUrl,
      roles: user.roles.map((ur) => ur.role.name).sort((a, b) => a.localeCompare(b)),
    });
  }
}
