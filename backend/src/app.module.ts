import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PermissionsGuard } from './rbac/permissions.guard.js';
import { RbacModule } from './rbac/rbac.module.js';

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
    AuthModule,
  ],
  // Order matters: authenticate first, then check permissions.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
