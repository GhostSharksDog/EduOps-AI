/**
 * API 与 ClickHouse 集成测试：使用显式配置的专用 *_test 数据库和测试应用。
 * 夹具只清理自身创建的数据；服务由 tests/e2e/test-server.mjs 单独启动。
 */
import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// 已显式配置的隔离数据库和测试服务优先，禁止被本地文件覆盖。
config({path:'.env.test',override:false});
if(!process.env.DATABASE_URL||!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('集成测试必须显式配置专用 *_test 数据库');
process.env.JWT_SECRET=process.env.JWT_SECRET||'test-jwt-secret-key-for-testing-only';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/api/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist', 'coverage'],
    testTimeout: 60000,
    hookTimeout: 120000,
    // Fork pool for database tests to avoid connection conflicts
    pool: 'forks',
    maxWorkers: 1,  // Run tests sequentially to avoid DB lock conflicts
    fileParallelism:false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*'],
      exclude: ['src/app/**/*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/tests': path.resolve(__dirname, './tests'),
    },
  },
});
