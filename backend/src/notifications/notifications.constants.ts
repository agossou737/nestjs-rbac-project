export const NOTIFICATIONS_QUEUE = 'notifications';

// Job names of the notifications queue, and their payloads. Payloads carry ids only: the processor reads fresh data
// (and creates the reset token) when it runs, so neither personal data nor secrets wait in Redis.
export type InvitationJob = { userId: string };
// The change itself cannot be read back later, so the job keeps it, as role ids (no names, no personal data).
export type RolesChangedJob = { userId: string; addedRoleIds: string[]; removedRoleIds: string[] };

// Domain events published with EventEmitter2. The producer does not know who listens.
export const USER_CREATED = 'user.created';

export class UserCreatedEvent {
  constructor(readonly userId: string) {}
}

export const USER_ROLES_CHANGED = 'user.roles_changed';

export class UserRolesChangedEvent {
  constructor(
    readonly userId: string,
    readonly addedRoleIds: string[],
    readonly removedRoleIds: string[],
    // Identifies this change: the job id derives from it, so a change is notified once, and two changes twice.
    readonly changeId: string,
  ) {}
}
