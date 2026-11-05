import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { resetDatabase } from './utils/reset-database.js';
import { DEFAULT_PASSWORD, SEED_ENV, cookiePair, createTestApp, createUser, loginAs, refreshCookieFrom, type TestApp } from './utils/test-app.js';

describe('Hardening (e2e)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());
  const actions = async () => (await ctx.prisma.activityLog.findMany({ orderBy: { createdAt: 'asc' } })).map((log) => log.action);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedDatabase(ctx.prisma, SEED_ENV);
    ctx.mail.sent.length = 0;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('correlation id', () => {
    it('answers every request with an X-Request-Id, reusing a well-formed incoming one', async () => {
      const generated = await http().get('/api/v1/auth/me').expect(401);
      expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

      const reused = await http().get('/api/v1/auth/me').set('X-Request-Id', 'gateway-42.abc').expect(401);
      expect(reused.headers['x-request-id']).toBe('gateway-42.abc');

      const forged = await http().get('/api/v1/auth/me').set('X-Request-Id', 'x'.repeat(200)).expect(401);
      expect(forged.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('errors', () => {
    it('answers an unknown route and a malformed body with problem+json, never a stack trace', async () => {
      const missing = await http().get('/api/v1/nothing-here').expect(404);
      expect(missing.headers['content-type']).toMatch(/application\/problem\+json/);

      const malformed = await http()
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "a@b.test", "password": ')
        .expect(400);
      expect(malformed.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(JSON.stringify(malformed.body)).not.toMatch(/at \w+ \(|node_modules|SyntaxError/);
    });

    it('refuses an oversized body', async () => {
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'a@b.test', password: 'x'.repeat(200_000) })
        .expect(413);
    });
  });

  describe('security events in the activity log', () => {
    it('records a logout', async () => {
      const { user, cookie } = await loginAs(ctx, []);
      await http().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);

      const log = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'auth.logout' } });
      expect(log).toMatchObject({ actorId: user.id, entityType: 'user', entityId: user.id });
    });

    it('records a revoked session when a refresh token is replayed', async () => {
      const { user, cookie } = await loginAs(ctx, []);
      await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
      await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);

      const log = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'auth.session_revoked' } });
      expect(log).toMatchObject({ entityId: user.id, metadata: { reason: 'refresh_token_reuse' } });
    });

    it('records an IP block on an account and a completed password reset', async () => {
      const user = await createUser(ctx.prisma, { email: 'target@example.test' });
      for (let i = 0; i < 5; i++) {
        await http().post('/api/v1/auth/login').send({ email: 'target@example.test', password: 'Wrong-Password-1' }).expect(401);
      }
      await http().post('/api/v1/auth/forgot-password').send({ email: 'target@example.test' }).expect(202);
      const token = new URL(ctx.mail.sent.at(-1)!.resetUrl).searchParams.get('token')!;
      await http().post('/api/v1/auth/reset-password').send({ token, password: 'Brand-New-Password-9' }).expect(204);

      expect(await actions()).toEqual(['auth.login_blocked', 'auth.password_reset']);
      const logs = await ctx.prisma.activityLog.findMany({ where: { entityId: user.id } });
      expect(JSON.stringify(logs)).not.toMatch(/Brand-New-Password-9|Wrong-Password-1/);
      expect(JSON.stringify(logs)).not.toContain(token);
    });

    it('does not record anything for an unknown account', async () => {
      await http().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.test' }).expect(202);
      await http().post('/api/v1/auth/login').send({ email: 'ghost@example.test', password: DEFAULT_PASSWORD }).expect(401);
      expect(await actions()).toEqual([]);
    });
  });

  it('keeps the refresh cookie out of every response body', async () => {
    const { cookie } = await loginAs(ctx, ['Viewer']);
    const raw = cookiePair(cookie).split('=')[1];
    const res = await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    expect(JSON.stringify(res.body)).not.toContain(raw);
    expect(JSON.stringify(res.body)).not.toContain(cookiePair(refreshCookieFrom(res.headers['set-cookie'])!).split('=')[1]);
  });
});
