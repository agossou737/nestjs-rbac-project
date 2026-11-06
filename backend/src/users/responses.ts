// Response contracts, documented in OpenAPI by the @nestjs/swagger CLI plugin (nest-cli.json); the frontend types derive from them.
import { DepartmentRefResponse } from '../departments/responses.js';
import type { UserStatus } from '../generated/prisma/enums.js';

export class RoleRefResponse {
  id!: string;
  name!: string;
}

export class UserResponse {
  id!: string;
  email!: string;
  first_name!: string;
  last_name!: string;
  /** @example ACTIVE */
  status!: UserStatus;
  locked_until!: string | null;
  last_login_at!: string | null;
  created_at!: string;
  updated_at!: string;
  roles!: RoleRefResponse[];
  department!: DepartmentRefResponse | null;
}

export class UserPageResponse {
  items!: UserResponse[];
  total!: number;
  page!: number;
  page_size!: number;
}
