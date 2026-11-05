import { http } from "./client";
import type { components, operations } from "./schema";

type S = components["schemas"];
type Query<Op extends keyof operations> = NonNullable<operations[Op]["parameters"]["query"]>;

export type UserListQuery = Query<"UsersController_list">;
export type RoleListQuery = Query<"RolesController_list">;
export type ActivityLogQuery = Query<"ActivityLogsController_list">;
export type LoginHistoryQuery = Query<"LoginHistoryController_list">;
export type UserStatus = S["UserResponse"]["status"];

const data = <T,>(promise: Promise<{ data: T }>) => promise.then((res) => res.data);

export const authApi = {
  login: (body: S["LoginDto"]) => data(http.post<S["TokenResponseDto"]>("/auth/login", body)),
  logout: () => http.post("/auth/logout").then(() => undefined),
  me: () => data(http.get<S["MeDto"]>("/auth/me")),
  forgotPassword: (body: S["ForgotPasswordDto"]) => data(http.post<S["MessageDto"]>("/auth/forgot-password", body)),
  resetPassword: (body: S["ResetPasswordDto"]) => http.post("/auth/reset-password", body).then(() => undefined),
};

export const usersApi = {
  list: (params: UserListQuery) => data(http.get<S["UserPageResponse"]>("/users", { params })),
  get: (id: string) => data(http.get<S["UserResponse"]>(`/users/${id}`)),
  create: (body: S["CreateUserDto"]) => data(http.post<S["UserResponse"]>("/users", body)),
  update: (id: string, body: S["UpdateUserDto"]) => data(http.patch<S["UserResponse"]>(`/users/${id}`, body)),
  setStatus: (id: string, status: UserStatus) => data(http.patch<S["UserResponse"]>(`/users/${id}/status`, { status })),
  setRoles: (id: string, roleIds: string[]) => data(http.put<S["UserResponse"]>(`/users/${id}/roles`, { role_ids: roleIds })),
  resetPassword: (id: string) => http.post(`/users/${id}/reset-password`).then(() => undefined),
  remove: (id: string) => http.delete(`/users/${id}`).then(() => undefined),
};

export const rolesApi = {
  list: (params: RoleListQuery) => data(http.get<S["RolePageResponse"]>("/roles", { params })),
  get: (id: string) => data(http.get<S["RoleDetailResponse"]>(`/roles/${id}`)),
  create: (body: S["CreateRoleDto"]) => data(http.post<S["RoleDetailResponse"]>("/roles", body)),
  duplicate: (id: string, body: S["DuplicateRoleDto"] = {}) => data(http.post<S["RoleDetailResponse"]>(`/roles/${id}/duplicate`, body)),
  update: (id: string, body: S["UpdateRoleDto"]) => data(http.patch<S["RoleDetailResponse"]>(`/roles/${id}`, body)),
  setPermissions: (id: string, permissions: S["PermissionKeysDto"]["permissions"]) =>
    data(http.put<S["RoleDetailResponse"]>(`/roles/${id}/permissions`, { permissions })),
  remove: (id: string) => http.delete(`/roles/${id}`).then(() => undefined),
};

export const permissionsApi = {
  list: () => data(http.get<S["PermissionResponse"][]>("/permissions")),
};

export const activityLogsApi = {
  list: (params: ActivityLogQuery) => data(http.get<S["ActivityLogPageResponse"]>("/activity-logs", { params })),
};

export const loginHistoryApi = {
  list: (params: LoginHistoryQuery) => data(http.get<S["LoginHistoryPageResponse"]>("/login-history", { params })),
};

export const dashboardApi = {
  get: () => data(http.get<S["DashboardResponse"]>("/dashboard")),
};
