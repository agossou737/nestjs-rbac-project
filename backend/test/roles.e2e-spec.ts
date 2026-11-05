import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { resetDatabase } from './utils/reset-database.js';
import { SEED_ENV, createTestApp, createUser, loginAs, type TestApp } from './utils/test-app.js';

describe('Roles (e2e)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());
  const role = (name: string) => ctx.prisma.role.findUniqueOrThrow({ where: { name } });

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

  it('lists the roles with their counts', async () => {
    const { auth } = await loginAs(ctx, ['Viewer']);
    const res = await http().get('/api/v1/roles').query({ page_size: 50, sort: 'name' }).set('Authorization', auth).expect(200);

    expect(res.body.total).toBe(6);
    const superAdmin = res.body.items.find((r: { name: string }) => r.name === 'Super Administrator');
    expect(superAdmin).toMatchObject({ is_system: true, permissions_count: 14, users_count: 1 });
  });

  it('returns a role with its permission keys', async () => {
    const { auth } = await loginAs(ctx, ['Viewer']);
    const viewer = await role('Viewer');
    const res = await http().get(`/api/v1/roles/${viewer.id}`).set('Authorization', auth).expect(200);
    expect(res.body.permissions).toEqual(['dashboard.read', 'permissions.read', 'roles.read', 'users.read']);
  });

  describe('POST /roles', () => {
    it('creates a custom role and refuses a duplicate name', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const res = await http()
        .post('/api/v1/roles')
        .set('Authorization', auth)
        .send({ name: 'Support', description: 'Équipe support', permissions: ['users.read', 'users.reset_password'] })
        .expect(201);
      expect(res.body).toMatchObject({ name: 'Support', is_system: false, permissions: ['users.read', 'users.reset_password'] });

      await http().post('/api/v1/roles').set('Authorization', auth).send({ name: 'SUPPORT', permissions: [] }).expect(409);
      await http().post('/api/v1/roles').set('Authorization', auth).send({ name: 'viewer', permissions: [] }).expect(409);
    });

    it('refuses a permission the actor does not hold and an unknown permission', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      await http().post('/api/v1/roles').set('Authorization', auth).send({ name: 'Cleaner', permissions: ['roles.delete'] }).expect(403);
      const unknown = await http()
        .post('/api/v1/roles')
        .set('Authorization', auth)
        .send({ name: 'Ghost', permissions: ['users.fly'] })
        .expect(400);
      expect(unknown.body.errors[0].field).toMatch(/^permissions/);
    });
  });

  describe('POST /roles/:id/duplicate', () => {
    it('copies the permissions into a new, non-system role', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const manager = await role('Manager');

      const res = await http().post(`/api/v1/roles/${manager.id}/duplicate`).set('Authorization', auth).send({}).expect(201);
      expect(res.body).toMatchObject({ name: 'Manager (copie)', is_system: false, permissions_count: 8 });

      const again = await http().post(`/api/v1/roles/${manager.id}/duplicate`).set('Authorization', auth).send({}).expect(201);
      expect(again.body.name).toBe('Manager (copie 2)');
    });

    it('refuses to duplicate a role carrying permissions the actor lacks', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const superAdmin = await role('Super Administrator');
      await http().post(`/api/v1/roles/${superAdmin.id}/duplicate`).set('Authorization', auth).send({}).expect(403);
    });
  });

  describe('system roles', () => {
    it('cannot be renamed or deleted, and the Super Administrator permissions are frozen', async () => {
      const { auth } = await loginAs(ctx, ['Super Administrator']);
      const viewer = await role('Viewer');
      const superAdmin = await role('Super Administrator');

      await http().patch(`/api/v1/roles/${viewer.id}`).set('Authorization', auth).send({ name: 'Reader' }).expect(409);
      await http().patch(`/api/v1/roles/${viewer.id}`).set('Authorization', auth).send({ description: 'Lecture' }).expect(200);
      await http().delete(`/api/v1/roles/${viewer.id}`).set('Authorization', auth).expect(409);
      await http().delete(`/api/v1/roles/${superAdmin.id}`).set('Authorization', auth).expect(409);
      await http()
        .put(`/api/v1/roles/${superAdmin.id}/permissions`)
        .set('Authorization', auth)
        .send({ permissions: ['users.read'] })
        .expect(403);
    });
  });

  describe('PUT /roles/:id/permissions', () => {
    it('applies the matrix immediately to the holders of the role', async () => {
      const administrator = await loginAs(ctx, ['Administrator']);
      const viewer = await loginAs(ctx, ['Viewer']);
      const viewerRole = await role('Viewer');

      await http().get('/api/v1/activity-logs').set('Authorization', viewer.auth).expect(403);
      const res = await http()
        .put(`/api/v1/roles/${viewerRole.id}/permissions`)
        .set('Authorization', administrator.auth)
        .send({ permissions: ['dashboard.read', 'users.read', 'roles.read', 'permissions.read', 'activity_logs.read'] })
        .expect(200);
      expect(res.body.permissions).toContain('activity_logs.read');
      await http().get('/api/v1/activity-logs').set('Authorization', viewer.auth).expect(200);

      const log = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'role.permissions_changed' } });
      expect(log.metadata).toMatchObject({ added: ['activity_logs.read'], removed: [] });
    });

    it('refuses to add or remove a permission the actor does not hold', async () => {
      const administrator = await loginAs(ctx, ['Administrator']);
      const editorRole = await role('Editor');
      await http()
        .put(`/api/v1/roles/${editorRole.id}/permissions`)
        .set('Authorization', administrator.auth)
        .send({ permissions: ['dashboard.read', 'users.read', 'users.update', 'roles.delete'] })
        .expect(403);
    });
  });

  describe('DELETE /roles/:id', () => {
    it('refuses a role still assigned, then deletes it and frees its name', async () => {
      const { auth } = await loginAs(ctx, ['Super Administrator']);
      const created = await http().post('/api/v1/roles').set('Authorization', auth).send({ name: 'Temp', permissions: ['users.read'] }).expect(201);
      const holder = await createUser(ctx.prisma, { roleNames: ['Temp'] });

      await http().delete(`/api/v1/roles/${created.body.id}`).set('Authorization', auth).expect(409);
      await ctx.prisma.userRole.deleteMany({ where: { userId: holder.id } });
      await http().delete(`/api/v1/roles/${created.body.id}`).set('Authorization', auth).expect(204);

      await http().get(`/api/v1/roles/${created.body.id}`).set('Authorization', auth).expect(404);
      await http().post('/api/v1/roles').set('Authorization', auth).send({ name: 'Temp', permissions: [] }).expect(201);
    });

    it('requires roles.delete', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const created = await http().post('/api/v1/roles').set('Authorization', auth).send({ name: 'Temp', permissions: [] }).expect(201);
      await http().delete(`/api/v1/roles/${created.body.id}`).set('Authorization', auth).expect(403);
    });
  });
});
