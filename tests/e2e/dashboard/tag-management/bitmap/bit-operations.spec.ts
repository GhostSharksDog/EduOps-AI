import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { BitmapManagementPage } from '../../../fixtures/page-objects/BitmapPage';

test.describe('P1 - Bitmap 位操作', () => {
  let bitmapPage: BitmapManagementPage;

  test.beforeEach(async ({ page }) => {
    bitmapPage = new BitmapManagementPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await bitmapPage.goto();
  });

  test('打开位详情抽屉', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `BIT_TEST_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await expect(row).toBeVisible({ timeout: 10000 });
    
    await bitmapPage.openDetailDrawer(row);
    
    await expect(bitmapPage.detailDrawer.getByText(/位详情/)).toBeVisible();
    
    await bitmapPage.closeDetailDrawer();
    await bitmapPage.clearSearch();
  });

  test('查看位列表 - 空表', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `BIT_EMPTY_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await bitmapPage.openDetailDrawer(row);
    
    const stats = await bitmapPage.getDrawerStats();
    expect(stats.total).toBe(64);
    expect(stats.used).toBe(0);
    expect(stats.available).toBe(64);
    
    const bitCount = await bitmapPage.getBitCount();
    expect(bitCount).toBe(0);
    
    await bitmapPage.closeDetailDrawer();
    await bitmapPage.clearSearch();
  });

  test('搜索位', async ({ page }) => {
    await bitmapPage.waitForTableLoad();
    
    const rows = bitmapPage.getAllRows();
    const count = await rows.count();
    
    if (count > 0) {
      const row = rows.first();
      const usage = await bitmapPage.getRowUsage(row);
      
      if (usage.used > 0) {
        await bitmapPage.openDetailDrawer(row);
        
        await bitmapPage.searchBits('tag');
        await page.waitForTimeout(300);
        
        await bitmapPage.clearBitSearch();
        
        await bitmapPage.closeDetailDrawer();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('使用率进度条显示', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `USAGE_TEST_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await expect(row).toBeVisible({ timeout: 10000 });
    
    const progress = row.locator('.ant-progress');
    await expect(progress).toBeVisible();
    
    const usage = await bitmapPage.getRowUsage(row);
    expect(usage.percentage).toBe(0);
    
    await bitmapPage.clearSearch();
  });

  test('位详情统计显示', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `STATS_TEST_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await bitmapPage.openDetailDrawer(row);
    
    await expect(bitmapPage.detailDrawer.getByText(/总位数/)).toBeVisible();
    await expect(bitmapPage.detailDrawer.getByText(/已分配/)).toBeVisible();
    await expect(bitmapPage.detailDrawer.getByText(/未分配/)).toBeVisible();
    
    await bitmapPage.closeDetailDrawer();
    await bitmapPage.clearSearch();
  });
});
