export const NOTIFICATIONS_QUEUE = 'notifications';

// Job names of the notifications queue, and their payloads. Payloads carry ids only: the processor reads fresh data
// (and creates the reset token) when it runs, so neither personal data nor secrets wait in Redis.
export type InvitationJob = { userId: string };

// Domain events published with EventEmitter2. The producer does not know who listens.
export const USER_CREATED = 'user.created';

export class UserCreatedEvent {
  constructor(readonly userId: string) {}
}
