import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';

export default function setup(): void {
  const env = { ...process.env, ...config({ path: '.env.test', override: true, quiet: true }).parsed };
  if (!env.DATABASE_URL?.includes('_test')) {
    throw new Error('Refusing to migrate: DATABASE_URL in .env.test must target a *_test database');
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });
}
