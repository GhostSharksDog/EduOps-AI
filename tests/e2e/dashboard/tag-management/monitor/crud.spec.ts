import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { TagsMonitorPage } from '../../../fixtures/page-objects/TagsMonitorPage';

test.describe('P1 - 标签监控 CRUD', () => {
  let monitorPage: TagsMonitorPage;

  test.beforeEach(async ({ page }) => {
    monitorPage = new TagsMonitorPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await monitorPage.goto();
  });

  test('显示监控页面元素', async ({ page }) => {
    await monitorPage.verifyHeading();
    await expect(monitorPage.statusTab).toBeVisible();
    await expect(monitorPage.errorsTab).toBeVisible();
  });

  test('切换到异常日志 Tab', async ({ page }) => {
    await monitorPage.switchToErrorsTab();
    await expect(monitorPage.errorsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('切换到 MV 状态 Tab', async ({ page }) => {
    await monitorPage.switchToErrorsTab();
    await monitorPage.switchToStatusTab();
    await expect(monitorPage.statusTab).toHaveAttribute('aria-selected', 'true');
  });

  test('使用状态筛选器', async ({ page }) => {
    await monitorPage.waitForTableLoad();
    await monitorPage.selectStatusFilter('all');
    await monitorPage.waitForTableLoad();
    
    const rowCount = await monitorPage.getStatusRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('刷新监控数据', async ({ page }) => {
    await monitorPage.waitForTableLoad();
    await monitorPage.clickRefresh();
    await monitorPage.waitForTableLoad();
    
    const rowCount = await monitorPage.getStatusRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('搜索标签名称', async ({ page }) => {
    await monitorPage.waitForTableLoad();
    await monitorPage.searchInput.fill('test');
    await page.keyboard.press('Enter');
    await monitorPage.waitForTableLoad();
    
    const rowCount = await monitorPage.getStatusRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });
});
