import type { components } from "./schema";

type S = components["schemas"];

export type Me = S["MeDto"];
export type User = S["UserResponse"];
export type Role = S["RoleResponse"];
export type RoleDetail = S["RoleDetailResponse"];
export type Permission = S["PermissionResponse"];
export type PermissionKey = S["PermissionResponse"]["key"];
export type ActivityLog = S["ActivityLogResponse"];
export type LoginAttempt = S["LoginHistoryResponse"];
export type Dashboard = S["DashboardResponse"];
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

type Person = { first_name: string; last_name: string };

// View-model helpers: screens show names and initials, the API sends the parts.
export const fullName = (person: Person) => `${person.first_name} ${person.last_name}`.trim();
export const initials = (person: Person) => `${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase();

export type PermissionModule = { module: string; permissions: Permission[] };

// Modules in the order of the navigation; a module added later goes last rather than disappearing.
const MODULE_ORDER = ["dashboard", "users", "roles", "permissions", "activity_logs", "login_history"];
const rank = (module: string) => (MODULE_ORDER.indexOf(module) + 1 || MODULE_ORDER.length + 1);

// The matrix rows: one module per row, its actions as columns.
export function groupByModule(permissions: Permission[]): PermissionModule[] {
  const modules = new Map<string, Permission[]>();
  for (const permission of permissions) {
    modules.set(permission.module, [...(modules.get(permission.module) ?? []), permission]);
  }
  return [...modules].map(([module, items]) => ({ module, permissions: items })).sort((a, b) => rank(a.module) - rank(b.module));
}
