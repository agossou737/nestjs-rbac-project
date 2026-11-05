import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ActivityLogsModule } from './activity-logs/activity-logs.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { validateEnv } from './config/env.validation.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { LoginHistoryModule } from './login-history/login-history.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PermissionsGuard } from './rbac/permissions.guard.js';
import { RbacModule } from './rbac/rbac.module.js';
import { RolesModule } from './roles/roles.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Tests get their whole configuration from .env.test, never from the development .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    RbacModule,
    ActivityLogsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    LoginHistoryModule,
    DashboardModule,
  ],
  // Order matters: authenticate first, then check permissions.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
