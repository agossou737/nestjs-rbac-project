import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { resetDatabase } from './utils/reset-database.js';
import { SEED_ENV, createTestApp, createUser, loginAs, type TestApp } from './utils/test-app.js';

describe('Departments (e2e)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  const createDepartment = (auth: string, body: Record<string, unknown>) =>
    http().post('/api/v1/departments').set('Authorization', auth).send(body);

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

  describe('permissions', () => {
    it('requires departments.read to list, and departments.create to create', async () => {
      await http().get('/api/v1/departments').expect(401);
      const nobody = await loginAs(ctx, []);
      await http().get('/api/v1/departments').set('Authorization', nobody.auth).expect(403);

      const viewer = await loginAs(ctx, ['Viewer']);
      await http().get('/api/v1/departments').set('Authorization', viewer.auth).expect(200);
      await createDepartment(viewer.auth, { code: 'DSI', name: 'Systèmes d’information' }).expect(403);
    });
  });

  describe('POST /departments', () => {
    it('creates a department with an upper-cased code and an optional manager', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const manager = await createUser(ctx.prisma, { email: 'chef@example.test' });

      const res = await createDepartment(auth, {
        code: ' dsi ',
        name: 'Direction des systèmes d’information',
        description: 'Infrastructure et applications',
        manager_id: manager.id,
      }).expect(201);

      expect(res.body).toMatchObject({
        code: 'DSI',
        name: 'Direction des systèmes d’information',
        description: 'Infrastructure et applications',
        manager: { id: manager.id, email: 'chef@example.test', first_name: 'Test', last_name: 'User' },
        users_count: 0,
      });
      const log = await ctx.prisma.activityLog.findFirstOrThrow({ where: { action: 'department.created' } });
      expect(log.entityId).toBe(res.body.id);
    });

    it('refuses a duplicate code or name, whatever the case', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      await createDepartment(auth, { code: 'RH', name: 'Ressources humaines' }).expect(201);

      await createDepartment(auth, { code: 'rh', name: 'Autre nom' }).expect(409);
      await createDepartment(auth, { code: 'RH2', name: 'RESSOURCES HUMAINES' }).expect(409);
    });

    it('validates the code format and refuses an unknown or deleted manager', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const invalid = await createDepartment(auth, { code: 'D S I!', name: 'Bad' }).expect(400);
      expect(invalid.body.errors[0].field).toBe('code');

      const gone = await createUser(ctx.prisma, { deletedAt: new Date() });
      await createDepartment(auth, { code: 'FIN', name: 'Finances', manager_id: gone.id }).expect(404);
      await createDepartment(auth, { code: 'FIN', name: 'Finances', manager_id: crypto.randomUUID() }).expect(404);
    });
  });

  describe('GET /departments', () => {
    it('paginates, searches on code and name, and counts the members', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      for (const [code, name] of [['DSI', 'Informatique'], ['RH', 'Ressources humaines'], ['FIN', 'Finances'], ['JUR', 'Juridique']]) {
        await createDepartment(auth, { code, name }).expect(201);
      }
      const dsi = await ctx.prisma.department.findUniqueOrThrow({ where: { code: 'DSI' } });
      await ctx.prisma.user.create({
        data: { email: 'a@example.test', passwordHash: 'x', firstName: 'A', lastName: 'B', departmentId: dsi.id },
      });
      await ctx.prisma.user.create({
        data: { email: 'b@example.test', passwordHash: 'x', firstName: 'A', lastName: 'B', departmentId: dsi.id, deletedAt: new Date() },
      });

      const page = await http()
        .get('/api/v1/departments')
        .query({ page: 2, page_size: 2, sort: 'code', order: 'asc' })
        .set('Authorization', auth)
        .expect(200);
      expect(page.body).toMatchObject({ total: 4, page: 2, page_size: 2 });
      expect(page.body.items.map((d: { code: string }) => d.code)).toEqual(['JUR', 'RH']);

      const search = await http().get('/api/v1/departments').query({ search: 'inform' }).set('Authorization', auth).expect(200);
      expect(search.body.items).toEqual([expect.objectContaining({ code: 'DSI', users_count: 1 })]);
    });
  });

  describe('GET, PATCH and DELETE /departments/:id', () => {
    it('reads, updates, and answers 404 for an unknown department', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const created = await createDepartment(auth, { code: 'COM', name: 'Communication' }).expect(201);

      await http().get(`/api/v1/departments/${created.body.id}`).set('Authorization', auth).expect(200);
      await http().get(`/api/v1/departments/${crypto.randomUUID()}`).set('Authorization', auth).expect(404);

      const updated = await http()
        .patch(`/api/v1/departments/${created.body.id}`)
        .set('Authorization', auth)
        .send({ name: 'Communication et presse', manager_id: null })
        .expect(200);
      expect(updated.body).toMatchObject({ code: 'COM', name: 'Communication et presse', manager: null });
    });

    it('refuses to rename onto an existing code', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      await createDepartment(auth, { code: 'AAA', name: 'Premier' }).expect(201);
      const second = await createDepartment(auth, { code: 'BBB', name: 'Second' }).expect(201);
      await http().patch(`/api/v1/departments/${second.body.id}`).set('Authorization', auth).send({ code: 'aaa' }).expect(409);
    });

    it('refuses to delete a department that still has members, then deletes it and frees its code', async () => {
      const { auth } = await loginAs(ctx, ['Super Administrator']);
      const created = await createDepartment(auth, { code: 'TMP', name: 'Temporaire' }).expect(201);
      const member = await ctx.prisma.user.create({
        data: { email: 'm@example.test', passwordHash: 'x', firstName: 'A', lastName: 'B', departmentId: created.body.id },
      });

      await http().delete(`/api/v1/departments/${created.body.id}`).set('Authorization', auth).expect(409);
      await ctx.prisma.user.update({ where: { id: member.id }, data: { departmentId: null } });
      await http().delete(`/api/v1/departments/${created.body.id}`).set('Authorization', auth).expect(204);

      await http().get(`/api/v1/departments/${created.body.id}`).set('Authorization', auth).expect(404);
      await createDepartment(auth, { code: 'TMP', name: 'Temporaire' }).expect(201);
    });

    it('hides a manager whose account was deleted', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const manager = await createUser(ctx.prisma);
      const created = await createDepartment(auth, { code: 'LOG', name: 'Logistique', manager_id: manager.id }).expect(201);
      await ctx.prisma.user.update({ where: { id: manager.id }, data: { deletedAt: new Date() } });

      const res = await http().get(`/api/v1/departments/${created.body.id}`).set('Authorization', auth).expect(200);
      expect(res.body.manager).toBeNull();
    });
  });

  describe('members (users of a department)', () => {
    it('creates, filters and moves accounts between departments', async () => {
      const { auth } = await loginAs(ctx, ['Administrator']);
      const dsi = (await createDepartment(auth, { code: 'DSI', name: 'Informatique' }).expect(201)).body;
      const rh = (await createDepartment(auth, { code: 'RH', name: 'Ressources humaines' }).expect(201)).body;

      const created = await http()
        .post('/api/v1/users')
        .set('Authorization', auth)
        .send({ email: 'agent@example.test', first_name: 'Agent', last_name: 'Un', department_id: dsi.id })
        .expect(201);
      expect(created.body.department).toEqual({ id: dsi.id, code: 'DSI', name: 'Informatique' });

      const filtered = await http().get('/api/v1/users').query({ department_id: dsi.id }).set('Authorization', auth).expect(200);
      expect(filtered.body.items.map((u: { email: string }) => u.email)).toEqual(['agent@example.test']);

      const moved = await http()
        .patch(`/api/v1/users/${created.body.id}`)
        .set('Authorization', auth)
        .send({ department_id: rh.id })
        .expect(200);
      expect(moved.body.department.code).toBe('RH');

      const detached = await http()
        .patch(`/api/v1/users/${created.body.id}`)
        .set('Authorization', auth)
        .send({ department_id: null })
        .expect(200);
      expect(detached.body.department).toBeNull();

      await http()
        .patch(`/api/v1/users/${created.body.id}`)
        .set('Authorization', auth)
        .send({ department_id: crypto.randomUUID() })
        .expect(404);
    });
  });
});
