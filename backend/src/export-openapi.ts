// Writes the API contract the frontend types are generated from (npm run openapi:export).
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { buildOpenApiDocument } from './openapi.js';

const output = new URL('../../docs/architecture/openapi.json', import.meta.url);
const app = await NestFactory.create(AppModule, { logger: ['error'] });
configureApp(app);
writeFileSync(output, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
await app.close();
console.log(`OpenAPI contract written to ${output.pathname}`);
