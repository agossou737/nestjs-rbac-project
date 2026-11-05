import type { LoginOutcome } from '../generated/prisma/enums.js';

export class ActorResponse {
  id!: string;
  email!: string;
  first_name!: string;
  last_name!: string;
}

export class ActivityLogResponse {
  id!: string;
  /** @example user.roles_changed */
  action!: string;
  entity_type!: string;
  entity_id!: string | null;
  /** Free-form details, secrets already redacted. */
  metadata!: Record<string, unknown> | null;
  ip_address!: string | null;
  user_agent!: string | null;
  created_at!: string;
  actor!: ActorResponse | null;
}

export class ActivityLogPageResponse {
  items!: ActivityLogResponse[];
  total!: number;
  page!: number;
  page_size!: number;
}

export class LoginHistoryResponse {
  id!: string;
  user_id!: string | null;
  email!: string;
  outcome!: LoginOutcome;
  ip_address!: string | null;
  user_agent!: string | null;
  created_at!: string;
}

export class LoginHistoryPageResponse {
  items!: LoginHistoryResponse[];
  total!: number;
  page!: number;
  page_size!: number;
}

export class UserCountsResponse {
  total!: number;
  active!: number;
  inactive!: number;
  locked!: number;
}

export class LoginsByDayResponse {
  /** @example 2026-11-05 */
  date!: string;
  success!: number;
  failure!: number;
}

export class UsersByRoleResponse {
  role!: string;
  count!: number;
}

export class DashboardResponse {
  users!: UserCountsResponse;
  roles_total!: number;
  permissions_total!: number;
  logins_by_day!: LoginsByDayResponse[];
  users_by_role!: UsersByRoleResponse[];
  recent_activity!: ActivityLogResponse[];
}
