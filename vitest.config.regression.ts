import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** 迁移回归：只运行隔离单元测试，不加载 .env 或数据库全局初始化。 */
export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    exclude: [
      'tests/unit/standalone/**', 'node_modules', '.next',
    ],
    setupFiles: ['tests/helpers/regression-setup.ts'],
    maxWorkers: 2,
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@/tests': path.resolve(__dirname, 'tests'),
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/unit/standalone/server-only.ts'),
    },
  },
});
