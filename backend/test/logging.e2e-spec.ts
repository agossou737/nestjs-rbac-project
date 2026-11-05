import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { resetDatabase } from './utils/reset-database.js';
import { SEED_ENV, cookiePair, createTestApp, refreshCookieFrom, type TestApp } from './utils/test-app.js';

// The other suites run with LOG_LEVEL=silent; this one turns request logging on to inspect what is written.
vi.hoisted(() => {
  process.env.LOG_LEVEL = 'info';
});

describe('Application logs (e2e)', () => {
  let ctx: TestApp;
  let written: string[] = [];
  let restore: () => void;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    await seedDatabase(ctx.prisma, SEED_ENV);
  });

  beforeEach(() => {
    written = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      written.push(chunk.toString());
      return true;
    }) as typeof process.stdout.write;
    restore = () => {
      process.stdout.write = original;
    };
  });

  afterEach(() => restore());

  afterAll(async () => {
    await ctx.app.close();
  });

  it('writes one structured JSON line per request, with the correlation id and without secrets or PII', async () => {
    const http = () => request(ctx.app.getHttpServer());
    const login = await http()
      .post('/api/v1/auth/login')
      .set('User-Agent', 'log-test')
      .send({ email: SEED_ENV.SEED_SUPER_ADMIN_EMAIL, password: SEED_ENV.SEED_SUPER_ADMIN_PASSWORD })
      .expect(200);
    const accessToken: string = login.body.access_token;
    const cookie = cookiePair(refreshCookieFrom(login.headers['set-cookie'])!);
    await http().get('/api/v1/users?search=secret-search').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    await http().post('/api/v1/auth/forgot-password').send({ email: SEED_ENV.SEED_SUPER_ADMIN_EMAIL }).expect(202);

    const lines = written.join('').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    const requests = lines.filter((line) => line.msg === 'request completed');
    expect(requests.length).toBeGreaterThanOrEqual(4);
    for (const line of requests) {
      expect(line).toMatchObject({ level: expect.any(String), reqId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    }
    expect(requests.map((line) => (line.req as { url: string }).url)).toContain('/api/v1/users');

    const all = written.join('');
    expect(all).not.toContain(SEED_ENV.SEED_SUPER_ADMIN_PASSWORD);
    expect(all).not.toContain(accessToken);
    expect(all).not.toContain(cookie.split('=')[1]);
    expect(all).not.toContain(SEED_ENV.SEED_SUPER_ADMIN_EMAIL);
    expect(all).not.toContain('secret-search');
  });
});
