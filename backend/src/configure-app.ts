import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ProblemDetailsFilter, toValidationProblem } from './common/problem-details.js';

// Shared by main.ts and the e2e tests so both run the exact same HTTP pipeline.
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  // Behind the ingress, req.ip (rate limits, logs) must be the client, not the proxy; never "true", which trusts any X-Forwarded-For.
  const trustProxy = config.getOrThrow<string>('TRUST_PROXY');
  if (trustProxy !== 'false') {
    (app as NestExpressApplication).set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: toValidationProblem,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
}
