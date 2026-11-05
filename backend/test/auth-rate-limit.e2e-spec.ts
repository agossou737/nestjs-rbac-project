import request from 'supertest';
import { createTestApp, type TestApp } from './utils/test-app.js';

// ConfigModule reads the environment once, when AppModule is imported: set the limit before any import.
vi.hoisted(() => {
  process.env.AUTH_THROTTLE_LIMIT = '3';
});

describe('Authentication rate limiting (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('answers 429 once an IP exceeds the login limit', async () => {
    const attempt = () =>
      request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'flood@example.test', password: 'Wrong-Password-1' });
    for (let i = 0; i < 3; i++) await attempt().expect(401);

    const blocked = await attempt().expect(429);
    expect(blocked.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(blocked.body).toMatchObject({ status: 429, title: 'Too Many Requests' });
  });
});
