import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activityLogsApi,
  authApi,
  dashboardApi,
  loginHistoryApi,
  permissionsApi,
  rolesApi,
  usersApi,
  type ActivityLogQuery,
  type LoginHistoryQuery,
  type RoleListQuery,
  type UserListQuery,
} from "./endpoints";

// Query keys grouped per resource (FE-2): invalidating ["users"] refreshes every list and detail of users.
export const queryKeys = {
  me: ["auth", "me"] as const,
  users: (query?: UserListQuery) => ["users", "list", query] as const,
  user: (id: string) => ["users", "detail", id] as const,
  roles: (query?: RoleListQuery) => ["roles", "list", query] as const,
  role: (id: string) => ["roles", "detail", id] as const,
  permissions: ["permissions"] as const,
  activityLogs: (query: ActivityLogQuery) => ["activity-logs", query] as const,
  loginHistory: (query: LoginHistoryQuery) => ["login-history", query] as const,
  dashboard: ["dashboard"] as const,
};

export const useMe = (enabled: boolean) => useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, enabled, staleTime: 60_000 });

export const useUsers = (query: UserListQuery) =>
  useQuery({ queryKey: queryKeys.users(query), queryFn: () => usersApi.list(query), placeholderData: keepPreviousData });
export const useUser = (id: string) => useQuery({ queryKey: queryKeys.user(id), queryFn: () => usersApi.get(id) });

export const useRoles = (query: RoleListQuery) =>
  useQuery({ queryKey: queryKeys.roles(query), queryFn: () => rolesApi.list(query), placeholderData: keepPreviousData });
export const useRole = (id: string) => useQuery({ queryKey: queryKeys.role(id), queryFn: () => rolesApi.get(id) });

// The catalogue changes only with a deployment: cached for the session.
export const usePermissions = () =>
  useQuery({ queryKey: queryKeys.permissions, queryFn: permissionsApi.list, staleTime: Infinity });

export const useActivityLogs = (query: ActivityLogQuery) =>
  useQuery({ queryKey: queryKeys.activityLogs(query), queryFn: () => activityLogsApi.list(query), placeholderData: keepPreviousData });

export const useLoginHistory = (query: LoginHistoryQuery) =>
  useQuery({ queryKey: queryKeys.loginHistory(query), queryFn: () => loginHistoryApi.list(query), placeholderData: keepPreviousData });

export const useDashboard = () => useQuery({ queryKey: queryKeys.dashboard, queryFn: dashboardApi.get });

// Every write can change counts shown elsewhere (dashboard, role counts, logs): refresh what it touches.
function useInvalidating<A extends unknown[], R>(fn: (...args: A) => Promise<R>, roots: string[][]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => fn(...args),
    onSuccess: () => Promise.all(roots.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

const afterUserWrite = [["users"], ["roles"], ["dashboard"], ["activity-logs"]];
const afterRoleWrite = [["roles"], ["users"], ["dashboard"], ["activity-logs"], ["auth", "me"]];

export const useCreateUser = () => useInvalidating(usersApi.create, afterUserWrite);
export const useUpdateUser = () => useInvalidating(usersApi.update, afterUserWrite);
export const useSetUserStatus = () => useInvalidating(usersApi.setStatus, afterUserWrite);
export const useSetUserRoles = () => useInvalidating(usersApi.setRoles, afterUserWrite);
export const useResetUserPassword = () => useInvalidating(usersApi.resetPassword, [["activity-logs"]]);
export const useDeleteUser = () => useInvalidating(usersApi.remove, afterUserWrite);

export const useCreateRole = () => useInvalidating(rolesApi.create, afterRoleWrite);
export const useDuplicateRole = () => useInvalidating(rolesApi.duplicate, afterRoleWrite);
export const useUpdateRole = () => useInvalidating(rolesApi.update, afterRoleWrite);
export const useSetRolePermissions = () => useInvalidating(rolesApi.setPermissions, afterRoleWrite);
export const useDeleteRole = () => useInvalidating(rolesApi.remove, afterRoleWrite);
