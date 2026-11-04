import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaMariaDb(toPoolConfig(databaseUrl)) });
}

function toPoolConfig(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 10,
    connectTimeout: 10_000,
    // MySQL 8 caching_sha2_password over a non-TLS local socket needs the server key; production uses TLS.
    allowPublicKeyRetrieval: url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === 'mysql',
  };
}
