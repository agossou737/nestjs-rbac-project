import * as argon2 from 'argon2';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDatabase, type SeedEnv } from '../prisma/seed-database.js';
import { PERMISSIONS, SUPER_ADMIN_ROLE, SYSTEM_ROLES } from '../src/rbac/permission-catalog.js';
import { resetDatabase } from './utils/reset-database.js';

const password = 'Correct-Horse-42!';
const env: SeedEnv = {
  SEED_SUPER_ADMIN_EMAIL: 'Root.Admin@Example.test',
  SEED_SUPER_ADMIN_PASSWORD: password,
  SEED_SUPER_ADMIN_FIRST_NAME: 'Root',
  SEED_SUPER_ADMIN_LAST_NAME: 'Admin',
};

describe('seedDatabase', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient(process.env.DATABASE_URL!);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates every catalogue permission split into module and action', async () => {
    await seedDatabase(prisma, env);

    const permissions = await prisma.permission.findMany();
    expect(permissions.map((p) => p.key).sort()).toEqual(PERMISSIONS.map((p) => p.key).sort());
    for (const permission of permissions) {
      expect(`${permission.module}.${permission.action}`).toBe(permission.key);
    }
  });

  it('creates the six system roles with their permissions', async () => {
    await seedDatabase(prisma, env);

    const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } } });
    expect(roles.map((r) => r.name).sort()).toEqual(
      [
        'Administrator',
        'Auditor',
        'Editor',
        'Manager',
        'Super Administrator',
        'Viewer',
      ].sort(),
    );
    expect(roles.every((r) => r.isSystem)).toBe(true);

    for (const definition of SYSTEM_ROLES) {
      const role = roles.find((r) => r.name === definition.name)!;
      expect(role.permissions.map((rp) => rp.permission.key).sort()).toEqual([...definition.permissions].sort());
    }

    const superAdmin = roles.find((r) => r.name === SUPER_ADMIN_ROLE)!;
    expect(superAdmin.permissions).toHaveLength(PERMISSIONS.length);
  });

  it('creates the super admin from the environment with an argon2id hash', async () => {
    await seedDatabase(prisma, env);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'root.admin@example.test' },
      include: { roles: { include: { role: true } } },
    });
    expect(user.status).toBe('ACTIVE');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(password);
    expect(await argon2.verify(user.passwordHash, password)).toBe(true);
    expect(user.roles.map((ur) => ur.role.name)).toEqual([SUPER_ADMIN_ROLE]);
  });

  it('is idempotent and never overwrites an existing super admin password', async () => {
    await seedDatabase(prisma, env);
    const first = await prisma.user.findUniqueOrThrow({ where: { email: 'root.admin@example.test' } });

    await seedDatabase(prisma, { ...env, SEED_SUPER_ADMIN_PASSWORD: 'Another-Secret-77!' });

    const second = await prisma.user.findUniqueOrThrow({ where: { email: 'root.admin@example.test' } });
    expect(second.passwordHash).toBe(first.passwordHash);
    expect(await prisma.permission.count()).toBe(PERMISSIONS.length);
    expect(await prisma.role.count()).toBe(SYSTEM_ROLES.length);
    expect(await prisma.userRole.count()).toBe(1);
    expect(await prisma.rolePermission.count()).toBe(
      SYSTEM_ROLES.reduce((total, role) => total + role.permissions.length, 0),
    );
  });

  it.each([
    ['missing email', { SEED_SUPER_ADMIN_EMAIL: '' }],
    ['invalid email', { SEED_SUPER_ADMIN_EMAIL: 'not-an-email' }],
    ['missing password', { SEED_SUPER_ADMIN_PASSWORD: '' }],
    ['password shorter than 12 characters', { SEED_SUPER_ADMIN_PASSWORD: 'Short-1!' }],
  ])('refuses to seed with %s and writes nothing', async (_label, override) => {
    await expect(seedDatabase(prisma, { ...env, ...override })).rejects.toThrow(/SEED_SUPER_ADMIN_/);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.role.count()).toBe(0);
  });

  it('rejects a second user with the same email, whatever the case', async () => {
    await seedDatabase(prisma, env);
    await expect(
      prisma.user.create({
        data: { email: 'root.admin@example.test', passwordHash: 'x', firstName: 'A', lastName: 'B' },
      }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate role name', async () => {
    await seedDatabase(prisma, env);
    await expect(prisma.role.create({ data: { name: 'Viewer' } })).rejects.toThrow();
  });
});
