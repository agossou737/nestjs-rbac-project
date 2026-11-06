import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AuthService } from '../auth/auth.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type InvitationJob, NOTIFICATIONS_QUEUE, type RolesChangedJob } from './notifications.constants.js';

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
      case 'roles-changed':
        return this.sendRolesChanged(job.data as RolesChangedJob);
      default:
        throw new Error(`Unknown notification job: ${job.name}`);
    }
  }

  // Every failed attempt is reported here; only the last one means the e-mail is given up. Ids only in the log.
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.error(`Notification ${job.name} (${job.id}) given up after ${job.attemptsMade} attempts: ${error.message}`);
    }
  }

  private async sendRolesChanged({ userId, addedRoleIds, removedRoleIds }: RolesChangedJob): Promise<void> {
    const user = await this.activeUserWithRoles(userId);
    if (!user) {
      this.logger.log(`Roles change e-mail skipped: user ${userId} is no longer active`);
      return;
    }
    // A role deleted since the change still has its name in the database (soft delete): no deletedAt filter here.
    const names = new Map(
      (await this.prisma.role.findMany({ where: { id: { in: [...addedRoleIds, ...removedRoleIds] } }, select: { id: true, name: true } })).map(
        (role) => [role.id, role.name.replace(/ \[deleted [0-9a-f-]+\]$/, '')] as const,
      ),
    );
    const sorted = (ids: string[]) => ids.flatMap((id) => names.get(id) ?? []).sort((a, b) => a.localeCompare(b));
    await this.mail.sendRolesChanged(user.email, {
      firstName: user.firstName,
      added: sorted(addedRoleIds),
      removed: sorted(removedRoleIds),
      roles: user.roles.map((ur) => ur.role.name).sort((a, b) => a.localeCompare(b)),
    });
  }

  private activeUserWithRoles(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
      include: { roles: { where: { role: { deletedAt: null } }, include: { role: { select: { name: true } } } } },
    });
  }

  private async sendInvitation({ userId }: InvitationJob): Promise<void> {
    // Read at send time: an account deleted or deactivated in between gets nothing.
    const user = await this.activeUserWithRoles(userId);
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
