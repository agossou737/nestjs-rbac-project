import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission-catalog.js';

export const PERMISSIONS_KEY = 'permissions';
export const AUTHENTICATED_KEY = 'authenticatedOnly';

export type PermissionRequirement = { mode: 'all' | 'any'; keys: PermissionKey[] };

const requirePermissions = (mode: PermissionRequirement['mode'], keys: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, { mode, keys } satisfies PermissionRequirement);

/**
 * Route permissions, checked by PermissionsGuard against roles read from the database on each request.
 * - `@Permissions('users.read', 'users.update')`: the user needs every listed permission (AND).
 * - `@Permissions.anyOf('activity_logs.read', 'login_history.read')`: one of them is enough (OR).
 * A route with neither, nor `@Public()` or `@Authenticated()`, is refused to everyone (deny by default).
 */
export const Permissions = Object.assign(
  (...keys: [PermissionKey, ...PermissionKey[]]) => requirePermissions('all', keys),
  { anyOf: (...keys: [PermissionKey, PermissionKey, ...PermissionKey[]]) => requirePermissions('any', keys) },
);

// For routes every signed-in user may call whatever their roles (GET /auth/me).
export const Authenticated = () => SetMetadata(AUTHENTICATED_KEY, true);
