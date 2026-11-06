import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { USER_CREATED, USER_ROLES_CHANGED, UserCreatedEvent, UserRolesChangedEvent } from './notifications.constants.js';
import { NotificationsService } from './notifications.service.js';

// Turns domain events into queued jobs. UsersService only announces "an account was created"; deciding that this
// means an e-mail, and how to send it reliably, belongs here.
@Injectable()
export class UserEventsListener {
  private readonly logger = new Logger(UserEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  // async: the listener runs after the emitting request has moved on; an error here must not fail the creation.
  @OnEvent(USER_CREATED, { async: true })
  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    try {
      await this.notifications.queueInvitation(event.userId);
    } catch (error) {
      // The account exists without its invitation: an administrator can resend a link from its page.
      this.logger.error(`Invitation could not be queued for user ${event.userId}: ${(error as Error).message}`);
    }
  }

  @OnEvent(USER_ROLES_CHANGED, { async: true })
  async onUserRolesChanged(event: UserRolesChangedEvent): Promise<void> {
    try {
      await this.notifications.queueRolesChanged(event);
    } catch (error) {
      // The change is applied and in the activity log; only the courtesy e-mail is lost.
      this.logger.error(`Roles change e-mail could not be queued for user ${event.userId}: ${(error as Error).message}`);
    }
  }
}
