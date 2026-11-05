import { ALL_PERMISSION_KEYS, PERMISSIONS, SUPER_ADMIN_ROLE, SYSTEM_ROLES, isPermissionKey } from './permission-catalog.js';

describe('permission catalogue', () => {
  it('uses unique module.action keys in snake_case', () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(PERMISSIONS.length);
    for (const key of ALL_PERMISSION_KEYS) expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });

  it('gives every permission to the Super Administrator and keeps role definitions within the catalogue', () => {
    const superAdmin = SYSTEM_ROLES.find((role) => role.name === SUPER_ADMIN_ROLE)!;
    expect([...superAdmin.permissions].sort()).toEqual([...ALL_PERMISSION_KEYS].sort());
    for (const role of SYSTEM_ROLES) {
      expect(new Set(role.permissions).size).toBe(role.permissions.length);
      for (const key of role.permissions) expect(isPermissionKey(key)).toBe(true);
    }
  });

  it('keeps roles.delete for the Super Administrator only, and read-only roles free of any write', () => {
    const holders = SYSTEM_ROLES.filter((role) => role.permissions.includes('roles.delete')).map((role) => role.name);
    expect(holders).toEqual([SUPER_ADMIN_ROLE]);
    for (const name of ['Viewer', 'Auditor']) {
      const role = SYSTEM_ROLES.find((r) => r.name === name)!;
      expect(role.permissions.every((key) => key.endsWith('.read'))).toBe(true);
    }
  });

  it('recognises only catalogue keys', () => {
    expect(isPermissionKey('users.read')).toBe(true);
    expect(isPermissionKey('users.fly')).toBe(false);
    expect(isPermissionKey('')).toBe(false);
  });
});
