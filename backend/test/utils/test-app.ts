import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import type { PrismaClient, UserStatus } from '../../src/generated/prisma/client.js';
import { MailService } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export type SentInvitation = { to: string; firstName: string; resetUrl: string; roles: string[] };
export type SentRolesChange = { to: string; firstName: string; added: string[]; removed: string[]; roles: string[] };

export class FakeMailService {
  readonly sent: { to: string; resetUrl: string }[] = [];
  readonly invitations: SentInvitation[] = [];
  readonly rolesChanges: SentRolesChange[] = [];
  // Number of upcoming invitation sends that fail, to exercise the queue's retries.
  failNext = 0;

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    this.sent.push({ to, resetUrl });
  }

  async sendInvitation(to: string, details: Omit<SentInvitation, 'to'>): Promise<void> {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('SMTP server unavailable');
    }
    this.invitations.push({ to, ...details });
  }

  async sendRolesChanged(to: string, details: Omit<SentRolesChange, 'to'>): Promise<void> {
    this.rolesChanges.push({ to, ...details });
  }
}

// Background jobs finish after the HTTP response: poll until the expectation holds.
export async function eventually<T>(read: () => T | Promise<T>, accept: (value: T) => boolean, timeoutMs = 8000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() > deadline) throw new Error(`Condition not met within ${timeoutMs} ms: ${JSON.stringify(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
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
