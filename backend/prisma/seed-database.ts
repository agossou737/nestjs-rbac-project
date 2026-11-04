import * as argon2 from 'argon2';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { PERMISSIONS, SUPER_ADMIN_ROLE, SYSTEM_ROLES } from '../src/rbac/permission-catalog.js';

export type SeedEnv = {
  SEED_SUPER_ADMIN_EMAIL?: string;
  SEED_SUPER_ADMIN_PASSWORD?: string;
  SEED_SUPER_ADMIN_FIRST_NAME?: string;
  SEED_SUPER_ADMIN_LAST_NAME?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

// Idempotent: reruns sync the catalogue and the system roles, and never touch an existing account's password.
export async function seedDatabase(prisma: PrismaClient, env: SeedEnv): Promise<void> {
  const admin = readSuperAdmin(env);
  const passwordHash = await argon2.hash(admin.password, { type: argon2.argon2id });

  await prisma.$transaction(async (tx) => {
    for (const { key, description } of PERMISSIONS) {
      const [module, action] = key.split('.');
      await tx.permission.upsert({
        where: { key },
        create: { key, module, action, description },
        update: { module, action, description },
      });
    }
    const permissionIds = new Map(
      (await tx.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]),
    );

    for (const definition of SYSTEM_ROLES) {
      const role = await tx.role.upsert({
        where: { name: definition.name },
        create: { name: definition.name, description: definition.description, isSystem: true },
        update: { description: definition.description, isSystem: true, deletedAt: null },
      });
      const wanted = definition.permissions.map((key) => permissionIds.get(key)!);
      await tx.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: wanted } } });
      await tx.rolePermission.createMany({
        data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    const superAdminRole = await tx.role.findUniqueOrThrow({ where: { name: SUPER_ADMIN_ROLE } });
    const user = await tx.user.upsert({
      where: { email: admin.email },
      create: {
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        passwordChangedAt: new Date(),
      },
      update: {},
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
      create: { userId: user.id, roleId: superAdminRole.id },
      update: {},
    });
  });
}

function readSuperAdmin(env: SeedEnv) {
  const email = env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = env.SEED_SUPER_ADMIN_PASSWORD ?? '';
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('SEED_SUPER_ADMIN_EMAIL must be a valid email address');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_SUPER_ADMIN_PASSWORD must contain at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return {
    email,
    password,
    firstName: env.SEED_SUPER_ADMIN_FIRST_NAME?.trim() || 'Super',
    lastName: env.SEED_SUPER_ADMIN_LAST_NAME?.trim() || 'Administrator',
  };
}
