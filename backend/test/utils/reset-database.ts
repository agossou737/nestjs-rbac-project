import type { PrismaClient } from '../../src/generated/prisma/client.js';

// Children first, so foreign keys never block the cleanup.
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.loginHistory.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
  ]);
}
