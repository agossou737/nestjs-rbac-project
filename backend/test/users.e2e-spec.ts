import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { resetDatabase } from './utils/reset-database.js';
import { DEFAULT_PASSWORD, SEED_ENV, createTestApp, createUser, loginAs, type TestApp } from './utils/test-app.js';

describe('Users (e2e)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());
  const roleId = async (name: string) => (await ctx.prisma.role.findUniqueOrThrow({ where: { name } })).id;

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

  describe('GET /users', () => {
    it('requires users.read', async () => {
      await http().get('/api/v1/users').expect(401);
      const nobody = await loginAs(ctx, []);
      await http().get('/api/v1/users').set('Authorization', nobody.auth).expect(403);
    });

    it('paginates, searches, filters and sorts on the server', async () => {
      const { auth } = await loginAs(ctx, ['Viewer']);
      for (let i = 1; i <= 12; i++) {
        await createUser(ctx.prisma, { email: `p${String(i).padStart(2, '0')}@paging.test`, status: i <= 3 ? 'INACTIVE' : 'ACTIVE' });
      }

      const page3 = await http()
        .get('/api/v1/users')
        .query({ search: 'paging', page: 3, page_size: 5, sort: 'email', order: 'asc' })
        .set('Authorization', auth)
        .expect(200);
      expect(page3.body).toMatchObject({ total: 12, page: 3, page_size: 5 });
      expect(page3.body.items.map((u: { email: string }) => u.email)).toEqual(['p11@paging.test', 'p12@paging.test']);

      const inactive = await http()
        .get('/api/v1/users')
        .query({ search: 'paging', status: 'INACTIVE', sort: 'email', order: 'desc' })
        .set('Authorization', auth)
        .expect(200);
      expect(inactive.body.items.map((u: { email: string }) => u.email)).toEqual([
        'p03@paging.test',
        'p02@paging.test',
        'p01@paging.test',
      ]);

      const byRole = await http()
        .get('/api/v1/users')
        .query({ role_id: await roleId('Super Administrator') })
        .set('Authorization', auth)
        .expect(200);
      expect(byRole.body.items.map((u: { email: string }) => u.email)).toEqual(['root@example.test']);
      expect(byRole.body.items[0]).toMatchObject({ status: 'ACTIVE', roles: [{ name: 'Super Administrator' }] });
      expect(byRole.body.items[0]).not.toHaveProperty('password_hash');
    });

    it('rejects an invalid query', async () => {
      const { auth } = await loginAs(ctx, ['Viewer']);
      const res = await http().get('/api/v1/users').query({ page_size: 1000, sort: 'password_hash' }).set('Authorization', auth).expect(400);
      expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['page_size', 'sort']);
    });
  });

  describe('POST /users', () => {
    it('creates an account with roles and mails an invitation link instead of a password', async () => {
      const { auth } = await loginAs(ctx, ['Manager']);

      const res = await http()
        .post('/api/v1/users')
        .set('Authorization', auth)
        .send({ email: 'New.User@Example.test', first_name: 'New', last_name: 'User', role_ids: [await roleId('Editor')] })
        .expect(201);

      expect(res.body).toMatchObject({ email: 'new.user@example.test', status: 'ACTIVE', roles: [{ name: 'Editor' }] });
      expect(ctx.mail.sent.map((m) => m.to)).toEqual(['new.user@example.test']);
      const log = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'user.created' } });
      expect(log.entityId).toBe(res.body.id);
    });

    it('refuses a duplicate email, whatever its case and even for a deleted account', async () => {
      const { auth } = await loginAs(ctx, ['Manager']);
      await createUser(ctx.prisma, { email: 'taken@example.test' });
      await createUser(ctx.prisma, { email: 'gone@example.test', deletedAt: new Date() });

      for (const email of ['TAKEN@example.test', 'gone@example.test']) {
        const res = await http()
          .post('/api/v1/users')
          .set('Authorization', auth)
          .send({ email, first_name: 'A', last_name: 'B' })
          .expect(409);
        expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      }
    });

    it('refuses to create an account with a role the actor could not hold', async () => {
      const { auth } = await loginAs(ctx, ['Manager']);
      await http()
        .post('/api/v1/users')
        .set('Authorization', auth)
        .send({ email: 'boss@example.test', first_name: 'A', last_name: 'B', role_ids: [await roleId('Administrator')] })
        .expect(403);
      expect(await ctx.prisma.user.count({ where: { email: 'boss@example.test' } })).toBe(0);
    });
  });

  describe('GET, PATCH and DELETE /users/:id', () => {
    it('returns a user, and 404 for an unknown or deleted one', async () => {
      const { auth } = await loginAs(ctx, ['Viewer']);
      const target = await createUser(ctx.prisma, { roleNames: ['Editor'] });
      const deleted = await createUser(ctx.prisma, { deletedAt: new Date() });

      const res = await http().get(`/api/v1/users/${target.id}`).set('Authorization', auth).expect(200);
      expect(res.body).toMatchObject({ id: target.id, first_name: 'Test', roles: [{ name: 'Editor' }] });
      await http().get(`/api/v1/users/${crypto.randomUUID()}`).set('Authorization', auth).expect(404);
      await http().get(`/api/v1/users/${deleted.id}`).set('Authorization', auth).expect(404);
      await http().get('/api/v1/users/not-a-uuid').set('Authorization', auth).expect(400);
    });

    it('updates a profile and refuses an email already in use', async () => {
      const { auth } = await loginAs(ctx, ['Editor']);
      const target = await createUser(ctx.prisma);
      await createUser(ctx.prisma, { email: 'other@example.test' });

      const res = await http()
        .patch(`/api/v1/users/${target.id}`)
        .set('Authorization', auth)
        .send({ first_name: 'Renamed' })
        .expect(200);
      expect(res.body.first_name).toBe('Renamed');
      await http().patch(`/api/v1/users/${target.id}`).set('Authorization', auth).send({ email: 'OTHER@example.test' }).expect(409);
    });

    it('changes the status, revokes the sessions of a deactivated user, and protects the actor', async () => {
      const manager = await loginAs(ctx, ['Manager']);
      const target = await loginAs(ctx, ['Viewer']);

      await http()
        .patch(`/api/v1/users/${target.user.id}/status`)
        .set('Authorization', manager.auth)
        .send({ status: 'INACTIVE' })
        .expect(200);
      await http().get('/api/v1/auth/me').set('Authorization', target.auth).expect(401);
      await http().post('/api/v1/auth/refresh').set('Cookie', target.cookie).expect(401);

      await http()
        .patch(`/api/v1/users/${manager.user.id}/status`)
        .set('Authorization', manager.auth)
        .send({ status: 'INACTIVE' })
        .expect(403);
    });

    it('lets only a Super Administrator act on a Super Administrator account', async () => {
      const administrator = await loginAs(ctx, ['Administrator']);
      const root = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'root@example.test' } });

      await http().patch(`/api/v1/users/${root.id}/status`).set('Authorization', administrator.auth).send({ status: 'LOCKED' }).expect(403);
      await http().delete(`/api/v1/users/${root.id}`).set('Authorization', administrator.auth).expect(403);
      await http().post(`/api/v1/users/${root.id}/reset-password`).set('Authorization', administrator.auth).expect(403);
      await http().patch(`/api/v1/users/${root.id}`).set('Authorization', administrator.auth).send({ first_name: 'X' }).expect(403);
    });

    it('soft-deletes an account, which can no longer sign in, and refuses self-deletion', async () => {
      const administrator = await loginAs(ctx, ['Administrator']);
      const target = await createUser(ctx.prisma, { email: 'leaving@example.test' });

      await http().delete(`/api/v1/users/${target.id}`).set('Authorization', administrator.auth).expect(204);
      expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: target.id } })).deletedAt).not.toBeNull();
      await http().post('/api/v1/auth/login').send({ email: 'leaving@example.test', password: DEFAULT_PASSWORD }).expect(401);
      await http().delete(`/api/v1/users/${administrator.user.id}`).set('Authorization', administrator.auth).expect(403);

      const manager = await loginAs(ctx, ['Manager']);
      const other = await createUser(ctx.prisma);
      await http().delete(`/api/v1/users/${other.id}`).set('Authorization', manager.auth).expect(403);
    });

    it('sends a reset link to the user without exposing any password', async () => {
      const { auth } = await loginAs(ctx, ['Manager']);
      const target = await createUser(ctx.prisma, { email: 'forgetful@example.test' });

      const res = await http().post(`/api/v1/users/${target.id}/reset-password`).set('Authorization', auth).expect(202);
      expect(JSON.stringify(res.body)).not.toMatch(/password_hash|token/i);
      expect(ctx.mail.sent.map((m) => m.to)).toEqual(['forgetful@example.test']);
    });
  });

  describe('PUT /users/:id/roles (privilege escalation)', () => {
    const putRoles = (auth: string, userId: string, roleIds: string[]) =>
      http().put(`/api/v1/users/${userId}/roles`).set('Authorization', auth).send({ role_ids: roleIds });

    it('lets a Manager grant a role within its own permissions', async () => {
      const manager = await loginAs(ctx, ['Manager']);
      const target = await createUser(ctx.prisma, { roleNames: ['Viewer'] });

      const res = await putRoles(manager.auth, target.id, [await roleId('Editor'), await roleId('Viewer')]).expect(200);
      expect(res.body.roles.map((r: { name: string }) => r.name).sort()).toEqual(['Editor', 'Viewer']);

      const log = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'user.roles_changed' } });
      expect(log.metadata).toMatchObject({ added: ['Editor'], removed: [] });
    });

    it('refuses a role carrying permissions the actor lacks, and Super Administrator to an Administrator', async () => {
      const manager = await loginAs(ctx, ['Manager']);
      const administrator = await loginAs(ctx, ['Administrator']);
      const target = await createUser(ctx.prisma);

      await putRoles(manager.auth, target.id, [await roleId('Administrator')]).expect(403);
      await putRoles(administrator.auth, target.id, [await roleId('Super Administrator')]).expect(403);
      expect(await ctx.prisma.userRole.count({ where: { userId: target.id } })).toBe(0);
    });

    it('refuses any change to your own roles', async () => {
      const manager = await loginAs(ctx, ['Manager']);
      await putRoles(manager.auth, manager.user.id, [await roleId('Manager'), await roleId('Viewer')]).expect(403);
    });

    it('lets a Super Administrator promote another account', async () => {
      const root = await loginAs(ctx, ['Super Administrator']);
      const target = await createUser(ctx.prisma);
      await putRoles(root.auth, target.id, [await roleId('Super Administrator')]).expect(200);
    });

    it('rejects an unknown role', async () => {
      const manager = await loginAs(ctx, ['Manager']);
      const target = await createUser(ctx.prisma);
      await putRoles(manager.auth, target.id, [crypto.randomUUID()]).expect(404);
    });
  });
});
