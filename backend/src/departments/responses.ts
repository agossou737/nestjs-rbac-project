export class DepartmentManagerResponse {
  id!: string;
  email!: string;
  first_name!: string;
  last_name!: string;
}

export class DepartmentResponse {
  id!: string;
  /** @example DSI */
  code!: string;
  name!: string;
  description!: string | null;
  /** Null when no manager is set or the manager account was deleted. */
  manager!: DepartmentManagerResponse | null;
  /** Live (non-deleted) accounts attached to the department. */
  users_count!: number;
  created_at!: string;
  updated_at!: string;
}

export class DepartmentPageResponse {
  items!: DepartmentResponse[];
  total!: number;
  page!: number;
  page_size!: number;
}

export class DepartmentRefResponse {
  id!: string;
  code!: string;
  name!: string;
}
