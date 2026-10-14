import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { BitmapManagementPage } from '../../../fixtures/page-objects/BitmapPage';

test.describe('P2 - Bitmap 表筛选', () => {
  let bitmapPage: BitmapManagementPage;

  test.beforeEach(async ({ page }) => {
    bitmapPage = new BitmapManagementPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await bitmapPage.goto();
  });

  test('按状态筛选 - 活跃', async ({ page }) => {
    await bitmapPage.filterByStatus('活跃');
    await page.waitForTimeout(500);
    
    const rows = bitmapPage.getAllRows();
    const count = await rows.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const status = await bitmapPage.getRowStatus(rows.nth(i));
      expect(status).toBe('ACTIVE');
    }
    
    await bitmapPage.clearAllFilters();
  });

  test('按状态筛选 - 停用', async ({ page }) => {
    await bitmapPage.filterByStatus('已停用');
    await page.waitForTimeout(500);
    
    const rows = bitmapPage.getAllRows();
    const count = await rows.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const status = await bitmapPage.getRowStatus(rows.nth(i));
      expect(status).toBe('INACTIVE');
    }
    
    await bitmapPage.clearAllFilters();
  });

  test('关键字搜索 - 实体类型', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `SEARCH_TEST_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    
    await bitmapPage.search(entityType);
    await page.waitForTimeout(500);
    
    const rows = bitmapPage.getAllRows();
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    
    await bitmapPage.clearSearch();
  });

  test('清空筛选器', async ({ page }) => {
    await bitmapPage.filterByStatus('活跃');
    await page.waitForTimeout(300);
    
    await bitmapPage.clearAllFilters();
    await page.waitForTimeout(300);
    
    const rows = bitmapPage.getAllRows();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});
