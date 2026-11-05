import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { ActivityLogService } from '../src/activity-logs/activity-log.service.js';
import { resetDatabase } from './utils/reset-database.js';
import { SEED_ENV, createTestApp, createUser, loginAs, type TestApp } from './utils/test-app.js';

describe('Permissions, activity logs, login history and dashboard (e2e)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedDatabase(ctx.prisma, SEED_ENV);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /permissions lists the catalogue as module.action', async () => {
    const { auth } = await loginAs(ctx, ['Viewer']);
    const res = await http().get('/api/v1/permissions').set('Authorization', auth).expect(200);
    expect(res.body).toHaveLength(14);
    expect(res.body[0]).toEqual({
      id: expect.any(String),
      key: 'activity_logs.read',
      module: 'activity_logs',
      action: 'read',
      description: expect.any(String),
    });
  });

  describe('activity logs', () => {
    it('are readable with activity_logs.read only, and filterable', async () => {
      const viewer = await loginAs(ctx, ['Viewer']);
      const auditor = await loginAs(ctx, ['Auditor']);
      const log = ctx.app.get(ActivityLogService);
      await log.record({ actorId: auditor.user.id, action: 'user.updated', entityType: 'user', entityId: viewer.user.id });
      await log.record({ actorId: auditor.user.id, action: 'role.created', entityType: 'role' });

      await http().get('/api/v1/activity-logs').set('Authorization', viewer.auth).expect(403);
      const res = await http()
        .get('/api/v1/activity-logs')
        .query({ action: 'user.updated', actor_id: auditor.user.id })
        .set('Authorization', auditor.auth)
        .expect(200);
      expect(res.body).toMatchObject({ total: 1, page: 1 });
      expect(res.body.items[0]).toMatchObject({
        action: 'user.updated',
        entity_type: 'user',
        entity_id: viewer.user.id,
        actor: { id: auditor.user.id, email: auditor.user.email },
      });
      expect(res.body.items[0].created_at).toMatch(/Z$/);
    });

    it('filter by date range', async () => {
      const auditor = await loginAs(ctx, ['Auditor']);
      const log = ctx.app.get(ActivityLogService);
      await log.record({ action: 'role.created', entityType: 'role' });
      await ctx.prisma.activityLog.updateMany({ data: { createdAt: new Date('2026-01-10T10:00:00Z') } });
      await log.record({ action: 'role.updated', entityType: 'role' });

      const january = await http()
        .get('/api/v1/activity-logs')
        .query({ from: '2026-01-01T00:00:00Z', to: '2026-01-31T23:59:59Z' })
        .set('Authorization', auditor.auth)
        .expect(200);
      expect(january.body.items.map((l: { action: string }) => l.action)).toEqual(['role.created']);

      await http().get('/api/v1/activity-logs').query({ from: 'yesterday' }).set('Authorization', auditor.auth).expect(400);
    });

    it('expose no write route', async () => {
      const { auth } = await loginAs(ctx, ['Super Administrator']);
      await http().post('/api/v1/activity-logs').set('Authorization', auth).send({}).expect(404);
      await http().delete('/api/v1/activity-logs').set('Authorization', auth).expect(404);
    });

    it('never store a secret, however deep in the metadata', async () => {
      const log = ctx.app.get(ActivityLogService);
      await log.record({
        action: 'test.secrets',
        entityType: 'test',
        metadata: { password: 'Plain-Text-1', nested: { refresh_token: 'abc', authorization: 'Bearer x', keep: 'ok' } },
      });
      const stored = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'test.secrets' } });
      expect(stored.metadata).toEqual({
        password: '[REDACTED]',
        nested: { refresh_token: '[REDACTED]', authorization: '[REDACTED]', keep: 'ok' },
      });
    });
  });

  it('GET /login-history is filterable and needs login_history.read', async () => {
    const viewer = await loginAs(ctx, ['Viewer']);
    const auditor = await loginAs(ctx, ['Auditor']);
    await http().post('/api/v1/auth/login').send({ email: viewer.user.email, password: 'Wrong-Password-1' }).expect(401);

    await http().get('/api/v1/login-history').set('Authorization', viewer.auth).expect(403);
    const res = await http()
      .get('/api/v1/login-history')
      .query({ outcome: 'INVALID_CREDENTIALS' })
      .set('Authorization', auditor.auth)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ email: viewer.user.email, outcome: 'INVALID_CREDENTIALS', user_id: viewer.user.id });

    const mine = await http().get('/api/v1/login-history').query({ user_id: auditor.user.id }).set('Authorization', auditor.auth).expect(200);
    expect(mine.body.items.map((h: { outcome: string }) => h.outcome)).toEqual(['SUCCESS']);
  });

  it('GET /login-history filters by typed email and by date', async () => {
    const auditor = await loginAs(ctx, ['Auditor']);
    await http().post('/api/v1/auth/login').send({ email: 'stranger@elsewhere.test', password: 'Wrong-Password-1' }).expect(401);
    await ctx.prisma.loginHistory.updateMany({ where: { email: 'stranger@elsewhere.test' }, data: { createdAt: new Date('2026-02-01T08:00:00Z') } });

    const byEmail = await http().get('/api/v1/login-history').query({ email: 'elsewhere' }).set('Authorization', auditor.auth).expect(200);
    expect(byEmail.body.items.map((h: { email: string; user_id: string | null }) => [h.email, h.user_id])).toEqual([['stranger@elsewhere.test', null]]);

    const february = await http()
      .get('/api/v1/login-history')
      .query({ from: '2026-02-01T00:00:00Z', to: '2026-02-02T00:00:00Z' })
      .set('Authorization', auditor.auth)
      .expect(200);
    expect(february.body.total).toBe(1);
  });

  it('GET /dashboard returns figures computed from the database', async () => {
    const viewer = await loginAs(ctx, ['Viewer']);
    await createUser(ctx.prisma, { status: 'INACTIVE' });
    await createUser(ctx.prisma, { status: 'LOCKED' });
    await createUser(ctx.prisma, { deletedAt: new Date() });

    const res = await http().get('/api/v1/dashboard').set('Authorization', viewer.auth).expect(200);

    expect(res.body.users).toEqual({ total: 4, active: 2, inactive: 1, locked: 1 });
    expect(res.body.roles_total).toBe(6);
    expect(res.body.permissions_total).toBe(14);
    expect(res.body.logins_by_day).toHaveLength(14);
    expect(res.body.logins_by_day.at(-1)).toMatchObject({ success: 1, failure: 0 });
    expect(res.body.users_by_role).toEqual(
      expect.arrayContaining([
        { role: 'Super Administrator', count: 1 },
        { role: 'Viewer', count: 1 },
      ]),
    );

    const nobody = await loginAs(ctx, []);
    await http().get('/api/v1/dashboard').set('Authorization', nobody.auth).expect(403);
  });
});
