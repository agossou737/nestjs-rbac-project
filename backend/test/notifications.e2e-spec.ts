import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { NOTIFICATIONS_QUEUE } from '../src/notifications/notifications.constants.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { resetDatabase } from './utils/reset-database.js';
import { SEED_ENV, createTestApp, createUser, eventually, loginAs, type TestApp } from './utils/test-app.js';

describe('Account notifications (e2e)', () => {
  let ctx: TestApp;
  let queue: Queue;
  const http = () => request(ctx.app.getHttpServer());
  const roleId = async (name: string) => (await ctx.prisma.role.findUniqueOrThrow({ where: { name } })).id;

  const createAccount = async (auth: string, email: string, roles: string[]) =>
    http()
      .post('/api/v1/users')
      .set('Authorization', auth)
      .send({ email, first_name: 'Awa', last_name: 'Test', role_ids: await Promise.all(roles.map(roleId)) })
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp();
    queue = ctx.app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));
  });

  beforeEach(async () => {
    await queue.obliterate({ force: true });
    await resetDatabase(ctx.prisma);
    await seedDatabase(ctx.prisma, SEED_ENV);
    ctx.mail.invitations.length = 0;
    ctx.mail.failNext = 0;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('mails the invitation with the roles of the new account, after the response, through the queue', async () => {
    const { auth } = await loginAs(ctx, ['Manager']);
    await createAccount(auth, 'awa@example.test', ['Viewer', 'Editor']);

    const [invitation] = await eventually(() => ctx.mail.invitations, (sent) => sent.length === 1);
    expect(invitation).toMatchObject({ to: 'awa@example.test', firstName: 'Awa', roles: ['Editor', 'Viewer'] });

    // The link in the mail works: the account owner sets their own password.
    const token = new URL(invitation.resetUrl).searchParams.get('token')!;
    await http().post('/api/v1/auth/reset-password').send({ token, password: 'Mon-mot-de-passe-42' }).expect(204);
  });

  it('says so when the account has no role yet', async () => {
    const { auth } = await loginAs(ctx, ['Manager']);
    await createAccount(auth, 'noroles@example.test', []);

    const [invitation] = await eventually(() => ctx.mail.invitations, (sent) => sent.length === 1);
    expect(invitation.roles).toEqual([]);
  });

  it('keeps only the account id in Redis: no email address, no token', async () => {
    const { auth } = await loginAs(ctx, ['Manager']);
    const created = await createAccount(auth, 'private@example.test', ['Viewer']);

    await eventually(() => ctx.mail.invitations, (sent) => sent.length === 1);
    const [job] = await queue.getJobs(['completed']);
    expect(job.name).toBe('invitation');
    expect(job.data).toEqual({ userId: created.body.id });
    expect(JSON.stringify(job.data)).not.toMatch(/private@|token/);
  });

  it('retries when the mail server fails, and delivers once', async () => {
    const { auth } = await loginAs(ctx, ['Manager']);
    ctx.mail.failNext = 2;
    await createAccount(auth, 'retry@example.test', ['Viewer']);

    await eventually(() => ctx.mail.invitations, (sent) => sent.length === 1);
    const [job] = await queue.getJobs(['completed']);
    expect(job.attemptsMade).toBe(3);
    expect(ctx.mail.invitations).toHaveLength(1);
  });

  it('drops the invitation of an account deleted before the job runs', async () => {
    const gone = await createUser(ctx.prisma, { deletedAt: new Date() });
    const job = await queue.add('invitation', { userId: gone.id });

    await eventually(() => job.getState(), (state) => state === 'completed');
    expect(ctx.mail.invitations).toEqual([]);
  });

  it('never sends the same invitation twice for one account', async () => {
    const user = await createUser(ctx.prisma, { roleNames: ['Viewer'] });
    await ctx.app.get(NotificationsService).queueInvitation(user.id);
    await ctx.app.get(NotificationsService).queueInvitation(user.id);

    await eventually(() => ctx.mail.invitations, (sent) => sent.length >= 1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(ctx.mail.invitations).toHaveLength(1);
  });
});

