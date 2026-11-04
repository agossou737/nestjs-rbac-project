import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Tests run against the dedicated access_manager_test database, never the development one.
const testEnv = config({ path: '.env.test', override: true, quiet: true }).parsed ?? {};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: testEnv,
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
