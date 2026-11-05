import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';

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
    AuthModule,
  ],
})
export class AppModule {}
