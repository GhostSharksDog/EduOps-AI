import {defineConfig, devices} from '@playwright/test';
const baseURL = process.env.TEST_BASE_URL;
const database = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname) || !database.pathname.endsWith('_test')) {
  throw new Error('页面测试必须显式指定本机测试服务和专用 *_test 数据库');
}
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  outputDir: '../artifacts/browser',
  use: {baseURL, channel: 'msedge', trace: 'on-first-retry', screenshot: 'only-on-failure'},
  projects: [
    {name: 'setup', testMatch: /auth\.setup\.ts/},
    {name: 'chromium', use: {...devices['Desktop Chrome'], channel: 'msedge', storageState: '.auth/user.json'}, dependencies: ['setup']},
  ],
});
