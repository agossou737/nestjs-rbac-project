import type { PermissionKey } from '../rbac/permission-catalog.js';

export class RoleResponse {
  id!: string;
  name!: string;
  description!: string | null;
  is_system!: boolean;
  users_count!: number;
  permissions_count!: number;
  created_at!: string;
  updated_at!: string;
}

export class RoleDetailResponse extends RoleResponse {
  /** Permission keys (module.action), sorted. */
  permissions!: PermissionKey[];
}

export class RolePageResponse {
  items!: RoleResponse[];
  total!: number;
  page!: number;
  page_size!: number;
}

export class PermissionResponse {
  id!: string;
  key!: PermissionKey;
  module!: string;
  action!: string;
  description!: string | null;
}
