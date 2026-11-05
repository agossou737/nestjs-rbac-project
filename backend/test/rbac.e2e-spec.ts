import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { seedDatabase } from '../prisma/seed-database.js';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/auth/decorators.js';
import { configureApp } from '../src/configure-app.js';
import { AccessPolicy } from '../src/rbac/access-policy.service.js';
import { Authenticated, Permissions } from '../src/rbac/permissions.decorator.js';
import { RbacService } from '../src/rbac/rbac.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './utils/reset-database.js';
import { DEFAULT_PASSWORD, FakeMailService, createUser } from './utils/test-app.js';

@Controller('probe')
class ProbeController {
  @Public()
  @Get('public')
  open() {
    return { ok: true };
  }

  @Get('undeclared')
  undeclared() {
    return { ok: true };
  }

  @Authenticated()
  @Get('authenticated')
  authenticated() {
    return { ok: true };
  }

  @Permissions('users.read', 'users.delete')
  @Get('all-of')
  allOf() {
    return { ok: true };
  }

  @Permissions.anyOf('activity_logs.read', 'login_history.read')
  @Get('any-of')
  anyOf() {
    return { ok: true };
  }
}

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rbac: RbacService;
  let policy: AccessPolicy;

  const http = () => request(app.getHttpServer());

  async function tokenFor(roleNames: string[]) {
    const user = await createUser(prisma, { roleNames });
    const res = await http().post('/api/v1/auth/login').send({ email: user.email, password: DEFAULT_PASSWORD }).expect(200);
    return { user, auth: `Bearer ${res.body.access_token}` };
  }

  const roleId = async (name: string) => (await prisma.role.findUniqueOrThrow({ where: { name } })).id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] })
      .overrideProvider(MailService)
      .useValue(new FakeMailService())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    rbac = app.get(RbacService);
    policy = app.get(AccessPolicy);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedDatabase(prisma, { SEED_SUPER_ADMIN_EMAIL: 'root@example.test', SEED_SUPER_ADMIN_PASSWORD: 'Root-Password-123' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('guards', () => {
    it('lets anyone reach a @Public route', async () => {
      await http().get('/api/v1/probe/public').expect(200);
    });

    it('denies by default a route that declares no permission, even to the Super Administrator', async () => {
      const { auth } = await tokenFor(['Super Administrator']);
      const res = await http().get('/api/v1/probe/undeclared').set('Authorization', auth).expect(403);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    });

    it('lets any authenticated user reach an @Authenticated route, and nobody else', async () => {
      await http().get('/api/v1/probe/authenticated').expect(401);
      const { auth } = await tokenFor([]);
      await http().get('/api/v1/probe/authenticated').set('Authorization', auth).expect(200);
    });

    it('requires every permission of @Permissions (AND)', async () => {
      await http().get('/api/v1/probe/all-of').expect(401);
      const viewer = await tokenFor(['Viewer']);
      await http().get('/api/v1/probe/all-of').set('Authorization', viewer.auth).expect(403);
      const admin = await tokenFor(['Administrator']);
      await http().get('/api/v1/probe/all-of').set('Authorization', admin.auth).expect(200);
    });

    it('requires one permission of @Permissions.anyOf (OR)', async () => {
      const viewer = await tokenFor(['Viewer']);
      await http().get('/api/v1/probe/any-of').set('Authorization', viewer.auth).expect(403);
      const auditor = await tokenFor(['Auditor']);
      await http().get('/api/v1/probe/any-of').set('Authorization', auditor.auth).expect(200);
    });

    it('combines the permissions of several roles', async () => {
      const editorAndAuditor = await tokenFor(['Editor', 'Auditor']);
      await http().get('/api/v1/probe/any-of').set('Authorization', editorAndAuditor.auth).expect(200);
    });

    it('reads roles from the database on every request, never from the token', async () => {
      const { user, auth } = await tokenFor(['Administrator']);
      await http().get('/api/v1/probe/all-of').set('Authorization', auth).expect(200);

      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await http().get('/api/v1/probe/all-of').set('Authorization', auth).expect(403);
    });

    it('ignores the permissions of a soft-deleted role', async () => {
      const { auth } = await tokenFor(['Auditor']);
      await prisma.role.update({ where: { name: 'Auditor' }, data: { deletedAt: new Date() } });
      await http().get('/api/v1/probe/any-of').set('Authorization', auth).expect(403);
    });
  });

  describe('RbacService.hasPermission', () => {
    it('answers from the current roles of an active user', async () => {
      const { user } = await tokenFor(['Viewer']);
      expect(await rbac.hasPermission(user.id, 'users.read')).toBe(true);
      expect(await rbac.hasPermission(user.id, 'users.delete')).toBe(false);
    });

    it('answers false for an inactive, deleted or unknown user', async () => {
      const inactive = await createUser(prisma, { roleNames: ['Super Administrator'], status: 'INACTIVE' });
      const deleted = await createUser(prisma, { roleNames: ['Super Administrator'], deletedAt: new Date() });
      expect(await rbac.hasPermission(inactive.id, 'users.read')).toBe(false);
      expect(await rbac.hasPermission(deleted.id, 'users.read')).toBe(false);
      expect(await rbac.hasPermission(crypto.randomUUID(), 'users.read')).toBe(false);
    });
  });

  describe('AccessPolicy', () => {
    it('forbids changing your own roles', async () => {
      const { user } = await tokenFor(['Super Administrator']);
      await expect(policy.assertCanAssignRoles(user.id, user.id, [], [await roleId('Viewer')])).rejects.toMatchObject({
        status: 403,
      });
    });

    it('forbids assigning or removing a role that carries a permission the actor lacks', async () => {
      const manager = (await tokenFor(['Manager'])).user;
      const target = await createUser(prisma, { roleNames: ['Viewer'] });

      await expect(
        policy.assertCanAssignRoles(manager.id, target.id, [await roleId('Administrator')], []),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        policy.assertCanAssignRoles(manager.id, target.id, [await roleId('Super Administrator')], []),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        policy.assertCanAssignRoles(manager.id, target.id, [await roleId('Editor')], [await roleId('Viewer')]),
      ).resolves.toBeUndefined();

      const admin = await createUser(prisma, { roleNames: ['Administrator'] });
      await expect(
        policy.assertCanAssignRoles(manager.id, admin.id, [], [await roleId('Administrator')]),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('lets only a Super Administrator assign the Super Administrator role', async () => {
      const administrator = (await tokenFor(['Administrator'])).user;
      const superAdmin = (await tokenFor(['Super Administrator'])).user;
      const target = await createUser(prisma);
      const superRole = await roleId('Super Administrator');

      await expect(policy.assertCanAssignRoles(administrator.id, target.id, [superRole], [])).rejects.toMatchObject({
        status: 403,
      });
      await expect(policy.assertCanAssignRoles(superAdmin.id, target.id, [superRole], [])).resolves.toBeUndefined();
    });

    it('forbids granting a permission the actor does not hold', async () => {
      const administrator = (await tokenFor(['Administrator'])).user;
      await expect(policy.assertCanGrantPermissions(administrator.id, ['users.read', 'roles.delete'])).rejects.toMatchObject({
        status: 403,
      });
      await expect(policy.assertCanGrantPermissions(administrator.id, ['users.read', 'roles.update'])).resolves.toBeUndefined();
    });

    it('protects Super Administrator accounts and the actor itself from management actions', async () => {
      const administrator = (await tokenFor(['Administrator'])).user;
      const superAdmin = (await tokenFor(['Super Administrator'])).user;
      const viewer = await createUser(prisma, { roleNames: ['Viewer'] });

      await expect(policy.assertCanManageUser(administrator.id, superAdmin.id)).rejects.toMatchObject({ status: 403 });
      await expect(policy.assertCanManageUser(administrator.id, administrator.id)).rejects.toMatchObject({ status: 403 });
      await expect(policy.assertCanManageUser(administrator.id, viewer.id)).resolves.toBeUndefined();
      await expect(policy.assertCanManageUser(superAdmin.id, administrator.id)).resolves.toBeUndefined();
    });

    it('refuses to remove the last active Super Administrator', async () => {
      const root = await prisma.user.findUniqueOrThrow({ where: { email: 'root@example.test' } });
      await expect(policy.assertSuperAdminRemains(root.id)).rejects.toMatchObject({ status: 409 });

      const backup = await createUser(prisma, { roleNames: ['Super Administrator'] });
      await expect(policy.assertSuperAdminRemains(root.id)).resolves.toBeUndefined();

      // An inactive or deleted Super Administrator is no backup.
      await prisma.user.update({ where: { id: backup.id }, data: { status: 'INACTIVE' } });
      await expect(policy.assertSuperAdminRemains(root.id)).rejects.toMatchObject({ status: 409 });
      await prisma.user.update({ where: { id: backup.id }, data: { status: 'ACTIVE', deletedAt: new Date() } });
      await expect(policy.assertSuperAdminRemains(root.id)).rejects.toMatchObject({ status: 409 });
    });
  });
});
