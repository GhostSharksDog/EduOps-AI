/**
 * Vitest Configuration for Database Tests
 * 
 * Run with: npm run test:database
 * 
 * Features:
 * - Real database connections (no mocks)
 * - Transaction rollback for test isolation
 * - Single-threaded execution to avoid database lock conflicts
 */
import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// 显式环境变量优先，避免命令行指定的隔离连接被文件覆盖。
config({path:'.env.test',override:false});
if(!process.env.DATABASE_URL||!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('集成测试必须显式配置专用 *_test 数据库');
process.env.JWT_SECRET=process.env.JWT_SECRET||'test-jwt-secret-key-for-testing-only';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',  // Database tests don't need jsdom
    globals: true,
    setupFiles: ['./tests/setup-database.ts'],
    include: ['tests/database/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Single-threaded execution to avoid database lock conflicts
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/unit/standalone/server-only.ts'),
    },
  },
});
