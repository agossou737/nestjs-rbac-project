import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import type { PrismaClient, UserStatus } from '../../src/generated/prisma/client.js';
import { MailService } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export class FakeMailService {
  readonly sent: { to: string; resetUrl: string }[] = [];

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    this.sent.push({ to, resetUrl });
  }
}

export type TestApp = { app: INestApplication; prisma: PrismaClient; mail: FakeMailService };

export async function createTestApp(): Promise<TestApp> {
  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), mail };
}

type NewUser = {
  email?: string;
  password?: string;
  status?: UserStatus;
  roleNames?: string[];
  deletedAt?: Date;
};

export const DEFAULT_PASSWORD = 'Valid-Password-123';

export async function createUser(prisma: PrismaClient, input: NewUser = {}) {
  const email = input.email ?? `user-${crypto.randomUUID()}@example.test`;
  const roles = await prisma.role.findMany({ where: { name: { in: input.roleNames ?? [] } } });
  return prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(input.password ?? DEFAULT_PASSWORD, { type: argon2.argon2id }),
      firstName: 'Test',
      lastName: 'User',
      status: input.status ?? 'ACTIVE',
      deletedAt: input.deletedAt,
      roles: { create: roles.map((role) => ({ roleId: role.id })) },
    },
  });
}

export function refreshCookieFrom(setCookie: string[] | string | undefined): string | undefined {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.find((cookie) => cookie.startsWith('refresh_token='));
}

export function cookiePair(setCookieLine: string): string {
  return setCookieLine.split(';')[0];
}

export const SEED_ENV = { SEED_SUPER_ADMIN_EMAIL: 'root@example.test', SEED_SUPER_ADMIN_PASSWORD: 'Root-Password-123' };

// Creates a user holding these roles and returns an Authorization header for it.
export async function loginAs(ctx: TestApp, roleNames: string[]) {
  const user = await createUser(ctx.prisma, { roleNames });
  const res = await request(ctx.app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: DEFAULT_PASSWORD })
    .expect(200);
  return { user, auth: `Bearer ${res.body.access_token as string}`, cookie: cookiePair(refreshCookieFrom(res.headers['set-cookie'])!) };
}
