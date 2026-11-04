import 'dotenv/config';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import { seedDatabase } from './seed-database.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const prisma = createPrismaClient(databaseUrl);
try {
  await seedDatabase(prisma, process.env);
  console.log('Seed completed: permissions, system roles and super admin are in place.');
} finally {
  await prisma.$disconnect();
}
