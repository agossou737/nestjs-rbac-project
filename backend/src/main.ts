import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { buildOpenApiDocument } from './openapi.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  // SIGTERM from Docker or Kubernetes: finish in-flight requests and close the database pool.
  app.enableShutdownHooks();
  if (app.get(ConfigService).getOrThrow<boolean>('SWAGGER_ENABLED')) {
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  }
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}
await bootstrap();
