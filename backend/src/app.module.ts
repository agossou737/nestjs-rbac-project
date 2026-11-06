import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ActivityLogsModule } from './activity-logs/activity-logs.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { throttlerOptions } from './common/credential-rate-limit.js';
import { loggerParams } from './common/logger.config.js';
import { validateEnv } from './config/env.validation.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { HealthModule } from './health/health.module.js';
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
    LoggerModule.forRootAsync({ inject: [ConfigService], useFactory: loggerParams }),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: throttlerOptions }),
    PrismaModule,
    RbacModule,
    ActivityLogsModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    RolesModule,
    PermissionsModule,
    LoginHistoryModule,
    DashboardModule,
    HealthModule,
  ],
  // Order matters: rate limit first (cheap, before any database read), then authenticate, then check permissions.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
