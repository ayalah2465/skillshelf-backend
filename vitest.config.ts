import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
dotenv.config({ path: '.env.test', quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^skillshelf_test_[a-z0-9_]+$/.test(new URL(testUrl).pathname.slice(1))) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated PostgreSQL database named skillshelf_test_*. Tests delete its application data.');
}
process.env.DATABASE_URL = testUrl;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.TRUST_PROXY_HOPS = '0';
export default defineConfig({ test: {
  include: ['tests/**/*.test.ts'], globalSetup: ['./tests/global-setup.ts'],
  testTimeout: 20000, hookTimeout: 60000, fileParallelism: false, maxWorkers: 1,
} });
