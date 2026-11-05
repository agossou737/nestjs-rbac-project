import { createHash } from 'node:crypto';
import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { AuthService } from '../src/auth/auth.service.js';
import { resetDatabase } from './utils/reset-database.js';
import {
  DEFAULT_PASSWORD,
  cookiePair,
  createTestApp,
  createUser,
  refreshCookieFrom,
  type TestApp,
} from './utils/test-app.js';

const seedEnv = {
  SEED_SUPER_ADMIN_EMAIL: 'root@example.test',
  SEED_SUPER_ADMIN_PASSWORD: 'Root-Password-123',
};

describe('Authentication (e2e)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  const login = (email: string, password = DEFAULT_PASSWORD) =>
    http().post('/api/v1/auth/login').send({ email, password });

  async function loginOk(email: string, password = DEFAULT_PASSWORD) {
    const res = await login(email, password).expect(200);
    return { accessToken: res.body.access_token as string, cookie: cookiePair(refreshCookieFrom(res.headers['set-cookie'])!) };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedDatabase(ctx.prisma, seedEnv);
    ctx.mail.sent.length = 0;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns an access token and sets the refresh token in a hardened cookie', async () => {
      const user = await createUser(ctx.prisma, { email: 'alice@example.test' });

      const res = await login('alice@example.test').expect(200);

      expect(res.body).toMatchObject({
        token_type: 'Bearer',
        expires_in: 900,
        user: { id: user.id, email: 'alice@example.test', first_name: 'Test', last_name: 'User' },
      });
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body).not.toHaveProperty('refresh_token');

      const cookie = refreshCookieFrom(res.headers['set-cookie'])!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/i);

      const rawToken = cookiePair(cookie).split('=')[1];
      const stored = await ctx.prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
      expect(stored.tokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
      expect(stored.tokenHash).not.toBe(rawToken);
    });

    it('matches the email whatever its case', async () => {
      await createUser(ctx.prisma, { email: 'bob@example.test' });
      await login('  BOB@Example.TEST ').expect(200);
    });

    it('answers the same problem for a wrong password and an unknown email', async () => {
      await createUser(ctx.prisma, { email: 'carol@example.test' });

      const wrongPassword = await login('carol@example.test', 'Wrong-Password-1').expect(401);
      const unknownEmail = await login('nobody@example.test', 'Wrong-Password-1').expect(401);

      expect(wrongPassword.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(wrongPassword.body).toMatchObject({ type: 'about:blank', title: 'Unauthorized', status: 401 });
      expect(unknownEmail.body.detail).toBe(wrongPassword.body.detail);
    });

    it('rejects an invalid body with field errors and an unknown field', async () => {
      const missing = await http().post('/api/v1/auth/login').send({ password: 'x' }).expect(400);
      expect(missing.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(missing.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email' })]));

      const extra = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'a@example.test', password: 'x', is_admin: true })
        .expect(400);
      expect(extra.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'is_admin' })]));
    });

    it.each([
      ['inactive', { status: 'INACTIVE' as const }],
      ['locked by an administrator', { status: 'LOCKED' as const }],
      ['soft-deleted', { deletedAt: new Date() }],
    ])('refuses an %s account', async (_label, override) => {
      await createUser(ctx.prisma, { email: 'dave@example.test', ...override });
      await login('dave@example.test').expect(401);
    });

    describe('brute force (lockout per account and IP)', () => {
      const viaService = (email: string, password: string, ip: string) =>
        ctx.app.get(AuthService).login(email, password, { ipAddress: ip, userAgent: 'test' });

      it('blocks an IP after five failures on an account, even with the right password, while other IPs still sign in', async () => {
        await createUser(ctx.prisma, { email: 'erin@example.test' });
        for (let i = 0; i < 5; i++) await login('erin@example.test', 'Wrong-Password-1').expect(401);

        await login('erin@example.test').expect(401);
        const blocked = await ctx.prisma.loginHistory.findFirstOrThrow({ where: { email: 'erin@example.test' }, orderBy: { createdAt: 'desc' } });
        expect(blocked.outcome).toBe('ACCOUNT_LOCKED');

        await expect(viaService('erin@example.test', DEFAULT_PASSWORD, '10.20.30.40')).resolves.toBeDefined();
      });

      it('lifts the IP block once the failures leave the 15-minute window', async () => {
        await createUser(ctx.prisma, { email: 'fay@example.test' });
        for (let i = 0; i < 5; i++) await login('fay@example.test', 'Wrong-Password-1').expect(401);
        await login('fay@example.test').expect(401);

        await ctx.prisma.loginHistory.updateMany({
          where: { email: 'fay@example.test' },
          data: { createdAt: new Date(Date.now() - 16 * 60_000) },
        });
        await login('fay@example.test').expect(200);
      });

      it('cannot be used to lock out the Super Administrator from elsewhere', async () => {
        for (let i = 0; i < 6; i++) await viaService(seedEnv.SEED_SUPER_ADMIN_EMAIL, 'Wrong-Password-1', '203.0.113.7').catch(() => undefined);
        await login(seedEnv.SEED_SUPER_ADMIN_EMAIL, seedEnv.SEED_SUPER_ADMIN_PASSWORD).expect(200);
      });

      it('locks the whole account after a distributed attack crosses the account threshold', async () => {
        const user = await createUser(ctx.prisma, { email: 'gil@example.test' });
        for (let i = 0; i < 20; i++) await viaService('gil@example.test', 'Wrong-Password-1', `198.51.100.${i}`).catch(() => undefined);

        await expect(viaService('gil@example.test', DEFAULT_PASSWORD, '192.0.2.1')).rejects.toMatchObject({ status: 401 });
        const locked = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

        await ctx.prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
        await login('gil@example.test').expect(200);
        const unlocked = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(unlocked.failedLoginCount).toBe(0);
        expect(unlocked.lockedUntil).toBeNull();
      });
    });

    it('records every attempt in the login history without any secret', async () => {
      const user = await createUser(ctx.prisma, { email: 'frank@example.test' });
      await login('frank@example.test', 'Wrong-Password-1').expect(401);
      await login('frank@example.test').expect(200);
      await login('ghost@example.test', 'Ghost-Password-1').expect(401);

      const history = await ctx.prisma.loginHistory.findMany({ orderBy: { createdAt: 'asc' } });
      expect(history.map((h) => [h.email, h.outcome, h.userId])).toEqual([
        ['frank@example.test', 'INVALID_CREDENTIALS', user.id],
        ['frank@example.test', 'SUCCESS', user.id],
        ['ghost@example.test', 'INVALID_CREDENTIALS', null],
      ]);
      const serialized = JSON.stringify(history);
      expect(serialized).not.toContain(DEFAULT_PASSWORD);
      expect(serialized).not.toContain('Wrong-Password-1');
      expect(serialized).not.toContain('Ghost-Password-1');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('requires a valid access token', async () => {
      await http().get('/api/v1/auth/me').expect(401);
      await http().get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });

    it('returns the user with roles and permissions read from the database on each call', async () => {
      await createUser(ctx.prisma, { email: 'gina@example.test', roleNames: ['Viewer'] });
      const { accessToken } = await loginOk('gina@example.test');

      const first = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(first.body).toMatchObject({ email: 'gina@example.test', status: 'ACTIVE', roles: [{ name: 'Viewer' }] });
      expect(first.body.permissions).toEqual(['dashboard.read', 'permissions.read', 'roles.read', 'users.read']);

      const viewer = await ctx.prisma.role.findUniqueOrThrow({ where: { name: 'Viewer' } });
      const auditLog = await ctx.prisma.permission.findUniqueOrThrow({ where: { key: 'activity_logs.read' } });
      await ctx.prisma.rolePermission.create({ data: { roleId: viewer.id, permissionId: auditLog.id } });

      const second = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(second.body.permissions).toContain('activity_logs.read');
    });

    it('rejects a token whose user was deactivated after login', async () => {
      const user = await createUser(ctx.prisma, { email: 'hank@example.test' });
      const { accessToken } = await loginOk('hank@example.test');
      await ctx.prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });

      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates the refresh token and returns a new access token', async () => {
      await createUser(ctx.prisma, { email: 'iris@example.test' });
      const { cookie } = await loginOk('iris@example.test');

      const res = await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);

      expect(typeof res.body.access_token).toBe('string');
      const rotated = cookiePair(refreshCookieFrom(res.headers['set-cookie'])!);
      expect(rotated).not.toBe(cookie);
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.access_token}`).expect(200);
    });

    it('revokes the whole session when a used refresh token is replayed', async () => {
      await createUser(ctx.prisma, { email: 'jack@example.test' });
      const { cookie: original } = await loginOk('jack@example.test');
      const rotatedRes = await http().post('/api/v1/auth/refresh').set('Cookie', original).expect(200);
      const rotated = cookiePair(refreshCookieFrom(rotatedRes.headers['set-cookie'])!);

      await http().post('/api/v1/auth/refresh').set('Cookie', original).expect(401);

      await http().post('/api/v1/auth/refresh').set('Cookie', rotated).expect(401);
      await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rotatedRes.body.access_token}`)
        .expect(401);
    });

    it('lets only one of two concurrent refreshes win, then closes the session as a replay', async () => {
      await createUser(ctx.prisma, { email: 'twin@example.test' });
      const { cookie } = await loginOk('twin@example.test');

      const results = await Promise.all([
        http().post('/api/v1/auth/refresh').set('Cookie', cookie),
        http().post('/api/v1/auth/refresh').set('Cookie', cookie),
      ]);

      expect(results.map((res) => res.status).sort((a, b) => a - b)).toEqual([200, 401]);
      const winner = results.find((res) => res.status === 200)!;
      await http().post('/api/v1/auth/refresh').set('Cookie', cookiePair(refreshCookieFrom(winner.headers['set-cookie'])!)).expect(401);
    });

    it('refuses a missing, unknown or expired refresh token', async () => {
      await http().post('/api/v1/auth/refresh').expect(401);
      await http().post('/api/v1/auth/refresh').set('Cookie', 'refresh_token=forged').expect(401);

      const user = await createUser(ctx.prisma, { email: 'kate@example.test' });
      const { cookie } = await loginOk('kate@example.test');
      await ctx.prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes the session, clears the cookie and invalidates the access token', async () => {
      await createUser(ctx.prisma, { email: 'liam@example.test' });
      const { accessToken, cookie } = await loginOk('liam@example.test');

      const res = await http().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
      expect(refreshCookieFrom(res.headers['set-cookie'])).toMatch(/refresh_token=;.*Expires=Thu, 01 Jan 1970/i);

      await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    });

    it('succeeds without a cookie so a stale client can always log out', async () => {
      await http().post('/api/v1/auth/logout').expect(204);
    });
  });

  describe('password reset', () => {
    const resetTokenFromMail = () => new URL(ctx.mail.sent.at(-1)!.resetUrl).searchParams.get('token')!;

    it('answers 202 for known and unknown emails, and mails only the known one', async () => {
      await createUser(ctx.prisma, { email: 'mia@example.test' });

      const known = await http().post('/api/v1/auth/forgot-password').send({ email: 'MIA@example.test' }).expect(202);
      const unknown = await http().post('/api/v1/auth/forgot-password').send({ email: 'none@example.test' }).expect(202);

      expect(unknown.body).toEqual(known.body);
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe('mia@example.test');
      expect(ctx.mail.sent[0].resetUrl).toMatch(/^http:\/\/localhost:5180\/reset-password\?token=/);
    });

    it('sets the new password once, and revokes every session', async () => {
      await createUser(ctx.prisma, { email: 'noah@example.test' });
      const { cookie } = await loginOk('noah@example.test');
      await http().post('/api/v1/auth/forgot-password').send({ email: 'noah@example.test' }).expect(202);
      const token = resetTokenFromMail();

      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'Brand-New-Password-9' })
        .expect(204);

      await login('noah@example.test').expect(401);
      await login('noah@example.test', 'Brand-New-Password-9').expect(200);
      await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'Another-Password-9' })
        .expect(400);
    });

    it('refuses an expired token and a weak password', async () => {
      await createUser(ctx.prisma, { email: 'olga@example.test' });
      await http().post('/api/v1/auth/forgot-password').send({ email: 'olga@example.test' }).expect(202);
      const token = resetTokenFromMail();

      const weak = await http().post('/api/v1/auth/reset-password').send({ token, password: 'short' }).expect(400);
      expect(weak.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'password' })]));

      await ctx.prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'Brand-New-Password-9' })
        .expect(400);
    });
  });
});
