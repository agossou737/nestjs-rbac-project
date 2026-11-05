import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('Health (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('answers without authentication when the database is reachable, and reveals nothing else', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers 503 problem+json when the database is down', async () => {
    const prisma = ctx.app.get(PrismaService);
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(503);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    spy.mockRestore();
  });
});
